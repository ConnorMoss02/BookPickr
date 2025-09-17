// src/components/BookPickr.tsx
import React, { useMemo, useState, useEffect } from "react";
import { BOOKS } from "../data/books";
import BookCard from "./BookCard";

function getRandomIndex(max: number, exclude?: number) {
  if (max < 2) return 0;
  let idx = Math.floor(Math.random() * max);
  while (idx === exclude) idx = Math.floor(Math.random() * max);
  return idx;
}

export default function BookPickr() {
  const [championIndex, setChampionIndex] = useState(() => getRandomIndex(BOOKS.length));
  const [challengerIndex, setChallengerIndex] = useState(() =>
    getRandomIndex(BOOKS.length, championIndex)
  );
  const [scores, setScores] = useState<Record<number, number>>({});
  const [rounds, setRounds] = useState(0);

  const champion = BOOKS[championIndex];
  const challenger = BOOKS[challengerIndex];

  function pick(newChampionIndex: number) {
    setScores((p) => ({ ...p, [newChampionIndex]: (p[newChampionIndex] || 0) + 1 }));
    setChampionIndex(newChampionIndex);
    setChallengerIndex(getRandomIndex(BOOKS.length, newChampionIndex));
    setRounds((r) => r + 1);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")  pick(championIndex);
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

  const leaderboard = useMemo(() =>
    [...Object.entries(scores)]
      .map(([idx, score]) => ({ idx: Number(idx), score: Number(score) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
  [scores]);

  return (
    <div className="container">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="h1">Book Pickr</h1>
        <div className="controls">
          <span className="badge">Rounds: {rounds}</span>
          <span className="badge" title="Keyboard shortcuts">
            <kbd>←</kbd> <kbd>→</kbd>
          </span>
          <button className="btn" onClick={reset}>Reset</button>
        </div>
      </header>

      <p className="muted" style={{ marginBottom: 16 }}>
        Pick the book you prefer. The winner stays; a new challenger appears.
      </p>

      <div className="pair">
        <BookCard book={champion} onPick={() => pick(championIndex)} accent="left" />
        <BookCard book={challenger} onPick={() => pick(challengerIndex)} accent="right" />
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
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>{BOOKS[idx].author}</p>
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
