// src/components/BookCard.tsx
import React from "react";
import type { Book } from "../types";

type Props = { book: Book; onPick: () => void; accent: "left" | "right"; };

export default function BookCard({ book, onPick, accent }: Props) {
  const iconClass = accent === "left" ? "card-icon card-left" : "card-icon card-right";
  return (
    <button className="card" onClick={onPick} aria-label={`Pick ${book.title} by ${book.author}`}>
      <div className="card-head">
        <div className={iconClass}>📚</div>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{book.title}</h3>
          <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>{book.author}</p>
          <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>Click to pick this one</p>
        </div>
      </div>
    </button>
  );
}
