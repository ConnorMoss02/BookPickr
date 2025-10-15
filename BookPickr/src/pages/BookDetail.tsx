import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

type Work = {
  title?: string;
  description?: string | { value?: string };
  subjects?: string[];
  covers?: number[];
};

function getText(d?: Work["description"]) {
  if (!d) return "";
  return typeof d === "string" ? d : (d.value ?? "");
}

export default function BookDetail() {
  const { workId } = useParams<{ workId: string }>();
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`https://openlibrary.org/works/${workId}.json`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Work = await res.json();
        if (alive) setWork(data);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [workId]);

  const cover = work?.covers?.[0] ? `https://covers.openlibrary.org/b/id/${work.covers[0]}-L.jpg` : undefined;

  return (
    <div className="container" style={{ padding: 20 }}>
      <Link to="/setup" className="btn">← Back</Link>

      {loading && <p className="muted" style={{ marginTop: 12 }}>Loading…</p>}
      {error && <p className="muted" style={{ marginTop: 12 }}>Couldn’t load this work. ({error})</p>}

      {!loading && !error && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div className="card-icon" style={{ width: 120, height: 120 }}>
              {cover
                ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                : "📚"}
            </div>
            <div>
              <h1 className="h1" style={{ margin: 0 }}>{work?.title ?? "Untitled"}</h1>
              {work?.subjects && (
                <p className="muted" style={{ margin: 0 }}>{work.subjects.slice(0, 6).join(" • ")}</p>
              )}
            </div>
          </div>

          {getText(work?.description) && <p style={{ marginTop: 16 }}>{getText(work?.description)}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Link to="/" className="btn">Pick against a random</Link>
          </div>
        </div>
      )}
    </div>
  );
}
