import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import usePageStyles from "../hooks/usePageStyles";
import ProfileAvatar from "../components/ProfileAvatar";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  usePageStyles("home.css");
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const { user, token, logout: logoutUser } = useAuth();

  useEffect(() => {
    function closeMenu(event) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  function logout() {
    logoutUser();
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
          <Link to="/marketplace">Marketplace</Link>
        </nav>
        <div id="userArea">
          {user ? (
            <div className="user-menu" ref={userMenuRef}>
              <button
                className="user-btn"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
              >
                <ProfileAvatar token={token} user={user} />
                <span>Hi {user.firstName}</span>
                <i className="fa-solid fa-chevron-down" />
              </button>
              <div className={`dropdown${menuOpen ? " show" : ""}`}>
                <div className="dropdown-header">
                  <strong>{user.firstName} {user.lastName}</strong>
                  <span>{user.email}</span>
                </div>
                <button onClick={() => navigate("/profile")}>
                  <i className="fa-regular fa-user" /> My Profile
                </button>
                <button onClick={() => navigate("/marketplace/favorites")}>
                  <i className="fa-regular fa-heart" /> Marketplace Saved Items
                </button>
                <div className="dropdown-divider" />
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
            <button className="secondary-btn" onClick={() => navigate(user ? "/marketplace" : "/login")}>Explore Marketplace</button>
          </div>
        </div>
        <div className="hero-image"><img src="/images/closet.png" alt="Wardrobe" /></div>
      </section>

      <section className="features">
        <Link to="/closet" className="feature-card">
          <i className="fa-solid fa-shirt icon" /><h4>Smart Closet</h4><p>Upload and organize your clothing and accessories.</p>
        </Link>
        <Link to="/outfit-builder" className="feature-card"><i className="fa-solid fa-wand-magic-sparkles icon" /><h4>Outfit Builder</h4><p>Create outfits based on style and occasion.</p></Link>
        <Link to={user ? "/marketplace" : "/login"} className="feature-card"><i className="fa-solid fa-bag-shopping icon" /><h4>Marketplace</h4><p>Sell or rent selected clothing items.</p></Link>
        <div className="feature-card"><i className="fa-solid fa-recycle icon" /><h4>ReStyle Studio</h4><p>Discover tutorials and clothing transformation ideas.</p></div>
      </section>

      <footer><a href="#contact">Contact Us</a><span>|</span><a href="#privacy">Privacy Policy</a><span>|</span><a href="#terms">Terms of Service</a></footer>
    </>
  );
}
