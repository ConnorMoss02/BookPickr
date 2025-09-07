// src/components/BookPickr.tsx
import React, { useMemo, useState, useEffect } from "react";
import { BOOKS } from "../data/books";
import BookCard from "./BookCard";

// Pick a random index, avoiding `exclude` so we don't show the same book twice.
function getRandomIndex(max: number, exclude?: number) {
  if (max < 2) return 0;
  let idx = Math.floor(Math.random() * max);
  while (idx === exclude) idx = Math.floor(Math.random() * max);
  return idx;
}

export default function BookPickr() {
  // championIndex: current winner (stays if picked again)
  const [championIndex, setChampionIndex] = useState(() =>
    getRandomIndex(BOOKS.length)
  );
  // challengerIndex: the opponent shown against the champion
  const [challengerIndex, setChallengerIndex] = useState(() =>
    getRandomIndex(BOOKS.length, championIndex)
  );
  // scores: map of bookIndex -> number of wins
  const [scores, setScores] = useState<Record<number, number>>({});
  // rounds: total picks made
  const [rounds, setRounds] = useState(0);

  const champion = BOOKS[championIndex];
  const challenger = BOOKS[challengerIndex];

  // When a book is picked: increment its score, make it champion, roll a new challenger
  function pick(newChampionIndex: number) {
    setScores((prev) => ({
      ...prev,
      [newChampionIndex]: (prev[newChampionIndex] || 0) + 1,
    }));
    setChampionIndex(newChampionIndex);
    setChallengerIndex(getRandomIndex(BOOKS.length, newChampionIndex));
    setRounds((r) => r + 1);
  }

  // Keyboard support: ← picks left (champion), → picks right (challenger)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") pick(championIndex);
      if (e.key === "ArrowRight") pick(challengerIndex);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [championIndex, challengerIndex]);

  // Reset to a fresh pair and clear scores
  function reset() {
    const first = getRandomIndex(BOOKS.length);
    setChampionIndex(first);
    setChallengerIndex(getRandomIndex(BOOKS.length, first));
    setScores({});
    setRounds(0);
  }

  // Build a small leaderboard from the scores map
  const leaderboard = useMemo(() => {
    return [...Object.entries(scores)]
      .map(([idx, score]) => ({ idx: Number(idx), score: Number(score) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [scores]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Book Pickr</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ border: "1px solid #eee", padding: "6px 10px", borderRadius: 999 }}>
            Rounds: {rounds}
          </span>
          <button
            onClick={reset}
            style={{ border: "1px solid #ddd", padding: "6px 10px", borderRadius: 999 }}
          >
            Reset
          </button>
        </div>
      </header>

      <p style={{ color: "#666", marginBottom: 16 }}>
        Click the book you prefer (or press ← / →). The winner stays; a new challenger appears.
      </p>

      <div style={{ display: "grid", gap: 16 }}>
        <BookCard book={champion} onPick={() => pick(championIndex)} accent="left" />
        <BookCard book={challenger} onPick={() => pick(challengerIndex)} accent="right" />
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Top picks (so far)</h2>
        {leaderboard.length === 0 ? (
          <p style={{ color: "#666" }}>No results yet. Start picking!</p>
        ) : (
          <ul style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            {leaderboard.map(({ idx, score }) => (
              <li
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderTop: "1px solid #f4f4f4",
                }}
              >
                <div>
                  <p style={{ fontWeight: 600 }}>{BOOKS[idx].title}</p>
                  <p style={{ fontSize: 12, color: "#777" }}>{BOOKS[idx].author}</p>
                </div>
                <span style={{ background: "#f6f6f6", borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>
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
