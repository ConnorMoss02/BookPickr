// Resolves each static book to an Open Library workKey + coverId once, at build
// time, so the running app never has to hit search.json for the default pool.
//
//   node scripts/backfill-covers.mjs
//
// Rewrites src/data/books.ts in place. Re-run it if the book list changes.

import { readFile, writeFile } from "node:fs/promises";

const SRC = new URL("../src/data/books.ts", import.meta.url);
const UA = "BookPickr/2.0 (contact: conmoss30@gmail.com)";

const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pick the doc that best matches the title/author we asked for. */
function bestMatch(docs, title, author) {
  const wantTitle = norm(title);
  const wantAuthor = norm(author);

  return docs
    .map((d) => {
      const t = norm(d.title ?? "");
      const a = norm(d.author_name?.[0] ?? "");
      let score = 0;
      if (t === wantTitle) score += 4;
      else if (t.startsWith(wantTitle)) score += 2;
      if (a === wantAuthor) score += 3;
      else if (a.includes(wantAuthor) || wantAuthor.includes(a)) score += 1;
      if (typeof d.cover_i === "number") score += 2;
      // Prefer the canonical edition over the long tail of reprints and
      // translations: a work with more editions is the one people mean.
      score += Math.min(d.edition_count ?? 0, 50) / 100;
      return { d, score };
    })
    .sort((x, y) => y.score - x.score)[0]?.d;
}

async function resolve(title, author) {
  const params = new URLSearchParams({
    title,
    author,
    limit: "10",
    language: "eng",
    fields: "title,author_name,cover_i,key,edition_count",
  });

  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;

  const { docs } = await res.json();
  const best = bestMatch(Array.isArray(docs) ? docs : [], title, author);
  if (!best) return null;

  return {
    workKey: typeof best.key === "string" ? best.key : undefined,
    coverId: typeof best.cover_i === "number" ? best.cover_i : undefined,
  };
}

const source = await readFile(SRC, "utf8");

// Match the literal entries so we can rewrite each one in place, preserving
// whatever ordering and escaping the file already uses.
const entry = /\{\s*id:\s*(\d+),\s*title:\s*"((?:[^"\\]|\\.)*)",\s*author:\s*"((?:[^"\\]|\\.)*)"[^}]*\}/g;
const books = [...source.matchAll(entry)].map((m) => ({
  raw: m[0],
  id: Number(m[1]),
  title: JSON.parse(`"${m[2]}"`),
  author: JSON.parse(`"${m[3]}"`),
}));

if (!books.length) {
  console.error("No book entries matched — is src/data/books.ts still an array of literals?");
  process.exit(1);
}

console.log(`Resolving ${books.length} books against Open Library…`);

let out = source;
let hits = 0;

for (const b of books) {
  let meta = null;
  try {
    meta = await resolve(b.title, b.author);
  } catch (err) {
    console.warn(`  ! ${b.title}: ${err.message}`);
  }

  const parts = [`id: ${b.id}`, `title: ${JSON.stringify(b.title)}`, `author: ${JSON.stringify(b.author)}`];
  if (meta?.workKey) parts.push(`workKey: ${JSON.stringify(meta.workKey)}`);
  if (meta?.coverId) parts.push(`coverId: ${meta.coverId}`);

  if (meta?.coverId) hits++;
  console.log(`  ${meta?.coverId ? "✓" : "·"} ${b.title}`);

  out = out.replace(b.raw, `{ ${parts.join(", ")} }`);

  // Open Library asks for a light touch on bulk reads.
  await sleep(120);
}

await writeFile(SRC, out, "utf8");
console.log(`\nDone — ${hits}/${books.length} books now carry a cover id.`);
