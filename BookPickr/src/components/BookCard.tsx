// src/components/BookCard.tsx
import React from "react";
import type { Book } from "../types";

type Props = {
  book: Book;
  onPick: () => void;
  accent: "left" | "right";
};

export default function BookCard({ book, onPick, accent }: Props) {
  return (
    <button
      onClick={onPick}
      className="w-full rounded-2xl p-6 text-left shadow transition hover:shadow-lg focus:outline-none border"
      style={{ borderColor: accent === "left" ? "#93c5fd" : "#d8b4fe" }}
      aria-label={`Pick ${book.title} by ${book.author}`}
    >
      <div style={{ display: "flex", gap: 12 }}>
        <div
          style={{
            height: 56,
            width: 56,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            fontSize: 24,
            background: accent === "left" ? "#eff6ff" : "#faf5ff",
            border: "1px solid #eee",
            flexShrink: 0,
          }}
        >
          📚
        </div>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700 }}>{book.title}</h3>
          <p style={{ color: "#666", fontSize: 14 }}>{book.author}</p>
          <p style={{ marginTop: 8, color: "#888", fontSize: 12 }}>
            Click to pick this one
          </p>
        </div>
      </div>
    </button>
  );
}
