// src/components/BookPickr.tsx
import { useMemo, useState, useEffect } from "react";
import { BOOKS } from "../data/books";
import BookCard from "./BookCard";
import { fetchCoverUrl, fetchSynopsis } from "../lib/openLibrary";

// pick random index, avoiding an optional exclude (number or array)
function getRandomIndex(max: number, exclude?: number | number[]) {
  if (max < 2) return 0;
  const blocked = new Set(
    Array.isArray(exclude) ? exclude : exclude !== undefined ? [exclude] : []
  );
  let idx = Math.floor(Math.random() * max);
  while (blocked.has(idx)) idx = Math.floor(Math.random() * max);
  return idx;
}

export default function BookPickr() {
  // indices for current pair
  const [championIndex, setChampionIndex] = useState(() =>
    getRandomIndex(BOOKS.length)
  );
  const [challengerIndex, setChallengerIndex] = useState(() =>
    getRandomIndex(BOOKS.length, championIndex)
  );

  // scoreboard + rounds
  const [scores, setScores] = useState<Record<number, number>>({});
  const [rounds, setRounds] = useState(0);

  // cover + synopsis for current pair
  const [champCover, setChampCover] = useState<string>();
  const [challCover, setChallCover] = useState<string>();
  const [champSynopsis, setChampSynopsis] = useState<string>();
  const [challSynopsis, setChallSynopsis] = useState<string>();

  const champion = BOOKS[championIndex];
  const challenger = BOOKS[challengerIndex];

  // covers
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
    return () => {
      alive = false;
    };
  }, [championIndex, challengerIndex]);

  // synopses
  useEffect(() => {
    let alive = true;
    (async () => {
      const [sa, sb] = await Promise.all([
        fetchSynopsis(champion.title, champion.author),
        fetchSynopsis(challenger.title, challenger.author),
      ]);
      if (!alive) return;
      setChampSynopsis(sa);
      setChallSynopsis(sb);
    })();
    return () => {
      alive = false;
    };
  }, [championIndex, challengerIndex]);

  function pick(newChampionIndex: number) {
    setScores((prev) => ({
      ...prev,
      [newChampionIndex]: (prev[newChampionIndex] || 0) + 1,
    }));
    setChampionIndex(newChampionIndex);
    setChallengerIndex(getRandomIndex(BOOKS.length, [newChampionIndex, challengerIndex]));
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
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 className="h1">Book Pickr</h1>
        <div className="controls">
          <span className="badge">Rounds: {rounds}</span>
          <span className="badge" title="Keyboard shortcuts">
            <kbd>←</kbd> <kbd>→</kbd>
          </span>
          <button className="btn" onClick={reset}>
            Reset
          </button>
        </div>
      </header>

      <p className="muted" style={{ marginBottom: 16 }}>
        Pick the book you prefer. The winner stays; a new challenger appears.
      </p>

      <div className="pair">
        <BookCard
          book={champion}
          onPick={() => pick(championIndex)}
          accent="left"
          coverUrl={champCover}
          synopsis={champSynopsis}
        />
        <BookCard
          book={challenger}
          onPick={() => pick(challengerIndex)}
          accent="right"
          coverUrl={challCover}
          synopsis={challSynopsis}
        />
      </div>

      <section style={{ marginTop: 72 }}>
        <h2 className="h2">Top picks (so far)</h2>
        {leaderboard.length === 0 ? (
          <p className="muted">No results yet. Start picking!</p>
        ) : (
          <ul className="list">
            {leaderboard.map(({ idx, score }) => (
              <li key={idx}>
                <div>
                  <p style={{ fontWeight: 600, margin: 0 }}>{BOOKS[idx].title}</p>
                  <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
                    {BOOKS[idx].author}
                  </p>
                </div>
                <span className="badge">
                  {score} win{score === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
