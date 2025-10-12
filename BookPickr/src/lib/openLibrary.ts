// src/lib/openLibrary.ts

// Be polite if you ever call these server-side. In browsers, this header is ignored.
// Replace the email with yours if you proxy through a server.
const UA = "BookPickr/0.1 (contact: conmoss30@gmail.com)";

/* ----------------------- Types ----------------------- */

interface OpenLibrarySearchResponse {
  docs: OpenLibraryDoc[];
}

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];   // array of author names
  cover_i?: number;         // cover id
  isbn?: string[];          // list of ISBNs
  key?: string;             // sometimes /works/… when searching works; not guaranteed
  work_key?: string[];      // array of work keys like "/works/OLxxxxW"
  edition_key?: string[];   // not used here but present in results
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
    fields: "title,author_name,cover_i,isbn,key,work_key,edition_key",
  }).toString();

  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    // Browsers will ignore User-Agent; harmless to include.
    headers: { "User-Agent": UA },
  });

  if (!res.ok) return [];
  const data: unknown = await res.json();

  // Type-safe parse
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

export async function fetchCoverUrl(
  title: string,
  author: string
): Promise<string | undefined> {
  const key = `${title}|${author}`;
  const cached = coverCache.get(key);
  if (cached) return cached;

  const ranked = scoreDocs(await searchDocs(title, author), title, author);
  const best = ranked[0];
  if (!best) return undefined;

  // Prefer cover_i first (this was your original behavior)
  const candidates: string[] = [];
  if (typeof best.cover_i === "number") {
    candidates.push(
      `https://covers.openlibrary.org/b/id/${best.cover_i}-L.jpg?default=false`,
      `https://covers.openlibrary.org/b/id/${best.cover_i}-M.jpg?default=false`
    );
  }

  // Then try a few ISBNs (both sizes)
  const isbns = Array.isArray(best.isbn) ? best.isbn.slice(0, 3) : [];
  for (const isbn of isbns) {
    candidates.push(
      `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
      `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`
    );
  }

  // Pick the first one that loads; we’ll trust the <img> tag’s onError to filter bad ones
  // and store the “clean” URL without the query.
  for (const u of candidates) {
    const clean = u.replace("?default=false", "");
    // Don’t try to HEAD (can be CORS-blocked); just return the first candidate and let <img onError> handle it.
    coverCache.set(key, clean);
    return clean;
  }

  return undefined;
}

export async function fetchSynopsis(title: string, author: string): Promise<Maybe<string>> {
  const key = `${title}|${author}`;
  if (synopsisCache.has(key)) {
    const v = synopsisCache.get(key);
    return v ?? undefined;
  }

  const ranked = scoreDocs(await searchDocs(title, author), title, author);
  const best = ranked[0];
  if (!best) {
    synopsisCache.set(key, null);
    return undefined;
  }

  // Prefer a work key if present
  const workKey =
    (Array.isArray(best.work_key) ? best.work_key[0] : undefined) ||
    (nonEmpty(best.key) && best.key.startsWith("/works/") ? best.key : undefined);

  try {
    if (nonEmpty(workKey)) {
      const res = await fetch(`https://openlibrary.org${workKey}.json`, {
        headers: { "User-Agent": UA },
      });
      if (res.ok) {
        const workRaw: unknown = await res.json();

        // Narrow to OpenLibraryWork
        const work = workRaw as OpenLibraryWork;
        const desc = work?.description;

        let text: string | undefined;
        if (typeof desc === "string") {
          text = desc;
        } else if (desc && typeof (desc as { value?: string }).value === "string") {
          text = (desc as { value?: string }).value;
        }

        if (nonEmpty(text)) {
          const short = text.length > 280 ? text.slice(0, 277) + "…" : text;
          synopsisCache.set(key, short);
          return short;
        }
      }
    }
  } catch {
    // network or parse error: fall through to cache null
  }

  synopsisCache.set(key, null);
  return undefined;
}
