import React, { useMemo, useState, useEffect } from "react";
import { BOOKS } from "../data/books";
import BookCard from "./BookCard";

/** two-col chooser; theme is in index.css */

/* pick random index, avoiding optional exclude */
function getRandomIndex(max: number, exclude?: number | number[]) {
  if (max < 2) return 0;
  const block = new Set(Array.isArray(exclude) ? exclude : exclude !== undefined ? [exclude] : []);
  let idx = Math.floor(Math.random() * max);
  while (block.has(idx)) idx = Math.floor(Math.random() * max);
  return idx;
}

/* ------- Open Library cover lookup ------- */
const coverCache = new Map<string, string>(); // key "title|author" -> url
async function fetchCoverUrl(title: string, author: string): Promise<string | undefined> {
  const key = `${title}|${author}`;
  if (coverCache.has(key)) return coverCache.get(key);

  try {
    const q = new URLSearchParams({ title, author, limit: "1" }).toString();
    const res = await fetch(`https://openlibrary.org/search.json?${q}`);
    if (!res.ok) return undefined;

    const data = await res.json();
    const doc = data?.docs?.[0];
    const coverId = doc?.cover_i;
    if (!coverId) return undefined;

    const url = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
    coverCache.set(key, url);
    return url;
  } catch {
    return undefined; // graceful fallback to 📚
  }
}

export default function BookPickr() {
  const [championIndex, setChampionIndex] = useState(() => getRandomIndex(BOOKS.length));
  const [challengerIndex, setChallengerIndex] = useState(() =>
    getRandomIndex(BOOKS.length, championIndex)
  );
  const [scores, setScores] = useState<Record<number, number>>({});
  const [rounds, setRounds] = useState(0);

  // cover URLs for current pair
  const [champCover, setChampCover] = useState<string>();
  const [challCover, setChallCover] = useState<string>();

  const champion = BOOKS[championIndex];
  const challenger = BOOKS[challengerIndex];

  // fetch covers for the current pair (with simple caching)
  useEffect(() => {
    let alive = true;
    (async () => {
      const [a, b] = await Promise.all([
        fetchCoverUrl(champion.title, champion.author),
        fetchCoverUrl(challenger.title, challenger.author),
      ]);
      if (!alive) return;
      setChampCover(a);
      setChallCover(b);
    })();
    return () => { alive = false; };
  }, [championIndex, challengerIndex]);

  function pick(newChampionIdx: number) {
    setScores((p) => ({ ...p, [newChampionIdx]: (p[newChampionIdx] || 0) + 1 }));
    setChampionIndex(newChampionIdx);
    setChallengerIndex(getRandomIndex(BOOKS.length, [newChampionIdx, challengerIndex]));
    setRounds((r) => r + 1);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") pick(championIndex);
      if (e.key === "ArrowRight") pick(challengerIndex);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [championIndex, challengerIndex]);

  function reset() {
    const first = getRandomIndex(BOOKS.length);
    setChampionIndex(first);
    setChallengerIndex(getRandomIndex(BOOKS.length, first));
    setScores({});
    setRounds(0);
  }

  const leaderboard = useMemo(() => {
    return [...Object.entries(scores)]
      .map(([idx, score]) => ({ idx: Number(idx), score: Number(score) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [scores]);

  return (
    <div className="container">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="h1">BookPickr</h1>
        <div className="controls">
          <span className="badge">Rounds: {rounds}</span>
          <span className="badge" title="Keyboard shortcuts"><kbd>←</kbd> <kbd>→</kbd></span>
          <button className="btn" onClick={reset}>Reset</button>
        </div>
      </header>

      <p className="muted" style={{ marginBottom: 16 }}>
        Pick the book you prefer. The winner stays; a new challenger appears.
      </p>

      <div className="pair">
        <BookCard book={champion} onPick={() => pick(championIndex)} accent="left"  coverUrl={champCover} />
        <BookCard book={challenger} onPick={() => pick(challengerIndex)} accent="right" coverUrl={challCover} />
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 className="h2">Top picks (so far)</h2>
        {leaderboard.length === 0 ? (
          <p className="muted">No results yet. Start picking!</p>
        ) : (
          <ul className="list">
            {leaderboard.map(({ idx, score }) => (
              <li key={idx}>
                <div>
                  <p style={{ fontWeight: 600, margin: 0 }}>{BOOKS[idx].title}</p>
                  <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>{BOOKS[idx].author}</p>
                </div>
                <span className="badge">{score} win{score === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
