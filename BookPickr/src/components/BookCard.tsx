import React from "react";
import type { Book } from "../types";

// Props tell this component which book to show, what to do when clicked,
// and which side it's on (for subtle styling).
type Props = {
  book: Book;
  onPick: () => void;
  accent: "left" | "right";
};

export default function BookCard({ book, onPick, accent }: Props) {
  return (
    // Button makes the whole card clickable
    <button
      onClick={onPick}
      // Keep styles simple; you can replace with Tailwind or CSS later
      className={`w-full rounded-2xl p-16 text-left shadow transition hover:shadow-lg focus:outline-none ${
        accent === "left" ? "border-blue-300" : "border-purple-300"
      } border`}
      aria-label={`Pick ${book.title} by ${book.author}`}
    >
      <div>
        <div style={{ fontSize: 40, lineHeight: 1 }}>📚</div>
        <h3 style={{ marginTop: 12, fontWeight: 700, fontSize: 20 }}>{book.title}</h3>
        <p style={{ color: "#666", fontSize: 14 }}>{book.author}</p>
        <p style={{ marginTop: 8, color: "#888", fontSize: 12 }}>Click to pick this one</p>
      </div>
    </button>
  );
}
