import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProfileAvatar from "../components/ProfileAvatar";
import MarketplaceItemCard from "../components/MarketplaceItemCard";
import usePageStyles from "../hooks/usePageStyles";
import marketplaceItems from "../data/marketplaceItems";

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
  const [search, setSearch] = useState("");
  const [listingType, setListingType] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [size, setSize] = useState("All");
  const [condition, setCondition] = useState("All");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const filterOptions = useMemo(() => ({
    categories: [...new Set(marketplaceItems.map((item) => item.category))],
    sizes: [...new Set(marketplaceItems.map((item) => item.size))],
    conditions: [...new Set(marketplaceItems.map((item) => item.condition))]
  }), []);

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const minimum = minPrice === "" ? null : Number(minPrice);
    const maximum = maxPrice === "" ? null : Number(maxPrice);
    const filtered = marketplaceItems.filter((item) => {
      const searchableValues = [item.title, item.category, item.brand, item.style];
      const matchesSearch = !normalizedSearch || searchableValues.some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      );
      const matchesType = listingType === "ALL" || item.listingType === listingType;
      const matchesCategory = category === "All" || item.category === category;
      const matchesSize = size === "All" || item.size === size;
      const matchesCondition = condition === "All" || item.condition === condition;
      const matchesMinimum = minimum === null || item.price >= minimum;
      const matchesMaximum = maximum === null || item.price <= maximum;

      return matchesSearch && matchesType && matchesCategory && matchesSize &&
        matchesCondition && matchesMinimum && matchesMaximum;
    });

    return [...filtered].sort((first, second) => {
      if (sortBy === "price-low") return first.price - second.price;
      if (sortBy === "price-high") return second.price - first.price;
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });
  }, [category, condition, listingType, maxPrice, minPrice, search, size, sortBy]);

  const hasActiveFilters = Boolean(
    search || listingType !== "ALL" || category !== "All" || size !== "All" ||
    condition !== "All" || minPrice !== "" || maxPrice !== "" || sortBy !== "newest"
  );

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

  function clearFilters() {
    setSearch("");
    setListingType("ALL");
    setCategory("All");
    setSize("All");
    setCondition("All");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("newest");
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
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="market-control-row">
            <div className="market-type-filters" aria-label="Listing type">
              {[
                ["ALL", "All"],
                ["SALE", "For Sale"],
                ["RENT", "For Rent"]
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={listingType === value ? "active" : ""}
                  aria-pressed={listingType === value}
                  onClick={() => setListingType(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="market-secondary-controls">
              <button
                type="button"
                className={`market-filter-button${filtersOpen ? " active" : ""}`}
                aria-expanded={filtersOpen}
                aria-controls="marketFilterPanel"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <i className="fa-solid fa-sliders" aria-hidden="true" />
                Filters
                {(category !== "All" || size !== "All" || condition !== "All" || minPrice || maxPrice) && (
                  <span className="market-filter-dot" aria-label="Filters are active" />
                )}
              </button>

              <label className="market-sort">
                <span>Sort by</span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  aria-label="Sort marketplace items"
                >
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </label>
            </div>
          </div>

          {filtersOpen && (
            <div className="market-filter-panel" id="marketFilterPanel">
              <label>
                <span>Category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="All">All categories</option>
                  {filterOptions.categories.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Size</span>
                <select value={size} onChange={(event) => setSize(event.target.value)}>
                  <option value="All">All sizes</option>
                  {filterOptions.sizes.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Condition</span>
                <select value={condition} onChange={(event) => setCondition(event.target.value)}>
                  <option value="All">All conditions</option>
                  {filterOptions.conditions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <fieldset className="market-price-filter">
                <legend>Price range</legend>
                <div>
                  <label>
                    <span>Min</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder="₪0"
                      value={minPrice}
                      onChange={(event) => setMinPrice(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Max</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder="₪500"
                      value={maxPrice}
                      onChange={(event) => setMaxPrice(event.target.value)}
                    />
                  </label>
                </div>
              </fieldset>

              <button type="button" className="market-clear-button" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          )}
        </section>

        <section className="market-feed" aria-labelledby="marketFeedTitle">
          <div className="market-feed-heading">
            <div>
              <span>FRESH FROM THE COMMUNITY</span>
              <h2 id="marketFeedTitle">Discover pieces</h2>
            </div>
            <p>{visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}</p>
          </div>

          {visibleItems.length > 0 ? (
            <div className="market-masonry">
              {visibleItems.map((item) => (
                <MarketplaceItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="market-no-results" role="status">
              <span><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /></span>
              <h3>No pieces match your search</h3>
              <p>Try changing your search or clearing the selected filters.</p>
              <button type="button" onClick={clearFilters}>Clear Filters</button>
            </div>
          )}

          {hasActiveFilters && visibleItems.length > 0 && (
            <button type="button" className="market-feed-clear" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
