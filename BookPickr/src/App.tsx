import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import BookPickr from "./components/BookPickr";
import Setup from "./pages/Setup";
import BookDetail from "./pages/BookDetail"; 

export default function App() {
  const location = useLocation();
  const onSetupPage = location.pathname.startsWith("/setup");

  return (
    <div>
      <nav className="site-nav">
        <NavLink to="/" end className="brand">BookPickr</NavLink>

        {/* Only show the Setup link when NOT on /setup */}
        {!onSetupPage && (
          <NavLink to="/setup" className="chip">Setup</NavLink>
        )}

        <div style={{ marginLeft: "auto" }} />
        {/* (optional) other nav items go here */}
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<BookPickr />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/book/:workId" element={<BookDetail />} />
        </Routes>
      </main>
    </div>
  );
}

