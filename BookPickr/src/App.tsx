import { Link, NavLink, Route, Routes } from "react-router-dom";
import BookPickr from "./components/BookPickr";
import Setup from "./pages/Setup";

export default function App() {
  return (
    <div>
      <nav style={{ borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
        <div className="container" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link to="/" className="h1" style={{ textDecoration: "none" }}>BookPickr</Link>
          <NavLink to="/setup" className="btn">Setup</NavLink>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<BookPickr />} />
        <Route path="/setup" element={<Setup />} />
      </Routes>
    </div>
  );
}
