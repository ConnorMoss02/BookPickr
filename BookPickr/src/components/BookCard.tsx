// src/components/BookCard.tsx
import { useState } from "react";
import type { Book } from "../types";

type Props = {
  book: Book;
  onPick: () => void;
  accent: "left" | "right";
  coverUrl?: string;
  synopsis?: string;
};

export default function BookCard({
  book,
  onPick,
  accent,
  coverUrl,
  synopsis,
}: Props) {
  const [hover, setHover] = useState(false);
  const iconClass = accent === "left" ? "card-icon card-left" : "card-icon card-right";

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
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`${book.title} cover`}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }}
              loading="eager"
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
