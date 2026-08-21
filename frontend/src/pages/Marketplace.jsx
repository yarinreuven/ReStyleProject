import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";

export default function Marketplace() {
  usePageStyles("marketplace.css");
  const navigate = useNavigate();
  const accountMenuRef = useRef(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });
  const [token] = useState(() => localStorage.getItem("token"));

  useEffect(() => {
    if (!user || !token) {
      navigate("/login", { replace: true });
    }
  }, [navigate, token, user]);

  useEffect(() => {
    function closeAccountMenu(event) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeAccountMenu);
    return () => document.removeEventListener("mousedown", closeAccountMenu);
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  if (!user || !token) {
    return null;
  }

  return (
    <div className="marketplace-page">
      <header className="market-topbar">
        <button
          className="market-logo"
          type="button"
          onClick={() => navigate("/")}
        >
          Re<span>Style</span>
        </button>

        <nav aria-label="Main navigation">
          <button type="button" onClick={() => navigate("/")}>Home</button>
          <button type="button" onClick={() => navigate("/closet")}>My Closet</button>
          <button type="button" className="active" aria-current="page">
            Marketplace
          </button>
          <button type="button" onClick={() => navigate("/outfit-builder")}>
            Outfit Builder
          </button>
        </nav>

        <div className="market-account" ref={accountMenuRef}>
          <button
            type="button"
            className="market-profile-btn"
            onClick={() => setAccountMenuOpen((open) => !open)}
            aria-label="Open account menu"
            aria-expanded={accountMenuOpen}
          >
            <ProfileAvatar token={token} user={user} />
            <span>{user.firstName}</span>
            <i className="fa-solid fa-chevron-down" />
          </button>

          {accountMenuOpen && (
            <div className="market-account-menu">
              <div className="market-account-header">
                <strong>{user.firstName} {user.lastName}</strong>
                <span>{user.email}</span>
              </div>
              <button type="button" onClick={() => navigate("/profile")}>
                <i className="fa-regular fa-user" /> My Profile
              </button>
              <div className="market-account-divider" />
              <button type="button" className="market-logout" onClick={logout}>
                <i className="fa-solid fa-arrow-right-from-bracket" /> Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="market-main">
        <section className="market-intro">
          <span className="market-kicker">CURATED BY THE RESTYLE COMMUNITY</span>
          <h1>Marketplace</h1>
          <h2>Find your next favorite piece.</h2>
          <p>
            Discover beautiful wardrobe pieces available for sale and rent
            from other ReStyle members.
          </p>
        </section>

        <section className="market-discovery" aria-label="Marketplace discovery controls">
          <label className="market-search" htmlFor="marketSearch">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
              id="marketSearch"
              type="search"
              placeholder="Search by item, brand or style..."
              aria-label="Search marketplace"
            />
          </label>

          <div className="market-control-row">
            <div className="market-type-filters" aria-label="Listing type">
              <button type="button" className="active" aria-pressed="true">All</button>
              <button type="button" aria-pressed="false">For Sale</button>
              <button type="button" aria-pressed="false">For Rent</button>
            </div>

            <div className="market-secondary-controls">
              <button type="button" className="market-filter-button">
                <i className="fa-solid fa-sliders" aria-hidden="true" />
                Filters
              </button>

              <label className="market-sort">
                <span>Sort by</span>
                <select defaultValue="newest" aria-label="Sort marketplace items">
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section
          className="market-feed-placeholder"
          aria-label="Marketplace item feed will appear here"
        />
      </main>
    </div>
  );
}
