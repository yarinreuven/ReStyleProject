import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";

const API_URL = "http://localhost:3001/api/marketplace";
const categories = [
  "All",
  "Tops",
  "Bottoms",
  "Dresses",
  "Jackets",
  "Shoes",
  "Bags",
  "Accessories"
];

const categoryLabels = {
  Jackets: "Jackets & Coats"
};

export default function Marketplace() {
  usePageStyles("marketplace.css");
  const navigate = useNavigate();
  const accountMenuRef = useRef(null);
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });
  const [token] = useState(() => localStorage.getItem("token"));
  const [listings, setListings] = useState([]);
  const [view, setView] = useState("all");
  const [category, setCategory] = useState("All");
  const [listingType, setListingType] = useState("All");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const requestConfig = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

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

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadListings() {
      try {
        setIsLoading(true);
        setError("");
        const endpoint = view === "mine" ? `${API_URL}/mine` : API_URL;
        const { data } = await axios.get(endpoint, requestConfig);

        if (!cancelled) {
          setListings(data.listings || []);
        }
      } catch (requestError) {
        if (requestError.response?.status === 401) {
          logout();
          return;
        }

        if (!cancelled) {
          setError(
            requestError.response?.data?.message ||
            "Could not load marketplace listings."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadListings();
    return () => {
      cancelled = true;
    };
  }, [logout, requestConfig, token, view]);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return listings.filter((listing) => {
      const matchesCategory =
        category === "All" || listing.category === category;
      const matchesType =
        listingType === "All" || listing.listingType === listingType;
      const matchesSearch = !query || [
        listing.title,
        listing.description,
        listing.location,
        listing.seller?.firstName,
        listing.seller?.lastName
      ].some((value) => value?.toLowerCase().includes(query));

      return matchesCategory && matchesType && matchesSearch;
    });
  }, [category, listingType, listings, search]);

  if (!user || !token) {
    return null;
  }

  return (
    <div className="marketplace-page">
      <header className="market-topbar">
        <button className="market-logo" type="button" onClick={() => navigate("/")}>
          Re<span>Style</span>
        </button>

        <nav aria-label="Main navigation">
          <button type="button" onClick={() => navigate("/")}>Home</button>
          <button type="button" onClick={() => navigate("/closet")}>My Closet</button>
          <button type="button" className="active">Marketplace</button>
          <button type="button" onClick={() => navigate("/outfit-builder")}>
            Outfit Builder
          </button>
        </nav>

        <div className="market-account" ref={accountMenuRef}>
          <button
            type="button"
            className="market-profile-btn"
            onClick={() => setAccountMenuOpen((open) => !open)}
            aria-expanded={accountMenuOpen}
          >
            <ProfileAvatar token={token} user={user} />
            <span>{user.firstName}</span>
            <i className="fa-solid fa-chevron-down" />
          </button>

          {accountMenuOpen && (
            <div className="market-account-menu">
              <strong>{user.firstName} {user.lastName}</strong>
              <span>{user.email}</span>
              <button type="button" onClick={() => navigate("/profile")}>
                <i className="fa-regular fa-user" /> My Profile
              </button>
              <button type="button" onClick={logout}>
                <i className="fa-solid fa-arrow-right-from-bracket" /> Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="market-main">
        <section className="market-hero">
          <div>
            <span className="market-eyebrow">Give great style a second story</span>
            <h1>ReStyle Marketplace</h1>
            <p>
              Discover unique wardrobe pieces from the community, or give
              clothes you no longer wear a new home.
            </p>
          </div>
          <button type="button" className="publish-listing-btn">
            <i className="fa-solid fa-plus" /> Publish an item
          </button>
        </section>

        <section className="market-toolbar" aria-label="Marketplace filters">
          <div className="market-view-tabs">
            <button
              type="button"
              className={view === "all" ? "active" : ""}
              onClick={() => setView("all")}
            >
              Explore listings
            </button>
            <button
              type="button"
              className={view === "mine" ? "active" : ""}
              onClick={() => setView("mine")}
            >
              My listings
            </button>
          </div>

          <label className="market-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="search"
              placeholder="Search items or location"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((name) => (
              <option key={name} value={name}>{categoryLabels[name] || name}</option>
            ))}
          </select>

          <select value={listingType} onChange={(event) => setListingType(event.target.value)}>
            <option value="All">Sale & rent</option>
            <option value="Sale">For sale</option>
            <option value="Rent">For rent</option>
            <option value="Sale or Rent">Sale or rent</option>
          </select>
        </section>

        <section className="market-results">
          <div className="market-results-heading">
            <div>
              <span>{view === "mine" ? "YOUR SHOP" : "COMMUNITY CLOSET"}</span>
              <h2>{view === "mine" ? "My published items" : "Fresh finds"}</h2>
            </div>
            {!isLoading && !error && (
              <p>{filteredListings.length} {filteredListings.length === 1 ? "item" : "items"}</p>
            )}
          </div>

          {isLoading && (
            <div className="market-state">
              <span className="market-loader" />
              <h3>Loading beautiful finds...</h3>
            </div>
          )}

          {!isLoading && error && (
            <div className="market-state market-error">
              <i className="fa-solid fa-triangle-exclamation" />
              <h3>We could not open the marketplace</h3>
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && filteredListings.length === 0 && (
            <div className="market-state market-empty">
              <i className="fa-solid fa-bag-shopping" />
              <h3>{view === "mine" ? "Your shop is ready" : "No matching pieces yet"}</h3>
              <p>
                {view === "mine"
                  ? "Publish your first wardrobe item and it will appear here."
                  : "Try a different category or be the first to publish an item."}
              </p>
              <button type="button" className="publish-listing-btn">
                <i className="fa-solid fa-plus" /> Publish an item
              </button>
            </div>
          )}

          {!isLoading && !error && filteredListings.length > 0 && (
            <div className="listing-grid">
              {filteredListings.map((listing) => (
                <article className="listing-card" key={listing._id}>
                  <div className="listing-image-wrap">
                    <img src={listing.images?.[0]} alt={listing.title} />
                    <span className="listing-type">{listing.listingType}</span>
                    {view === "mine" && (
                      <span className={`listing-status status-${listing.status?.toLowerCase()}`}>
                        {listing.status}
                      </span>
                    )}
                  </div>
                  <div className="listing-card-body">
                    <div className="listing-meta">
                      <span>{categoryLabels[listing.category] || listing.category}</span>
                      <span>{listing.condition}</span>
                    </div>
                    <h3>{listing.title}</h3>
                    <p className="listing-location">
                      <i className="fa-solid fa-location-dot" /> {listing.location}
                    </p>
                    <div className="listing-card-footer">
                      <div className="listing-prices">
                        {listing.salePrice != null && <strong>₪{listing.salePrice}</strong>}
                        {listing.rentalPricePerDay != null && (
                          <span>₪{listing.rentalPricePerDay}/day</span>
                        )}
                      </div>
                      <button type="button" aria-label={`Open ${listing.title}`}>
                        <i className="fa-solid fa-arrow-right" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
