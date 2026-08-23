import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import MarketplaceItemCard from "../components/MarketplaceItemCard";
import ProfileAvatar from "../components/ProfileAvatar";
import { useAuth } from "../context/AuthContext";
import useMarketplaceFavoritesSync from "../hooks/useMarketplaceFavoritesSync";
import usePageStyles from "../hooks/usePageStyles";
import {
  fetchMarketplaceFavorites,
  selectMarketplaceFavoriteItems,
  selectMarketplaceFavoritesError,
  selectMarketplaceFavoritesLoadedForUserId,
  selectMarketplaceFavoritesStatus
} from "../store/marketplaceFavoritesSlice.js";

const imageShapes = ["standard", "tall", "compact"];

function normalizeSavedItem(item, index) {
  const isRental = item.listingType?.toLowerCase() === "rent";
  const images = item.images || (item.image ? [item.image] : []);

  return {
    ...item,
    id: item._id || item.id,
    title: item.name || item.title,
    listingType: isRental ? "RENT" : "SALE",
    price: isRental ? item.rentalPricePerDay : item.price,
    images,
    image: images[0] || "",
    imageShape: imageShapes[index % imageShapes.length],
    seller: {
      id: item.seller?.id || "",
      name: item.seller?.name || "ReStyle member",
      avatar: item.seller?.avatar || "/images/avatars/fashion-avatar-v2.png"
    }
  };
}

export default function MarketplaceFavorites() {
  usePageStyles("marketplace.css");
  usePageStyles("marketplace-favorites.css?v=2");
  useMarketplaceFavoritesSync();

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const accountMenuRef = useRef(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const { user, token, isAuthLoading, logout } = useAuth();
  const items = useSelector(selectMarketplaceFavoriteItems);
  const status = useSelector(selectMarketplaceFavoritesStatus);
  const error = useSelector(selectMarketplaceFavoritesError);
  const loadedForUserId = useSelector(
    selectMarketplaceFavoritesLoadedForUserId
  );
  const userId = String(user?._id || user?.id || "");

  const savedItems = useMemo(
    () => items.filter(Boolean).map(normalizeSavedItem),
    [items]
  );

  const isLoading = isAuthLoading || status === "idle" || status === "loading" ||
    loadedForUserId !== userId;

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

  function retryLoading() {
    if (token && userId) {
      dispatch(fetchMarketplaceFavorites({ token, userId }));
    }
  }

  function logOut() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!user || !token) {
    return null;
  }

  return (
    <div className="marketplace-page marketplace-favorites-page">
      <header className="market-topbar">
        <button className="market-logo" type="button" onClick={() => navigate("/")}>
          Re<span>Style</span>
        </button>

        <nav aria-label="Main navigation">
          <button type="button" onClick={() => navigate("/")}>Home</button>
          <button type="button" onClick={() => navigate("/closet")}>My Closet</button>
          <button type="button" className="active" onClick={() => navigate("/marketplace")}>Marketplace</button>
          <button type="button" onClick={() => navigate("/outfit-builder")}>Outfit Builder</button>
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
              <button type="button" aria-current="page">
                <i className="fa-solid fa-heart" /> Marketplace Saved Items
              </button>
              <div className="market-account-divider" />
              <button type="button" className="market-logout" onClick={logOut}>
                <i className="fa-solid fa-arrow-right-from-bracket" /> Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="market-favorites-main">
        <section className="market-favorites-intro">
          <span>SAVED FOR YOU</span>
          <h1>Marketplace Saved Items</h1>
          <p>Pieces you loved, saved in one place.</p>
        </section>

        {isLoading ? (
          <section className="market-feed-state" role="status">
            <span className="market-loading-spinner" />
            <h2>Loading your saved pieces...</h2>
            <p>We are gathering your Marketplace favorites.</p>
          </section>
        ) : status === "failed" ? (
          <section className="market-feed-state market-feed-error" role="alert">
            <span><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /></span>
            <h2>We could not load your saved items</h2>
            <p>{error || "Please try again in a moment."}</p>
            <button type="button" onClick={retryLoading}>Try Again</button>
          </section>
        ) : savedItems.length === 0 ? (
          <section className="market-feed-state market-favorites-empty">
            <span><i className="fa-regular fa-heart" aria-hidden="true" /></span>
            <h2>No saved items yet</h2>
            <p>Tap the heart on any Marketplace item to save it here.</p>
            <button type="button" onClick={() => navigate("/marketplace")}>
              Explore Marketplace
            </button>
          </section>
        ) : (
          <section className="market-favorites-list" aria-labelledby="savedItemsHeading">
            <div className="market-favorites-heading">
              <h2 id="savedItemsHeading">Your saved pieces</h2>
              <span>{savedItems.length} {savedItems.length === 1 ? "item" : "items"}</span>
            </div>
            {error && <p className="market-action-error" role="alert">{error}</p>}
            <div className="market-masonry">
              {savedItems.map((item) => (
                <MarketplaceItemCard
                  key={item.id}
                  item={item}
                  onOpen={(itemId) => navigate(`/marketplace/items/${itemId}`)}
                  onSellerOpen={(sellerId) => navigate(`/marketplace/sellers/${sellerId}`)}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
