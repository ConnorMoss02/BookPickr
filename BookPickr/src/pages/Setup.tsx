import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { SourceBook } from "../types";
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
  const [genreBooks, setGenreBooks] = useState<SourceBook[]>([]);
  const [gLoading, setGLoading] = useState(false);
  const [gTotal, setGTotal] = useState(0);
  const [gPage, setGPage] = useState(0); // page as offset chunks of 50

  // author
  const [author, setAuthor] = useState("");
  const [authorBooks, setAuthorBooks] = useState<SourceBook[]>([]);
  const [aLoading, setALoading] = useState(false);

  const nav = useNavigate();

  // fetch genre list when subject or page changes
  useEffect(() => {
    let alive = true;
    (async () => {
      setGLoading(true);
      try {
        const { items, total } = await fetchSubjectBooks(subject, 20, gPage * 20);
        if (!alive) return;
        setGenreBooks(items);
        setGTotal(total);
      } finally {
        if (alive) setGLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [subject, gPage]);

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

  function applyQueue(books: SourceBook[]) {
    if (!books.length) return;
    saveQueue(books);
    nav("/"); // back to picker
  }

  function clearAndUseDefault() {
    clearQueue();
    nav("/");
  }

  function coverURL(b: SourceBook, size: "S" | "M" = "S") {
    return b.coverId ? `https://covers.openlibrary.org/b/id/${b.coverId}-${size}.jpg` : undefined;
  }

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <h1 className="h1">Picking your next book has never been easier</h1>
      <p className="muted">Pick a genre or author to seed your head-to-head matchups.</p>

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <button className="btn" onClick={() => setTab("genre")} aria-pressed={tab==="genre"}>By Genre</button>
        <button className="btn" onClick={() => setTab("author")} aria-pressed={tab==="author"}>By Author</button>
        <button className="btn" onClick={clearAndUseDefault}>Use NYT Top 100</button>
      </div>

      {tab === "genre" && (
        <section className="card" style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <label className="muted" htmlFor="subject">Subject</label>
            <select
              id="subject"
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setGPage(0); }}
              style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--panel)" }}
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}
            </select>
            <span className="badge">
              {gLoading ? "Loading…" : `Showing ${genreBooks.length} of ${gTotal.toLocaleString()}`}
            </span>
            <button className="btn" disabled={!genreBooks.length} onClick={() => applyQueue(genreBooks)}>
              Use these in BookPickr
            </button>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <button className="btn" onClick={() => setGPage(p => Math.max(0, p-1))} disabled={gPage===0 || gLoading}>Prev</button>
              <span className="badge">Page {gPage + 1}</span>
              <button className="btn" onClick={() => setGPage(p => p + 1)} disabled={gLoading || (genreBooks.length === 0)}>Next</button>
            </div>
          </div>

          {/* Scrollable preview list */}
          <ul className="list" style={{ maxHeight: 360, overflow: "auto" }}>
            {genreBooks.map(b => (
              <li key={b.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div className="card-icon" style={{ width: 40, height: 40 }}>
                  {coverURL(b) ? <img src={coverURL(b)!} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius: 8 }} /> : "📚"}
                </div>
                <div style={{ flex:1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{b.author}{b.year ? ` • ${b.year}` : ""}</div>
                </div>
                {b.workKey ? (
                  <Link to={`/book/${b.workKey.replace("/works/","")}`} className="btn">Preview</Link>
                ) : (
                  <button className="btn" disabled title="No details available">Preview</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "author" && (
        <section className="card" style={{ marginTop: 8 }}>
          <form onSubmit={onSearchAuthor} style={{ display: "flex", gap: 8, alignItems:"center", marginBottom: 12, flexWrap: "wrap" }}>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Search author (e.g., Agatha Christie)"
              style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--panel)", minWidth: 260 }}
            />
            <button className="btn" type="submit">Search</button>
            <span className="badge">{aLoading ? "Searching…" : `${authorBooks.length} books`}</span>
            <button className="btn" disabled={!authorBooks.length} onClick={() => applyQueue(authorBooks)}>
              Use these in BookPickr
            </button>
          </form>

          {/* Scrollable author results */}
          <ul className="list" style={{ maxHeight: 360, overflow: "auto" }}>
            {authorBooks.map(b => (
              <li key={b.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div className="card-icon" style={{ width: 40, height: 40 }}>
                  {b.coverId ? <img src={`https://covers.openlibrary.org/b/id/${b.coverId}-S.jpg`} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius: 8 }} /> : "📚"}
                </div>
                <div style={{ flex:1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{b.author}{b.year ? ` • ${b.year}` : ""}</div>
                </div>
                {b.workKey ? (
                  <Link to={`/book/${b.workKey.replace("/works/","")}`} className="btn">Preview</Link>
                ) : (
                  <button className="btn" disabled title="No details available">Preview</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}