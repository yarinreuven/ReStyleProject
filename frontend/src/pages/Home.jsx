import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import usePageStyles from "../hooks/usePageStyles";

export default function Home() {
  usePageStyles("home.css");
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });

  function logout() {
    localStorage.removeItem("user");
    setUser(null);
    setMenuOpen(false);
    navigate("/");
  }

  return (
    <>
      <header className="navbar">
        <div className="logo">Re<span>Style</span></div>
        <nav className="main-nav">
          <Link to="/">Home</Link>
          <Link to="/closet">My Closet</Link>
          <a href="#marketplace">Marketplace</a>
        </nav>
        <div id="userArea">
          {user ? (
            <div className="user-menu">
              <button className="user-btn" onClick={() => setMenuOpen((open) => !open)}>
                <span className="user-avatar">{user.firstName?.charAt(0).toUpperCase()}</span>
                <span>Hi {user.firstName}</span>
                <i className="fa-solid fa-chevron-down" />
              </button>
              <div className={`dropdown${menuOpen ? " show" : ""}`}>
                <a href="#profile"><i className="fa-regular fa-user" /> My Profile</a>
                <a href="#settings"><i className="fa-solid fa-gear" /> Account Settings</a>
                <a href="#favorites"><i className="fa-regular fa-heart" /> My Favorites</a>
                <button id="logoutBtn" onClick={logout}><i className="fa-solid fa-right-from-bracket" /> Logout</button>
              </div>
            </div>
          ) : (
            <nav className="guest-nav">
              <Link to="/login">Login</Link>
              <Link to="/register" className="register-btn">Register</Link>
            </nav>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-text">
          <h1>Re<span>Style</span></h1>
          <h3>Your Smart Digital Wardrobe</h3>
          <p>Organize your wardrobe, create outfits, rent or sell clothing items, and discover new ways to restyle your clothes.</p>
          <div className="hero-buttons">
            <Link to={user ? "/closet" : "/login"} className="primary-btn">
              {user ? "Go to My Closet" : "Get Started"}
            </Link>
            <button className="secondary-btn">Explore Marketplace</button>
          </div>
        </div>
        <div className="hero-image"><img src="/images/closet.png" alt="Wardrobe" /></div>
      </section>

      <section className="features">
        <div className="feature-card"><i className="fa-solid fa-shirt icon" /><h4>Smart Closet</h4><p>Upload and organize your clothing and accessories.</p></div>
        <div className="feature-card"><i className="fa-solid fa-wand-magic-sparkles icon" /><h4>Outfit Builder</h4><p>Create outfits based on style and occasion.</p></div>
        <div className="feature-card"><i className="fa-solid fa-bag-shopping icon" /><h4>Marketplace</h4><p>Sell or rent selected clothing items.</p></div>
        <div className="feature-card"><i className="fa-solid fa-recycle icon" /><h4>ReStyle Studio</h4><p>Discover tutorials and clothing transformation ideas.</p></div>
      </section>

      <footer><a href="#contact">Contact Us</a><span>|</span><a href="#privacy">Privacy Policy</a><span>|</span><a href="#terms">Terms of Service</a></footer>
    </>
  );
}
