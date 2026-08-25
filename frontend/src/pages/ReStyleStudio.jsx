import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProfileAvatar from "../components/ProfileAvatar";
import { useAuth } from "../context/AuthContext";
import usePageStyles from "../hooks/usePageStyles";

const studioSteps = [
  ["01", "Choose a garment", "Select an item from My Closet or upload a new photo."],
  ["02", "Tell us about it", "Add the fabric, condition, available tools and preferred difficulty."],
  ["03", "Explore ideas", "Receive practical transformations tailored to the garment."],
  ["04", "Make it yours", "Follow the guide, track your progress and save the finished piece."]
];

export default function ReStyleStudio() {
  usePageStyles("restyle-studio.css");

  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, token, logout } = useAuth();

  useEffect(() => {
    function closeMenu(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  function logOut() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!user || !token) return null;

  return (
    <main className="restyle-studio-page">
      <header className="restyle-studio-header">
        <button className="restyle-studio-brand" type="button" onClick={() => navigate("/")}>
          Re<span>Style</span>
        </button>

        <nav aria-label="Main navigation">
          <button type="button" onClick={() => navigate("/")}>Home</button>
          <button type="button" onClick={() => navigate("/closet")}>My Closet</button>
          <button type="button" onClick={() => navigate("/marketplace")}>Marketplace</button>
          <button type="button" onClick={() => navigate("/outfit-builder")}>Outfit Builder</button>
          <button type="button" className="active" aria-current="page">ReStyle Studio</button>
        </nav>

        <div className="restyle-studio-account" ref={menuRef}>
          <button
            type="button"
            className="restyle-studio-profile"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Open account menu"
            aria-expanded={menuOpen}
          >
            <ProfileAvatar token={token} user={user} />
            <span>{user.firstName}</span>
            <i className="fa-solid fa-chevron-down" />
          </button>

          {menuOpen && (
            <div className="restyle-studio-menu">
              <div>
                <strong>{user.firstName} {user.lastName}</strong>
                <span>{user.email}</span>
              </div>
              <button type="button" onClick={() => navigate("/profile")}><i className="fa-regular fa-user" /> My Profile</button>
              <button type="button" onClick={() => navigate("/settings")}><i className="fa-solid fa-gear" /> Settings</button>
              <button type="button" onClick={() => navigate("/marketplace/favorites")}><i className="fa-regular fa-heart" /> Marketplace Saved Items</button>
              <button type="button" onClick={() => navigate("/saved-looks")}><i className="fa-regular fa-bookmark" /> My Saved Looks</button>
              <hr />
              <button type="button" className="restyle-studio-logout" onClick={logOut}><i className="fa-solid fa-arrow-right-from-bracket" /> Logout</button>
            </div>
          )}
        </div>
      </header>

      <section className="restyle-studio-hero">
        <div className="restyle-studio-copy">
          <span className="restyle-studio-eyebrow">REIMAGINE WHAT YOU ALREADY OWN</span>
          <h1>Give old clothes a<br /><em>beautiful new story.</em></h1>
          <p>
            Turn an unworn garment into something useful and personal with ideas
            designed around its fabric, condition and your skills.
          </p>
          <button type="button" onClick={() => navigate("/closet")}>
            <i className="fa-solid fa-shirt" /> Browse My Closet
          </button>
        </div>

        <div className="restyle-studio-visual" aria-hidden="true">
          <div className="restyle-studio-orbit orbit-one" />
          <div className="restyle-studio-orbit orbit-two" />
          <div className="restyle-studio-garment"><i className="fa-solid fa-shirt" /></div>
          <span className="restyle-studio-arrow"><i className="fa-solid fa-arrow-right-long" /></span>
          <div className="restyle-studio-result"><i className="fa-solid fa-bag-shopping" /></div>
          <span className="restyle-studio-sparkle sparkle-one">✦</span>
          <span className="restyle-studio-sparkle sparkle-two">✧</span>
        </div>
      </section>

      <section className="restyle-studio-process" aria-labelledby="studioProcessTitle">
        <div className="restyle-studio-process-heading">
          <span>HOW IT WORKS</span>
          <h2 id="studioProcessTitle">From forgotten to reimagined</h2>
          <p>A guided transformation, built one thoughtful step at a time.</p>
        </div>
        <div className="restyle-studio-steps">
          {studioSteps.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
