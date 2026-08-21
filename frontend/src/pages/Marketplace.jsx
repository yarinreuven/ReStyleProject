import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ProfileAvatar from "../components/ProfileAvatar";
import MarketplaceItemCard from "../components/MarketplaceItemCard";
import MarketplaceListingForm from "../components/MarketplaceListingForm";
import usePageStyles from "../hooks/usePageStyles";

const API_URL = "http://localhost:3001/api/marketplace";
const imageShapes = ["tall", "standard", "compact"];

function normalizeMarketplaceItem(item, index) {
  const isRental = item.listingType === "rent";

  return {
    id: item._id,
    title: item.name,
    listingType: isRental ? "RENT" : "SALE",
    price: isRental ? item.rentalPricePerDay : item.price,
    size: item.size,
    condition: item.condition,
    category: item.category,
    brand: item.brand,
    style: item.style,
    description: item.description,
    createdAt: item.createdAt,
    availabilityStatus: item.availabilityStatus,
    images: item.images || [],
    image: item.images?.[0] || "",
    imageShape: imageShapes[index % imageShapes.length],
    seller: {
      name: item.seller?.name || "ReStyle member",
      avatar:
        item.seller?.avatar ||
        (index % 2 === 0
          ? "/images/avatars/fashion-avatar-v2.png"
          : "/images/avatars/fashion-avatar-male.png")
    }
  };
}

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
  const [marketplaceItems, setMarketplaceItems] = useState([]);
  const [feedView, setFeedView] = useState("all");
  const [listingFormOpen, setListingFormOpen] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [listingType, setListingType] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [size, setSize] = useState("All");
  const [condition, setCondition] = useState("All");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const requestConfig = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const filterOptions = useMemo(() => ({
    categories: [...new Set(marketplaceItems.map((item) => item.category))],
    sizes: [...new Set(marketplaceItems.map((item) => item.size))],
    conditions: [...new Set(marketplaceItems.map((item) => item.condition))]
  }), [marketplaceItems]);

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
  }, [
    category,
    condition,
    listingType,
    marketplaceItems,
    maxPrice,
    minPrice,
    search,
    size,
    sortBy
  ]);

  const hasActiveFilters = Boolean(
    search || listingType !== "ALL" || category !== "All" || size !== "All" ||
    condition !== "All" || minPrice !== "" || maxPrice !== "" || sortBy !== "newest"
  );

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
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadMarketplace() {
      try {
        setIsLoading(true);
        setLoadError("");
        const endpoint = feedView === "mine" ? `${API_URL}/mine` : API_URL;
        const { data } = await axios.get(endpoint, requestConfig);

        if (!cancelled) {
          setMarketplaceItems(
            (data.items || []).map(normalizeMarketplaceItem)
          );
        }
      } catch (error) {
        if (error.response?.status === 401) {
          logout();
          return;
        }

        if (!cancelled) {
          setLoadError(
            error.response?.data?.message ||
            "Could not load marketplace items. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMarketplace();

    return () => {
      cancelled = true;
    };
  }, [feedView, logout, refreshKey, requestConfig, token]);

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

  function showFeed(view) {
    setFeedView(view);
    clearFilters();
  }

  function handlePublished() {
    setListingFormOpen(false);
    setEditingListing(null);
    setFeedView("mine");
    setRefreshKey((key) => key + 1);
    clearFilters();
  }

  function openEditForm(item) {
    setEditingListing(item);
    setListingFormOpen(true);
    setActionError("");
  }

  function closeListingForm() {
    setListingFormOpen(false);
    setEditingListing(null);
  }

  async function changeAvailability(item) {
    const nextStatus = item.availabilityStatus === "active" ? "hidden" : "active";

    try {
      setActionError("");
      await axios.patch(
        `${API_URL}/${item.id}/availability`,
        { availabilityStatus: nextStatus },
        requestConfig
      );
      setRefreshKey((key) => key + 1);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }
      setActionError(error.response?.data?.message || "Could not update this listing.");
    }
  }

  async function deleteListing(item) {
    const confirmed = window.confirm(
      `Remove “${item.title}” from Marketplace? The wardrobe item itself will not be deleted.`
    );
    if (!confirmed) return;

    try {
      setActionError("");
      await axios.delete(`${API_URL}/${item.id}`, requestConfig);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }
      setActionError(error.response?.data?.message || "Could not delete this listing.");
    }
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
          <button type="button" className="market-add-listing" onClick={() => setListingFormOpen(true)}>
            <i className="fa-solid fa-plus" aria-hidden="true" />
            Add Listing
          </button>
        </section>

        <div className="market-feed-tabs" aria-label="Choose marketplace feed">
          <button type="button" className={feedView === "all" ? "active" : ""} aria-pressed={feedView === "all"} onClick={() => showFeed("all")}>Explore</button>
          <button type="button" className={feedView === "mine" ? "active" : ""} aria-pressed={feedView === "mine"} onClick={() => showFeed("mine")}>My Listings</button>
        </div>

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
              <span>{feedView === "mine" ? "PUBLISHED BY YOU" : "FRESH FROM THE COMMUNITY"}</span>
              <h2 id="marketFeedTitle">{feedView === "mine" ? "My listings" : "Discover pieces"}</h2>
            </div>
            <p>{visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}</p>
          </div>

          {actionError && <p className="market-action-error" role="alert">{actionError}</p>}

          {isLoading ? (
            <div className="market-feed-state" role="status">
              <span className="market-loading-spinner" />
              <h3>Loading marketplace pieces...</h3>
              <p>We are gathering the latest items from the ReStyle community.</p>
            </div>
          ) : loadError ? (
            <div className="market-feed-state market-feed-error" role="alert">
              <span><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /></span>
              <h3>We could not load the marketplace</h3>
              <p>{loadError}</p>
            </div>
          ) : marketplaceItems.length === 0 ? (
            <div className="market-feed-state" role="status">
              <span><i className="fa-solid fa-bag-shopping" aria-hidden="true" /></span>
              <h3>{feedView === "mine" ? "You have not published any items yet" : "No items have been published yet"}</h3>
              <p>{feedView === "mine" ? "Use Add Listing to offer your first item for sale or rent." : "Active sale and rental items from the community will appear here."}</p>
              {feedView === "mine" && (
                <button type="button" className="market-empty-add" onClick={() => setListingFormOpen(true)}>Add Listing</button>
              )}
            </div>
          ) : visibleItems.length > 0 ? (
            <div className="market-masonry">
              {visibleItems.map((item) => (
                <MarketplaceItemCard
                  key={item.id}
                  item={item}
                  ownerActions={feedView === "mine" ? {
                    onEdit: openEditForm,
                    onAvailability: changeAvailability,
                    onDelete: deleteListing
                  } : null}
                />
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

          {!isLoading && !loadError && hasActiveFilters && visibleItems.length > 0 && (
            <button type="button" className="market-feed-clear" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </section>
      </main>
      {listingFormOpen && (
        <MarketplaceListingForm
          token={token}
          listing={editingListing}
          onClose={closeListingForm}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}
