// ------------------------------------------------------------
// src/lib/openLibrary.ts
// Centralized Open Library API helpers for BookPickr
// ------------------------------------------------------------
//
// Performance note: search.json costs ~400-700ms per call. Anything we can
// answer from a stored workKey/coverId instead is effectively free, so the
// rule here is: only fall back to search when a book has no identifiers.

import type { Book, SourceBook } from "../types";

// Be polite if you ever call these server-side. In browsers, this header is ignored.
const UA = "BookPickr/2.0 (contact: conmoss30@gmail.com)";

/* ----------------------- Types ----------------------- */

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];
  cover_i?: number;
  key?: string;
  edition_count?: number;
  first_publish_year?: number;
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibraryDoc[];
}

type WorkDescription = string | { value?: string; type?: string } | null | undefined;

interface OpenLibraryWork {
  description?: WorkDescription;
  covers?: number[];
}

/** What we learn about a book once, and never need to look up again. */
export type BookMeta = {
  workKey?: string;
  coverId?: number;
};

/* --------------------- Caches ------------------------ */
//
// Three layers, cheapest first:
//   1. in-flight promises  — collapses concurrent duplicate requests
//   2. in-memory Map       — survives re-renders and navigation
//   3. localStorage        — survives a page reload

const META_STORE = "bookpickr:meta";
const SYNOPSIS_STORE = "bookpickr:synopsis";

function loadStore<T>(name: string): Map<string, T> {
  try {
    const raw = localStorage.getItem(name);
    if (raw) return new Map(Object.entries(JSON.parse(raw) as Record<string, T>));
  } catch (e) {
    console.debug(`openLibrary: could not read ${name}`, e);
  }
  return new Map();
}

function saveStore<T>(name: string, map: Map<string, T>) {
  try {
    localStorage.setItem(name, JSON.stringify(Object.fromEntries(map)));
  } catch (e) {
    // Quota or private mode — the in-memory cache still works.
    console.debug(`openLibrary: could not persist ${name}`, e);
  }
}

const metaCache = loadStore<BookMeta>(META_STORE);
const synopsisCache = loadStore<string | null>(SYNOPSIS_STORE);

// Keyed the same way as the caches, so two components asking for the same book
// at the same time share a single network request instead of racing.
const inFlightMeta = new Map<string, Promise<BookMeta | undefined>>();
const inFlightSynopsis = new Map<string, Promise<string | undefined>>();

/* -------------------- Utilities ---------------------- */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function cacheKey(title: string, author: string): string {
  return `${normalize(title)}|${normalize(author)}`;
}

// Open Library lists every translation of a work under the same author, so an
// author's shelf comes back full of editions nobody browsing an English app
// can read. These two guards drop them.

/** Titles written in a non-Latin script — Hebrew, Cyrillic, CJK and friends. */
const NON_LATIN_SCRIPT =
  /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Devanagari}\p{Script=Thai}\p{Script=Armenian}\p{Script=Georgian}]/u;

/**
 * Romanized transliterations ("ha-Aḥavah", "Tiḳ śaḳnai"). They're Latin script,
 * so the check above misses them, but they lean on Latin Extended Additional
 * diacritics that essentially never appear in an English title. Ordinary
 * accents (café, Brontë) live in Latin-1 and are deliberately left alone.
 */
const TRANSLITERATION_MARKS = /[\u1E00-\u1EFF]/;

function isReadableTitle(title: string): boolean {
  return !NON_LATIN_SCRIPT.test(title) && !TRANSLITERATION_MARKS.test(title);
}

/* ------------------ Cover URLs ----------------------- */

export type CoverSize = "S" | "M" | "L";

/**
 * Build a cover URL from a numeric id. No network call, no await — the browser
 * can start downloading the moment the component renders.
 *
 * `default=false` makes Open Library 404 instead of serving its grey
 * placeholder, which lets the <img> onError handler fall back to our own.
 */
export function coverUrlFromId(coverId: number, size: CoverSize = "M"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`;
}

/** Cover URL for a book we already have identifiers for, or undefined. */
export function coverUrlFor(book: Book, size: CoverSize = "M"): string | undefined {
  if (typeof book.coverId === "number") return coverUrlFromId(book.coverId, size);
  const cached = metaCache.get(cacheKey(book.title, book.author));
  return typeof cached?.coverId === "number" ? coverUrlFromId(cached.coverId, size) : undefined;
}

/** Warm the browser's image cache so the next round paints instantly. */
export function prefetchCover(book: Book, size: CoverSize = "M") {
  const url = coverUrlFor(book, size);
  if (url) new Image().src = url;
}

/* ------------------ API helpers ---------------------- */

async function searchDocs(title: string, author: string): Promise<OpenLibraryDoc[]> {
  const params = new URLSearchParams({
    title,
    author,
    limit: "5",
    language: "eng",
    // Only the fields we actually read. Dropping isbn/edition_key alone cuts
    // the response from ~2.5KB to a few hundred bytes.
    fields: "title,author_name,cover_i,key,edition_count",
  }).toString();

  try {
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OpenLibrarySearchResponse;
    return Array.isArray(data?.docs) ? data.docs : [];
  } catch (err) {
    console.debug("searchDocs error:", err);
    return [];
  }
}

function bestDoc(docs: OpenLibraryDoc[], title: string, author: string): OpenLibraryDoc | undefined {
  const wantTitle = normalize(title);
  const wantAuthor = normalize(author);

  return docs
    .map((d) => {
      const t = normalize(d.title ?? "");
      const a = normalize(d.author_name?.[0] ?? "");
      let score = 0;
      if (t === wantTitle) score += 4;
      else if (t.startsWith(wantTitle)) score += 2;
      if (a === wantAuthor) score += 3;
      else if (a.includes(wantAuthor) || wantAuthor.includes(a)) score += 1;
      if (typeof d.cover_i === "number") score += 2;
      // Prefer the canonical edition over the long tail of reprints and
      // translations: the work with more editions is the one people mean.
      score += Math.min(d.edition_count ?? 0, 50) / 100;
      return { d, score };
    })
    .sort((x, y) => y.score - x.score)[0]?.d;
}

/**
 * Resolve a title/author to Open Library identifiers — ONE search, shared by
 * every caller. Previously the cover and synopsis paths each ran their own
 * identical search, doubling the requests for no benefit.
 */
export async function lookupBookMeta(title: string, author: string): Promise<BookMeta | undefined> {
  const key = cacheKey(title, author);

  const cached = metaCache.get(key);
  if (cached) return cached;

  const pending = inFlightMeta.get(key);
  if (pending) return pending;

  const request = (async (): Promise<BookMeta | undefined> => {
    const best = bestDoc(await searchDocs(title, author), title, author);
    const meta: BookMeta = {
      workKey: nonEmpty(best?.key) ? best.key : undefined,
      coverId: typeof best?.cover_i === "number" ? best.cover_i : undefined,
    };
    metaCache.set(key, meta);
    saveStore(META_STORE, metaCache);
    return meta;
  })().finally(() => inFlightMeta.delete(key));

  inFlightMeta.set(key, request);
  return request;
}

/**
 * Cover URL for a book, resolving identifiers only if we don't already have
 * them. Returns immediately for any book carrying a coverId.
 */
export async function fetchCoverUrl(book: Book, size: CoverSize = "M"): Promise<string | undefined> {
  const direct = coverUrlFor(book, size);
  if (direct) return direct;

  const meta = await lookupBookMeta(book.title, book.author);
  return typeof meta?.coverId === "number" ? coverUrlFromId(meta.coverId, size) : undefined;
}

/**
 * Synopsis for a book. Only ever called on demand (the card fetches it when
 * hovered) because the text is invisible until then.
 */
export async function fetchSynopsis(book: Book): Promise<string | undefined> {
  const key = cacheKey(book.title, book.author);

  if (synopsisCache.has(key)) return synopsisCache.get(key) ?? undefined;

  const pending = inFlightSynopsis.get(key);
  if (pending) return pending;

  const request = (async (): Promise<string | undefined> => {
    // Use the stored workKey when we have one; only search as a last resort.
    let workKey = book.workKey;
    if (!nonEmpty(workKey)) {
      workKey = (await lookupBookMeta(book.title, book.author))?.workKey;
    }

    const remember = (value: string | null) => {
      synopsisCache.set(key, value);
      saveStore(SYNOPSIS_STORE, synopsisCache);
      return value ?? undefined;
    };

    if (!nonEmpty(workKey)) return remember(null);

    try {
      const path = workKey.startsWith("/") ? workKey : `/works/${workKey}`;
      const res = await fetch(`https://openlibrary.org${path}.json`, {
        headers: { "User-Agent": UA },
      });
      if (!res.ok) return remember(null);

      const work = (await res.json()) as OpenLibraryWork;
      const desc = work?.description;
      const text = typeof desc === "string" ? desc : desc?.value;

      if (!nonEmpty(text)) return remember(null);
      return remember(text.length > 280 ? `${text.slice(0, 277)}…` : text);
    } catch (err) {
      console.debug("fetchSynopsis error:", err);
      return remember(null);
    }
  })().finally(() => inFlightSynopsis.delete(key));

  inFlightSynopsis.set(key, request);
  return request;
}

/* ------------------ Book pools ----------------------- */
/* Genre/Author book-pool helpers for setup screen */

interface SubjectAuthor { name?: string }

interface SubjectWork {
  key?: string;                 // e.g. "/works/OL82563W"
  title?: string;
  authors?: SubjectAuthor[];
  cover_id?: number;
  first_publish_year?: number;
}

interface SubjectResponse {
  works?: SubjectWork[];
  work_count?: number;
}

interface AuthorSearchDoc { key?: string; work_count?: number }  // e.g. "OL23919A"
interface AuthorSearchResponse { docs?: AuthorSearchDoc[] }

/** util: convert raw items to a de-duped, limited SourceBook[] */
function toBookList(items: Array<Partial<SourceBook>>, limit = 50): SourceBook[] {
  const seen = new Set<string>();
  const result: SourceBook[] = [];
  for (const it of items) {
    const title = (it.title || "").trim();
    const author = (it.author || "").trim() || "Unknown";
    if (!title) continue;
    const k = cacheKey(title, author);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push({
      id: result.length + 1,
      title,
      author,
      workKey: it.workKey,
      coverId: it.coverId,
      year: it.year,
    });
    if (result.length >= limit) break;
  }
  return result;
}

/** SUBJECTS: https://openlibrary.org/subjects/{subject}.json?limit=50 */
export async function fetchSubjectBooks(
  subject: string,
  limit = 50,
  offset = 0
): Promise<{ items: SourceBook[]; total: number }> {
  const url = `https://openlibrary.org/subjects/${encodeURIComponent(subject)}.json?limit=${limit}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) return { items: [], total: 0 };
  const data = (await res.json()) as SubjectResponse;
  const works: SubjectWork[] = Array.isArray(data?.works) ? data.works : [];

  const items = works
    .filter((w) => nonEmpty(w.title) && isReadableTitle(w.title))
    .filter((w) => typeof w.cover_id === "number")
    .map((w) => ({
      title: w.title,
      author: w.authors?.[0]?.name || "Unknown",
      workKey: w.key,
      coverId: w.cover_id,
      year: w.first_publish_year,
    }));
  return { items: toBookList(items, limit), total: data?.work_count ?? items.length };
}

/**
 * Books by an author.
 *
 * Previously this read /authors/{key}/works.json, which returns every work in
 * every language with no ordering — for a heavily translated author like
 * Grisham that meant 200 arbitrary rows out of 683, nearly all of them foreign
 * editions with no cover.
 *
 * search.json can filter by language and sort by popularity, and when we know
 * the author's key it matches exactly instead of fuzzily on the name.
 */
export async function fetchAuthorBooks(
  authorName: string,
  limit = 50,
  authorKey?: string
): Promise<SourceBook[]> {
  // Prefer the key the autocomplete already resolved. Falling back to a name
  // search also picks the most prolific match rather than blindly taking the
  // first, which used to land on a different author of the same name.
  let key = authorKey?.replace(/^\/authors\//, "");

  if (!nonEmpty(key)) {
    const search = await fetch(
      `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(authorName)}`
    );
    if (!search.ok) return [];
    const sdata = (await search.json()) as AuthorSearchResponse;
    const best = (sdata?.docs ?? [])
      .slice(0, 5)
      .sort((a, b) => (b.work_count ?? 0) - (a.work_count ?? 0))[0];
    key = best?.key?.replace(/^\/authors\//, "");
    if (!nonEmpty(key)) return [];
  }

  const params = new URLSearchParams({
    author_key: key,
    language: "eng",
    sort: "readinglog", // most-shelved first, i.e. the ones people mean
    // Over-fetch, because filtering for covers and readable titles thins it out.
    limit: String(Math.min(limit * 3, 200)),
    fields: "title,author_name,cover_i,key,edition_count,first_publish_year",
  }).toString();

  const res = await fetch(`https://openlibrary.org/search.json?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as OpenLibrarySearchResponse;
  const docs = Array.isArray(data?.docs) ? data.docs : [];

  const items = docs
    .filter((d) => nonEmpty(d.title) && isReadableTitle(d.title))
    // A row with no cover renders as a bare emoji, which is just visual noise
    // in a list whose whole job is helping you recognise a book.
    .filter((d) => typeof d.cover_i === "number")
    .map((d) => ({
      title: d.title,
      author: d.author_name?.[0] || authorName,
      workKey: d.key,
      coverId: d.cover_i,
      year: d.first_publish_year,
    }));

  return toBookList(items, limit);
}

/* ------------------ Queue storage -------------------- */

export function saveQueue(sourceBooks: SourceBook[]) {
  // Keep workKey/coverId. Dropping them here was the single most expensive
  // thing the app did: setup already knew every cover id, and throwing them
  // away forced the picker to re-derive each one with a slow search.
  const mapped: Book[] = sourceBooks.map((b, i) => ({
    id: i + 1,
    title: b.title,
    author: b.author,
    workKey: b.workKey,
    coverId: b.coverId,
  }));
  localStorage.setItem("bookpickr:queue", JSON.stringify(mapped));
}

export function clearQueue() {
  localStorage.removeItem("bookpickr:queue");
}

/* ------------------ Author autocomplete -------------- */

export type AuthorHit = {
  key: string;        // "/authors/OL23919A"
  name: string;       // "George Orwell"
  top_work?: string;
  work_count?: number;
  birth_date?: string;
  death_date?: string;
};

const _authorCache = new Map<string, AuthorHit[]>();
const _authorInFlight = new Map<string, Promise<AuthorHit[]>>();

interface OpenLibraryAuthorDoc {
  key: string;
  name: string;
  top_work?: string;
  work_count?: number;
  birth_date?: string;
  death_date?: string;
}

interface OpenLibraryAuthorResponse {
  docs?: OpenLibraryAuthorDoc[];
}

export async function searchAuthors(query: string, limit = 8): Promise<AuthorHit[]> {
  const q = query.trim();
  if (!q) return [];

  const key = `${q.toLowerCase()}|${limit}`;
  const cached = _authorCache.get(key);
  if (cached) return cached;

  const pending = _authorInFlight.get(key);
  if (pending) return pending;

  const request = (async (): Promise<AuthorHit[]> => {
    const url = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}&limit=${limit}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as OpenLibraryAuthorResponse;
      const hits: AuthorHit[] = (data.docs ?? []).map((d) => ({
        key: d.key,
        name: d.name,
        top_work: d.top_work,
        work_count: d.work_count,
        birth_date: d.birth_date,
        death_date: d.death_date,
      }));
      _authorCache.set(key, hits);
      return hits;
    } catch (err) {
      console.debug("searchAuthors error:", err);
      return [];
    }
  })().finally(() => _authorInFlight.delete(key));

  _authorInFlight.set(key, request);
  return request;
}
