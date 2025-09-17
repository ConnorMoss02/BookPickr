// src/components/BookCard.tsx
import React from "react";
import type { Book } from "../types";

type Props = {
  book: Book;
  onPick: () => void;
  accent: "left" | "right";
  coverUrl?: string; // cover image from OpenLibrary
};

export default function BookCard({ book, onPick, accent, coverUrl }: Props) {
  const iconClass = accent === "left" ? "card-icon card-left" : "card-icon card-right";

  return (
    <button
      className="card"
      onClick={onPick}
      aria-label={`Pick ${book.title} by ${book.author}`}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 16,
        background: "#fffef8",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {/* Book cover / icon */}
      <div
        className={iconClass}
        style={{
          width: 80,
          height: 80,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          background: accent === "left" ? "#f0f4ff" : "#faf5ff",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={`${book.title} cover`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 12,
            }}
            loading="eager"
          />
        ) : (
          "📚"
        )}
      </div>

      {/* Book info */}
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
  );
}
