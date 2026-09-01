import { lazy, Suspense } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import BookPickr from "./components/BookPickr";

// The picker is the landing route, so it stays in the main bundle. Setup and
// the detail page are only reachable by navigation — splitting them keeps
// their code (and the autocomplete) out of the initial download.
const Setup = lazy(() => import("./pages/Setup"));
const BookDetail = lazy(() => import("./pages/BookDetail"));

export default function App() {
  const location = useLocation();
  const onSetupPage = location.pathname.startsWith("/setup");

  return (
    <div>
      <nav className="site-nav">
        <NavLink to="/" end className="brand">BookPickr</NavLink>

        {/* Only show the Setup link when NOT on /setup */}
        {!onSetupPage && (
          <NavLink
            to="/setup"
            className="chip"
            // Start downloading the setup chunk on hover, so the click feels
            // instant rather than showing the fallback.
            onMouseEnter={() => void import("./pages/Setup")}
          >
            Setup
          </NavLink>
        )}

        <div style={{ marginLeft: "auto" }} />
      </nav>

      <main>
        <Suspense fallback={<div className="container" style={{ paddingTop: 20 }}><p className="muted">Loading…</p></div>}>
          <Routes>
            <Route path="/" element={<BookPickr />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/book/:workId" element={<BookDetail />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
