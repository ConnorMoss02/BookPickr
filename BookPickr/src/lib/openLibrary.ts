// ------------------------------------------------------------
// src/lib/openLibrary.ts
// Centralized Open Library API helpers for BookPickr
// ------------------------------------------------------------

import type { Book, SourceBook  } from "../types"; 


// Be polite if you ever call these server-side. In browsers, this header is ignored.
const UA = "BookPickr/0.1 (contact: conmoss30@gmail.com)";

/* ----------------------- Types ----------------------- */

interface OpenLibrarySearchResponse {
  docs: OpenLibraryDoc[];
}

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  key?: string;
  work_key?: string[];
  edition_key?: string[];
}

type WorkDescription =
  | string
  | { value?: string; type?: string }
  | null
  | undefined;

interface OpenLibraryWork {
  description?: WorkDescription;
}

type Maybe<T> = T | undefined;

/* --------------------- Caches ------------------------ */

const coverCache = new Map<string, string>();
const synopsisCache = new Map<string, string | null>();

/* -------------------- Utilities ---------------------- */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/* ------------------ API helpers ---------------------- */

async function searchDocs(title: string, author: string): Promise<OpenLibraryDoc[]> {
  const params = new URLSearchParams({
    title,
    author,
    limit: "10",
    language: "eng",
    lang: "en", 
    fields: "title,author_name,cover_i,isbn,key,work_key,edition_key",
  }).toString();

  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    headers: { "User-Agent": UA },
  });

  if (!res.ok) return [];
  const data: unknown = await res.json();

  if (
    typeof data === "object" &&
    data !== null &&
    "docs" in data &&
    Array.isArray((data as OpenLibrarySearchResponse).docs)
  ) {
    return (data as OpenLibrarySearchResponse).docs;
  }

  return [];
}

function scoreDocs(docs: OpenLibraryDoc[], title: string, author: string): OpenLibraryDoc[] {
  const wantTitle = normalize(title);
  const wantAuthor = normalize(author);

  return docs
    .map((d) => {
      const t = normalize(d.title ?? "");
      const a = normalize((d.author_name?.[0] ?? "") as string);
      let score = 0;
      if (t === wantTitle) score += 2;
      if (a.includes(wantAuthor) || wantAuthor.includes(a)) score += 1;
      if ((d.isbn?.length ?? 0) > 0) score += 1;
      if (typeof d.cover_i === "number") score += 1;
      return { d, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.d);
}

/* ------------------ Public API ----------------------- */

export async function fetchCoverUrl(title: string, author: string): Promise<string | undefined> {
  const key = `${title}|${author}`;
  const cached = coverCache.get(key);
  if (cached) return cached;

  const ranked = scoreDocs(await searchDocs(title, author), title, author);
  const best = ranked[0];
  if (!best) return undefined;

  const candidates: string[] = [];
  if (typeof best.cover_i === "number") {
    candidates.push(
      `https://covers.openlibrary.org/b/id/${best.cover_i}-L.jpg?default=false`,
      `https://covers.openlibrary.org/b/id/${best.cover_i}-M.jpg?default=false`
    );
  }

  const isbns = Array.isArray(best.isbn) ? best.isbn.slice(0, 3) : [];
  for (const isbn of isbns) {
    candidates.push(
      `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
      `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`
    );
  }

  for (const u of candidates) {
    const clean = u.replace("?default=false", "");
    coverCache.set(key, clean);
    return clean;
  }

  return undefined;
}

export async function fetchSynopsis(title: string, author: string): Promise<Maybe<string>> {
  const key = `${title}|${author}`;
  if (synopsisCache.has(key)) return synopsisCache.get(key) ?? undefined;

  const ranked = scoreDocs(await searchDocs(title, author), title, author);
  const best = ranked[0];
  if (!best) {
    synopsisCache.set(key, null);
    return undefined;
  }

  const workKey =
    (Array.isArray(best.work_key) ? best.work_key[0] : undefined) ||
    (nonEmpty(best.key) && best.key.startsWith("/works/") ? best.key : undefined);

  try {
    if (nonEmpty(workKey)) {
      const res = await fetch(`https://openlibrary.org${workKey}.json`, {
        headers: { "User-Agent": UA },
      });
      if (res.ok) {
        const work = (await res.json()) as OpenLibraryWork;
        const desc = work?.description;
        let text: string | undefined;

        if (typeof desc === "string") text = desc;
        else if (desc && typeof (desc as { value?: string }).value === "string")
          text = (desc as { value?: string }).value;

        if (nonEmpty(text)) {
          const short = text.length > 280 ? text.slice(0, 277) + "…" : text;
          synopsisCache.set(key, short);
          return short;
        }
      }
    }
  } catch (err) {
    console.debug("fetchSynopsis error:", err);
  }

  synopsisCache.set(key, null);
  return undefined;
}

/* ------------------ NEW SECTION BELOW ----------------------- */
/* Genre/Author book-pool helpers for setup screen */

interface SubjectAuthor { name?: string }

interface SubjectWork {
  key?: string;                 // e.g. "/works/OL82563W"
  title?: string;
  authors?: SubjectAuthor[];
  cover_id?: number;            // numeric cover id
  first_publish_year?: number;  // e.g. 1954
}

interface SubjectResponse {
  works?: SubjectWork[];
  work_count?: number;
}

interface AuthorSearchDoc { key?: string }      // e.g. "OL23919A"
interface AuthorSearchResponse { docs?: AuthorSearchDoc[] }

interface AuthorWorksEntry {
  key?: string;                 // e.g. "/works/OL82563W"
  title?: string;
  covers?: number[];            // [8231856, ...]
  first_publish_date?: string | number; // "1954" or "1954-07-29"
  subjects?: string[];
}

interface AuthorWorksResponse { entries?: AuthorWorksEntry[] }

/** util: normalize to dedupe */
function keyOf(title: string, author: string) {
  return `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;
}

/** util: convert raw items to a de-duped, limited Book[] */
function toBookList(items: Array<Partial<SourceBook>>, limit = 50): SourceBook[] {
  const seen = new Set<string>();
  const result: SourceBook[] = [];
  for (const it of items) {
    const title = (it.title || "").trim();
    const author = (it.author || "").trim() || "Unknown";
    if (!title) continue;
    const k = keyOf(title, author);
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
export async function fetchSubjectBooks(subject: string, limit = 50, offset = 0): Promise<{ items: SourceBook[]; total: number; }> {
  const url = `https://openlibrary.org/subjects/${encodeURIComponent(subject)}.json?limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { items: [], total: 0 };
  const data = await res.json() as SubjectResponse;
  const works: SubjectWork[] = Array.isArray(data?.works) ? data.works : [];

  const items = works.map((w) => ({
    title: w.title,
    author: w.authors?.[0]?.name || "Unknown",
    workKey: w.key,             // "/works/OLxxxxW"
    coverId: w.cover_id,        // number
    year: w.first_publish_year, // number
  }));
  return { items: toBookList(items, limit), total: (data?.work_count ?? items.length) };
}

/** AUTHORS:
 *  1) search:  /search/authors.json?q=NAME
 *  2) works:   /authors/{key}/works.json?limit=200
 */
export async function fetchAuthorBooks(authorName: string, limit = 50): Promise<SourceBook[]> {
  const search = await fetch(
    `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(authorName)}`,
    { cache: "no-store" }
  );
  if (!search.ok) return [];
  const sdata = await search.json() as AuthorSearchResponse;
  const authorKey: string | undefined = sdata?.docs?.[0]?.key; // "OL23919A"
  if (!authorKey) return [];

  const works = await fetch(`https://openlibrary.org/authors/${authorKey}/works.json?limit=200`, {
    cache: "no-store",
  });
  if (!works.ok) return [];
  const wdata = (await works.json()) as AuthorWorksResponse;
   const entries: AuthorWorksEntry[] = Array.isArray(wdata?.entries) ? wdata.entries : [];

  const items = entries
    .filter((e) => !Array.isArray(e.subjects) || !e.subjects.some((s: string) =>
      /poetry|play|drama|letters|essays/i.test(s)
    ))
    .map((e) => ({
      title: e.title,
      author: authorName,
      workKey: e.key,              // "/works/OLxxxxW"
      coverId: Array.isArray(e.covers) ? e.covers[0] : undefined,
      year: e.first_publish_date ? parseInt(String(e.first_publish_date).slice(0,4)) : undefined,
    }));

  return toBookList(items, limit);
}

export function saveQueue(sourceBooks: SourceBook[]) {
  const mapped: Book[] = sourceBooks.map((b, i) => ({
    id: i + 1,
    title: b.title,
    author: b.author,
  }));
  localStorage.setItem("bookpickr:queue", JSON.stringify(mapped));
}

export function clearQueue() {
  localStorage.removeItem("bookpickr:queue");
}

// Functionality for the autocomplete author search 

// --- Author search -----------------------------------------------------------

export type AuthorHit = {
  key: string;        // "/authors/OL23919A"
  name: string;       // "George Orwell"
  top_work?: string;  // "1984"
  work_count?: number;
  birth_date?: string;
  death_date?: string;
};

const _authorCache = new Map<string, AuthorHit[]>();

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
  const cacheKey = `${q.toLowerCase()}|${limit}`;
  if (_authorCache.has(cacheKey)) return _authorCache.get(cacheKey)!;

  const url = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data: OpenLibraryAuthorResponse = await res.json();
  const hits: AuthorHit[] = (data.docs ?? []).map((d) => ({
    key: d.key,
    name: d.name,
    top_work: d.top_work,
    work_count: d.work_count,
    birth_date: d.birth_date,
    death_date: d.death_date,
  }));

  _authorCache.set(cacheKey, hits);
  return hits;
}



