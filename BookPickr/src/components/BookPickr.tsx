// src/components/BookPickr.tsx
import { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { BOOKS as STATIC_BOOKS } from "../data/books";
import type { Book } from "../types";
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

function loadQueueOrStatic(): Book[] {
  try {
    const raw = localStorage.getItem("bookpickr:queue");
    if (raw) {
      const arr = JSON.parse(raw) as Book[];
      if (Array.isArray(arr) && arr.length > 1) return arr;
    }
  } catch (e) {
    console.debug("BookPickr: localStorage parse error", e);
  }
  return STATIC_BOOKS;
}

function loadPoolLabel():
  | { type: "subject" | "author"; value: string }
  | null {
  try {
    const raw = localStorage.getItem("bookpickr:poolLabel");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.debug("BookPickr: pool label parse error", e);
    return null;
  }
}

export default function BookPickr() {
  const location = useLocation();

  // Active pool + label
  const [pool, setPool] = useState<Book[]>(() => loadQueueOrStatic());
  const [label, setLabel] = useState<{ type: "subject" | "author"; value: string } | null>(() =>
    loadPoolLabel()
  );

  // indices for current pair (init to a safe pair; will be randomized on mount/route change)
  const [championIndex, setChampionIndex] = useState(0);
  const [challengerIndex, setChallengerIndex] = useState(1);

  // scoreboard + rounds
  const [scores, setScores] = useState<Record<number, number>>({});
  const [rounds, setRounds] = useState(0);

  // cover + synopsis for current pair
  const [champCover, setChampCover] = useState<string>();
  const [challCover, setChallCover] = useState<string>();
  const [champSynopsis, setChampSynopsis] = useState<string>();
  const [challSynopsis, setChallSynopsis] = useState<string>();

  // When we navigate back from /setup (or first mount), reload pool and reset state
  useEffect(() => {
    const nextPool = loadQueueOrStatic();
    const nextLabel = loadPoolLabel();
    setPool(nextPool);
    setLabel(nextLabel);

    const first =
      nextPool.length >= 2 ? getRandomIndex(nextPool.length) : 0;
    const second =
      nextPool.length >= 2 ? getRandomIndex(nextPool.length, first) : 1;

    setChampionIndex(first);
    setChallengerIndex(second);
    setScores({});
    setRounds(0);
  }, [location.key]);

  // Derived: current books (guard against out-of-range)
  const champion = pool[championIndex] ?? pool[0];
  const challenger = pool[challengerIndex] ?? pool[1];

  // covers
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!champion || !challenger) return;
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
  }, [
    championIndex,
    challengerIndex,
    champion,
    challenger,
  ]);

  // synopses
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!champion || !challenger) return;
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
  }, [
    championIndex,
    challengerIndex,
    champion,
    challenger,
  ]);

  const pick = useCallback(
    (newChampionIndex: number) => {
      setScores((prev) => ({
        ...prev,
        [newChampionIndex]: (prev[newChampionIndex] || 0) + 1,
      }));
      setChampionIndex(newChampionIndex);
      setChallengerIndex(() => getRandomIndex(pool.length, newChampionIndex));
      setRounds((r) => r + 1);
    },
    [pool.length]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") pick(championIndex);
      if (e.key === "ArrowRight") pick(challengerIndex);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [championIndex, challengerIndex, pick]);

  function reset() {
    const first = getRandomIndex(pool.length);
    setChampionIndex(first);
    setChallengerIndex(getRandomIndex(pool.length, first));
    setScores({});
    setRounds(0);
  }

  const leaderboard = useMemo(() => {
    return [...Object.entries(scores)]
      .map(([idx, score]) => ({ idx: Number(idx), score: Number(score) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [scores]);

  // UI guard instead of early return (keeps Hooks order intact)
  const notEnough = pool.length < 2;

  return (
    <div className="container">
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* Left: active pool label + setup link */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {label && (
            <span className="badge">
              Source:{" "}
              {label.type === "subject"
                ? `Genre – ${label.value.replaceAll("_", " ")}`
                : `Author – ${label.value}`}
            </span>
          )}
          <Link to="/setup" className="btn">Setup</Link>
        </div>

        {/* Right: controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge">Rounds: {rounds}</span>
          <span className="badge" title="Keyboard shortcuts">
            <kbd>←</kbd> <kbd>→</kbd>
          </span>
          <button className="btn" onClick={reset}>Reset</button>
        </div>
      </header>

      {notEnough ? (
        <div style={{ paddingTop: 24 }}>
          <p className="muted" style={{ marginBottom: 12 }}>
            Not enough books in this selection. Pick a genre or author with at least 2 books.
          </p>
          <Link to="/setup" className="btn">Choose books</Link>
        </div>
      ) : (
        <>
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
                      <p style={{ fontWeight: 600, margin: 0 }}>{pool[idx].title}</p>
                      <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
                        {pool[idx].author}
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
        </>
      )}
    </div>
  );
}
