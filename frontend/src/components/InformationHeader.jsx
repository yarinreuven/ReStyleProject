import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useClickOutside from "../hooks/useClickOutside";
import ProfileAvatar from "./ProfileAvatar";

const destinations = [
  ["/", "Home", false],
  ["/closet", "My Closet", true],
  ["/marketplace", "Marketplace", true],
  ["/outfit-builder", "Outfit Builder", true],
  ["/restyle-studio", "ReStyle Studio", true]
];

export default function InformationHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, token, logout, isAuthenticated } = useAuth();

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  function go(path) {
    setMenuOpen(false);
    navigate(path);
  }

  function signOut() {
    logout();
    setMenuOpen(false);
    navigate("/");
  }

  return (
    <header className="site-info-header">
      <Link className="info-logo" to="/" aria-label="ReStyle home">Re<span>Style</span></Link>
      <nav className="site-info-links" aria-label="Main navigation">
        {destinations.map(([path, label, protectedPage]) => {
          const target = protectedPage && !isAuthenticated ? "/login" : path;
          const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
          return <Link key={path} className={active ? "active" : ""} to={target}>{label}</Link>;
        })}
      </nav>

      {user ? (
        <div className="info-user-menu" ref={menuRef}>
          <button type="button" className="info-user-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
            <ProfileAvatar token={token} user={user} />
            <span>{user.firstName}</span>
            <i className={`fa-solid fa-chevron-${menuOpen ? "up" : "down"}`} />
          </button>
          {menuOpen && (
            <div className="info-user-dropdown">
              <div className="info-user-summary"><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span></div>
              <button type="button" onClick={() => go("/profile")}><i className="fa-regular fa-user" /> My Profile</button>
              <button type="button" onClick={() => go("/settings")}><i className="fa-solid fa-gear" /> Settings</button>
              <button type="button" onClick={() => go("/marketplace/favorites")}><i className="fa-regular fa-heart" /> Saved Items</button>
              <button type="button" onClick={() => go("/saved-looks")}><i className="fa-regular fa-bookmark" /> Saved Looks</button>
              <button type="button" className="info-logout" onClick={signOut}><i className="fa-solid fa-right-from-bracket" /> Logout</button>
            </div>
          )}
        </div>
      ) : (
        <Link className="info-login-link" to="/login"><i className="fa-regular fa-user" /> Login</Link>
      )}
    </header>
  );
}
