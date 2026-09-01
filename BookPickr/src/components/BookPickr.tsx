// src/components/BookPickr.tsx
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import { BOOKS as STATIC_BOOKS } from "../data/books";
import type { Book } from "../types";
import BookCard from "./BookCard";
import { coverUrlFor, fetchCoverUrl, prefetchCover } from "../lib/openLibrary";
import { makeShareLink, parseShareLink } from "../lib/share";

// pick random index, avoiding an optional exclude (number or array)
function getRandomIndex(max: number, exclude?: number | number[]) {
  if (max < 2) return 0;
  const blocked = new Set(
    Array.isArray(exclude) ? exclude : exclude !== undefined ? [exclude] : []
  );
  // If everything is excluded there is no valid answer, and the old
  // `while (blocked.has(idx))` spun forever. Fall back to any index.
  if (blocked.size >= max) return Math.floor(Math.random() * max);

  let idx = Math.floor(Math.random() * max);
  while (blocked.has(idx)) idx = Math.floor(Math.random() * max);
  return idx;
}

/**
 * Pre-decide the next few challengers.
 *
 * This has to be decided in advance for prefetching to mean anything: warming
 * random covers is near-useless when the challenger is then drawn randomly
 * again, since the two almost never coincide.
 */
function buildQueue(poolLength: number, exclude: number[], depth: number): number[] {
  const blocked = new Set(exclude);
  const queue: number[] = [];
  for (let i = 0; i < depth && blocked.size < poolLength; i++) {
    const idx = getRandomIndex(poolLength, [...blocked]);
    blocked.add(idx);
    queue.push(idx);
  }
  return queue;
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

function loadPoolLabel(): { type: "subject" | "author"; value: string } | null {
  try {
    const raw = localStorage.getItem("bookpickr:poolLabel");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.debug("BookPickr: pool label parse error", e);
    return null;
  }
}

/** How many challengers to decide (and warm covers for) in advance. */
const QUEUE_DEPTH = 3;

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

  // Challengers already chosen for the rounds after this one. Their covers are
  // prefetched, so promoting one on a pick costs no network round trip.
  //
  // Held in a ref because `pick` needs to read and advance it in the same tick;
  // `queueVersion` is what tells the prefetch effect it changed.
  const upcomingRef = useRef<number[]>([]);
  const [queueVersion, setQueueVersion] = useState(0);

  const seedQueue = useCallback((poolLength: number, exclude: number[]) => {
    upcomingRef.current = buildQueue(poolLength, exclude, QUEUE_DEPTH);
    setQueueVersion((v) => v + 1);
  }, []);

  // scoreboard + rounds
  const [scores, setScores] = useState<Record<number, number>>({});
  const [rounds, setRounds] = useState(0);

  const [copied, setCopied] = useState<"idle" | "ok" | "err">("idle");

  // Derived: current books (guard against out-of-range)
  const champion = pool[championIndex] ?? pool[0];
  const challenger = pool[challengerIndex] ?? pool[1];

  // Covers. Most books carry a coverId, so the URL is known synchronously and
  // the browser starts downloading on the very first paint — no await, no
  // spinner, no waiting on a search request that used to cost ~500ms each.
  const [champCover, setChampCover] = useState<string | undefined>(() =>
    champion ? coverUrlFor(champion) : undefined
  );
  const [challCover, setChallCover] = useState<string | undefined>(() =>
    challenger ? coverUrlFor(challenger) : undefined
  );

  // When we navigate back from /setup (or first mount), reload pool and reset state
  useEffect(() => {
    const nextPool = loadQueueOrStatic();
    const nextLabel = loadPoolLabel();
    setPool(nextPool);
    setLabel(nextLabel);

    const first = nextPool.length >= 2 ? getRandomIndex(nextPool.length) : 0;
    const second = nextPool.length >= 2 ? getRandomIndex(nextPool.length, first) : 1;

    setChampionIndex(first);
    setChallengerIndex(second);
    seedQueue(nextPool.length, [first, second]);
    setScores({});
    setRounds(0);
  }, [location.key, seedQueue]);

  // On first render, if the URL carries a shared session (#s=...), restore it.
  // Guarded by a ref so a later pool change can't silently wipe the user's
  // in-progress session the way a [pool.length] dependency did.
  const restoredShare = useRef(false);
  useEffect(() => {
    if (restoredShare.current || pool.length < 2) return;

    const payload = parseShareLink();
    if (!payload) return;
    restoredShare.current = true;

    const safeChampion = Math.min(Math.max(payload.championIndex, 0), pool.length - 1);
    const safeScores: Record<number, number> = {};
    for (const [k, v] of Object.entries(payload.scores)) {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0 && i < pool.length && typeof v === "number") {
        safeScores[i] = v;
      }
    }

    const nextChallenger = getRandomIndex(pool.length, safeChampion);
    setChampionIndex(safeChampion);
    setChallengerIndex(nextChallenger);
    seedQueue(pool.length, [safeChampion, nextChallenger]);
    setScores(safeScores);
    setRounds(payload.rounds);
  }, [pool.length, seedQueue]);

  // Covers for the current pair. Sets the known URL synchronously and only
  // awaits for the rare book with no stored coverId.
  useEffect(() => {
    let alive = true;

    const apply = (book: Book | undefined, set: (u?: string) => void) => {
      if (!book) return;
      const direct = coverUrlFor(book);
      set(direct);
      if (direct) return;
      fetchCoverUrl(book).then((url) => {
        if (alive) set(url);
      });
    };

    apply(champion, setChampCover);
    apply(challenger, setChallCover);

    return () => {
      alive = false;
    };
  }, [champion, challenger]);

  // Warm the covers of the challengers we've already committed to showing, so
  // the next click paints from cache. Idle-time only, so it never competes
  // with the pair currently on screen.
  useEffect(() => {
    const upcoming = upcomingRef.current;
    if (!upcoming.length) return;

    const schedule =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 200);

    const handle = schedule(() => {
      for (const idx of upcoming) {
        const book = pool[idx];
        if (book) prefetchCover(book);
      }
    });

    return () => {
      if (typeof cancelIdleCallback === "function" && typeof handle === "number") {
        cancelIdleCallback(handle);
      }
    };
  }, [pool, queueVersion]);

  const pick = useCallback(
    (newChampionIndex: number) => {
      setScores((prev) => ({
        ...prev,
        [newChampionIndex]: (prev[newChampionIndex] || 0) + 1,
      }));
      setChampionIndex(newChampionIndex);

      // Promote the next pre-decided challenger (its cover is already warm),
      // then top the queue back up for the round after.
      const [head, ...rest] = upcomingRef.current;
      const next =
        head !== undefined && head !== newChampionIndex
          ? head
          : getRandomIndex(pool.length, newChampionIndex);

      upcomingRef.current = [
        ...rest,
        ...buildQueue(pool.length, [newChampionIndex, next, ...rest], QUEUE_DEPTH - rest.length),
      ];
      setQueueVersion((v) => v + 1);

      setChallengerIndex(next);
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
    const second = getRandomIndex(pool.length, first);
    setChampionIndex(first);
    setChallengerIndex(second);
    seedQueue(pool.length, [first, second]);
    setScores({});
    setRounds(0);
  }

  async function copyShareLink() {
    const link = makeShareLink({ v: 1, rounds, championIndex, scores });
    try {
      await navigator.clipboard.writeText(link);
      setCopied("ok");
      setTimeout(() => setCopied("idle"), 1500);
    } catch {
      setCopied("err");
      window.prompt("Copy this link:", link);
      setTimeout(() => setCopied("idle"), 1500);
    }
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
            <span
              className="badge"
              style={{ visibility: "hidden", pointerEvents: "none" }}
            >
              Source:{" "}
              {label.type === "subject"
                ? `Genre – ${label.value.replaceAll("_", " ")}`
                : `Author – ${label.value}`}
            </span>
          )}
        </div>

        {/* Right: controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge">Rounds: {rounds}</span>
          <button className="btn" onClick={reset}>Reset</button>
          <button className="btn" onClick={copyShareLink}>
            {copied === "ok" ? "Link copied ✓" : copied === "err" ? "Copy failed" : "Copy share link"}
          </button>
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
              priority
            />
            <BookCard
              book={challenger}
              onPick={() => pick(challengerIndex)}
              accent="right"
              coverUrl={challCover}
              priority
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
