import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Book } from "../types";
import { fetchSubjectBooks, fetchAuthorBooks, saveQueue, clearQueue } from "../lib/openLibrary";

const SUBJECTS = [
  "dystopian","science_fiction","fantasy","mystery","romance",
  "historical_fiction","horror","classics","literature","young_adult",
];

type Tab = "genre" | "author";

export default function Setup() {
  const [tab, setTab] = useState<Tab>("genre");

  // genre
  const [subject, setSubject] = useState("dystopian");
  const [genreBooks, setGenreBooks] = useState<Book[]>([]);
  const [gLoading, setGLoading] = useState(false);

  // author
  const [author, setAuthor] = useState("");
  const [authorBooks, setAuthorBooks] = useState<Book[]>([]);
  const [aLoading, setALoading] = useState(false);

  const nav = useNavigate();

  // fetch genre list when subject changes
  useEffect(() => {
    let alive = true;
    (async () => {
      setGLoading(true);
      try {
        const books = await fetchSubjectBooks(subject, 50);
        if (!alive) return;
        setGenreBooks(books);
      } finally {
        if (alive) setGLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [subject]);

  async function onSearchAuthor(e: React.FormEvent) {
    e.preventDefault();
    setALoading(true);
    try {
      const books = await fetchAuthorBooks(author, 50);
      setAuthorBooks(books);
    } finally {
      setALoading(false);
    }
  }

  function applyToPickr(books: Book[]) {
    if (!books.length) return;
    saveQueue(books);
    nav("/"); // back to picker
  }

  function clearAndUseDefault() {
    clearQueue();
    nav("/");
  }

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <h1 className="h1">Setup</h1>
      <p className="muted">Choose a genre or author to seed the BookPickr pool. You can always reset to the default 100.</p>

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <button className="btn" onClick={() => setTab("genre")} aria-pressed={tab==="genre"}>By Genre</button>
        <button className="btn" onClick={() => setTab("author")} aria-pressed={tab==="author"}>By Author</button>
        <button className="btn" onClick={clearAndUseDefault}>Use Default 100</button>
      </div>

      {tab === "genre" && (
        <section className="card" style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <label className="muted" htmlFor="subject">Subject</label>
            <select
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--panel)" }}
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}
            </select>
            <span className="badge">{gLoading ? "Loading…" : `${genreBooks.length} books`}</span>
            <button className="btn" disabled={!genreBooks.length} onClick={() => applyToPickr(genreBooks)}>
              Use these in BookPickr
            </button>
          </div>
          <ul className="list">
            {genreBooks.slice(0,10).map(b => (
              <li key={b.id} style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{b.title} <span className="muted">• {b.author}</span></span>
                <span className="badge">preview</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "author" && (
        <section className="card" style={{ marginTop: 8 }}>
          <form onSubmit={onSearchAuthor} style={{ display: "flex", gap: 8, alignItems:"center", marginBottom: 12 }}>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Search author (e.g., Agatha Christie)"
              style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--panel)", minWidth: 260 }}
            />
            <button className="btn" type="submit">Search</button>
            <span className="badge">{aLoading ? "Searching…" : `${authorBooks.length} books`}</span>
            <button className="btn" disabled={!authorBooks.length} onClick={() => applyToPickr(authorBooks)}>
              Use these in BookPickr
            </button>
          </form>
          <ul className="list">
            {authorBooks.slice(0,10).map(b => (
              <li key={b.id} style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{b.title} <span className="muted">• {b.author}</span></span>
                <span className="badge">preview</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
