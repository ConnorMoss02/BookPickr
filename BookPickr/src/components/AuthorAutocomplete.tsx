import { useEffect, useRef, useState, type CSSProperties } from "react";
import { searchAuthors, type AuthorHit } from "../lib/openLibrary";

type Props = {
  value: string;
  onChange: (v: string) => void;               // text in the input
  onPick: (author: AuthorHit) => void;         // user chose an author
  placeholder?: string;
  
  inputClassName?: string;
  inputStyle?: CSSProperties;
};

export default function AuthorAutocomplete({ value, onChange, onPick, placeholder = "Search author", inputClassName = "input-pill", inputStyle, }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AuthorHit[]>([]);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the query
  const debounced = useDebounced(value, 180);
  const query = debounced.value;

  // Choosing an author writes their name into the input, which looks exactly
  // like typing and would re-run the lookup and pop the menu straight back
  // open.
  //
  // Rather than a "skip the next pass" flag, remember *which name* came from a
  // selection and suppress only while the box still holds exactly that. A flag
  // has to be cleared by some later event, and any event you pick can fail to
  // arrive — leaving it stuck and silently swallowing the next search. This
  // compares state instead, so it cannot wedge.
  const selectedName = useRef<string | null>(null);

  useEffect(() => {
    if (selectedName.current !== null && query.trim() === selectedName.current.trim()) {
      setLoading(false);
      setOpen(false);
      return;
    }

    let alive = true;
    (async () => {
      const q = query.trim();
      if (!q) {
        setResults([]); setOpen(false);
        return;
      }
      setLoading(true);
      const hits = await searchAuthors(q, 8);
      // A lookup already in flight when the user picked must not reopen the
      // menu underneath them.
      if (!alive || query.trim() === selectedName.current?.trim()) return;
      setResults(hits);
      setOpen(hits.length > 0);
      setHighlight(0);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [debounced, query]);

  // close when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(idx: number) {
    const hit = results[idx];
    if (!hit) return;
    selectedName.current = hit.name ?? "";
    setOpen(false);
    // Picking an author is the search: nobody selects a name and then wants
    // to press Enter to confirm it.
    onPick(hit);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(results.length > 0);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && results[highlight]) {
        e.preventDefault();
        choose(highlight);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          // A real edit means the text is the user's again, not the
          // selection's — so retyping the same name still opens the menu.
          selectedName.current = null;
          onChange(e.target.value);
        }}
        onFocus={() => { if (value.trim() !== selectedName.current?.trim()) setOpen(results.length > 0); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "Search author (e.g., Octavia Butler)"}
        className={inputClassName}  
        style={{width: "100%",...inputStyle, } }
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="author-ac-list"
        role="combobox"
      />
      {loading && <span className="muted" style={{ position: "absolute", right: 10, top: 10, fontSize: 12 }}>Searching…</span>}

      {open && (
        <ul
          id="author-ac-list"
          role="listbox"
          className="menu"
          style={{
            position: "absolute",
            top: "100%", left: 0, right: 0,
            marginTop: 6, maxHeight: 280, overflowY: "auto",
            background: "#fffaf2", border: "1px solid #e6d9c6",
            borderRadius: 12, padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,.08)", zIndex: 50,
          }}
        >
          {results.map((r, i) => (
            <li
              key={r.key}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(i); }} // prevent blur before click
              style={{
                display: "flex", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 10,
                background: i === highlight ? "#f4e7d4" : "transparent",
                cursor: "pointer",
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontWeight: 700, color: "#2a1e14" }}>{r.name}</div>
                <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.top_work ? `${r.top_work}` : "—"}
                  {typeof r.work_count === "number" ? ` • ${r.work_count} works` : ""}
                </div>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                {r.birth_date ?? ""}{r.death_date ? `–${r.death_date}` : ""}
              </span>
            </li>
          ))}
          {results.length === 0 && !loading && (
            <li className="muted" style={{ padding: 10 }}>No authors found.</li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Debounce that reports every settle, not just every change.
 *
 * Returning the bare value means a round trip — clear the field and retype the
 * same name inside the debounce window — lands on the value React already
 * holds. It bails out of the update, the effect never re-runs, and the search
 * silently never happens. The counter makes each settle a distinct object, so
 * consumers see it even when the text is unchanged.
 */
function useDebounced<T>(value: T, delay = 200): { value: T; seq: number } {
  const [settled, setSettled] = useState({ value, seq: 0 });
  useEffect(() => {
    const t = setTimeout(() => setSettled((s) => ({ value, seq: s.seq + 1 })), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return settled;
}
