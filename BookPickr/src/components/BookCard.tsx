// src/components/BookCard.tsx
import { useEffect, useState } from "react";
import type { Book } from "../types";
import { fetchSynopsis } from "../lib/openLibrary";

type Props = {
  book: Book;
  onPick: () => void;
  accent: "left" | "right";
  coverUrl?: string;
  /** Set once the pair has settled, so we don't decode covers we're replacing. */
  priority?: boolean;
};

export default function BookCard({ book, onPick, accent, coverUrl, priority = false }: Props) {
  const [hover, setHover] = useState(false);
  const [synopsis, setSynopsis] = useState<string>();
  const [coverFailed, setCoverFailed] = useState(false);

  const iconClass = accent === "left" ? "card-icon card-left" : "card-icon card-right";

  // A new cover url means a new book in this slot — clear the failure flag so
  // the next book still gets a chance to show its cover.
  useEffect(() => setCoverFailed(false), [coverUrl]);

  // The synopsis is only ever visible inside the hover tooltip, so there's no
  // reason to pay for it up front. Fetching here turned two guaranteed
  // requests per round into zero for anyone who doesn't hover.
  useEffect(() => {
    if (!hover) return;
    let alive = true;
    (async () => {
      const text = await fetchSynopsis(book);
      if (alive) setSynopsis(text);
    })();
    return () => {
      alive = false;
    };
  }, [hover, book]);

  // Reset when the slot switches books, so we never show the previous
  // book's blurb under the new one's title.
  useEffect(() => setSynopsis(undefined), [book.id, book.title]);

  const showCover = coverUrl && !coverFailed;

  return (
    <div style={{ position: "relative" }}>
      <button
        className="card"
        onClick={onPick}
        aria-label={`Pick ${book.title} by ${book.author}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 16,
          background: "#fffef8",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          className={iconClass}
          style={{
            width: 80,
            height: 80,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {showCover ? (
            <img
              src={coverUrl}
              alt={`${book.title} cover`}
              // Intrinsic size matches the slot: no layout shift when it lands,
              // and the browser never decodes a full-size image for an 80px box.
              width={80}
              height={80}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : "auto"}
              onError={() => setCoverFailed(true)}
            />
          ) : (
            "📚"
          )}
        </div>

        <div>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{book.title}</h3>
          <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>
            {book.author}
          </p>
          <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
            Click to pick this one
          </p>
        </div>
      </button>

      {/* Hover/focus synopsis tooltip */}
      {hover && (synopsis || "").trim() !== "" && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "100%",
            left: accent === "left" ? 0 : "auto",
            right: accent === "right" ? 0 : "auto",
            marginTop: 8,
            maxWidth: 420,
            background: "var(--panel, #fff9ed)",
            color: "var(--text, #2a2a2a)",
            border: "1px solid var(--border, #e5dec9)",
            borderRadius: 12,
            padding: "10px 12px",
            boxShadow: "0 2px 8px rgba(0,0,0,.08)",
            zIndex: 5,
          }}
        >
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{synopsis}</div>
        </div>
      )}
    </div>
  );
}
