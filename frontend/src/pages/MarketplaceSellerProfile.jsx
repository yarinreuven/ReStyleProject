import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import MarketplaceItemCard from "../components/MarketplaceItemCard";
import MarketplaceSellerAvatar from "../components/MarketplaceSellerAvatar";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:3001/api/marketplace";
const imageShapes = ["tall", "standard", "compact"];

function normalizeItem(item, index) {
  const isRental = item.listingType === "rent";
  return {
    id: item._id,
    title: item.name,
    listingType: isRental ? "RENT" : "SALE",
    price: isRental ? item.rentalPricePerDay : item.price,
    size: item.size,
    condition: item.condition,
    image: item.images?.[0] || "",
    imageShape: imageShapes[index % imageShapes.length],
    availabilityStatus: item.availabilityStatus,
    seller: {
      id: item.seller?.id || "",
      name: item.seller?.name || "ReStyle member",
      avatar: item.seller?.avatar || ""
    }
  };
}

export default function MarketplaceSellerProfile() {
  usePageStyles("marketplace.css");
  usePageStyles("marketplace-seller.css");
  const navigate = useNavigate();
  const { userId } = useParams();
  const accountMenuRef = useRef(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [seller, setSeller] = useState(null);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [status, setStatus] = useState("loading");
  const [contacting, setContacting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [contactError, setContactError] = useState("");
  const { user, token, logout } = useAuth();

  useEffect(() => {
    if (!user || !token) navigate("/login", { replace: true });
  }, [navigate, token, user]);

  useEffect(() => {
    function closeAccountMenu(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeAccountMenu);
    return () => document.removeEventListener("mousedown", closeAccountMenu);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus("loading");

    axios.get(`${API_URL}/sellers/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(({ data }) => {
      if (!cancelled) {
        setSeller(data.seller);
        setItems((data.items || []).map(normalizeItem));
        setStatus("ready");
      }
    }).catch((error) => {
      if (cancelled) return;
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      const errorCode = error.response?.data?.code;
      setStatus(
        errorCode === "CURRENT_USER_BLOCKED_SELLER"
          ? "blocked-by-me"
          : errorCode === "SELLER_BLOCKED_CURRENT_USER"
            ? "blocked-by-them"
            : error.response?.status === 404 ? "not-found" : "error"
      );
    });

    return () => { cancelled = true; };
  }, [logout, navigate, token, userId]);

  const visibleItems = useMemo(
    () => filter === "ALL" ? items : items.filter((item) => item.listingType === filter),
    [filter, items]
  );
  const isOwnProfile = seller && String(user.id || user._id) === String(seller.id);

  function logOut() {
    logout();
    navigate("/login", { replace: true });
  }

  async function contactSeller() {
    try {
      setContacting(true);
      setContactError("");
      const { data } = await axios.post(
        "http://localhost:3001/api/messages/conversations",
        { sellerId: seller.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/marketplace?chat=${data.conversation.id}`);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setContactError(error.response?.data?.message || "Could not open this conversation.");
    } finally {
      setContacting(false);
    }
  }

  async function blockSeller() {
    if (!window.confirm("Block this user? Neither of you will be able to view the other's profile or send messages.")) return;
    try {
      setBlocking(true);
      setContactError("");
      await axios.post(
        `http://localhost:3001/api/auth/blocked-users/${seller.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSeller(null);
      setItems([]);
      setStatus("blocked-by-me");
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setContactError(error.response?.data?.message || "Could not block this user.");
    } finally {
      setBlocking(false);
    }
  }

  if (!user || !token) return null;

  return (
    <div className="marketplace-page seller-profile-page">
      <header className="market-topbar">
        <button className="market-logo" type="button" onClick={() => navigate("/")}>Re<span>Style</span></button>
        <nav aria-label="Main navigation">
          <button type="button" onClick={() => navigate("/")}>Home</button>
          <button type="button" onClick={() => navigate("/closet")}>My Closet</button>
          <button type="button" className="active" onClick={() => navigate("/marketplace")}>Marketplace</button>
          <button type="button" onClick={() => navigate("/outfit-builder")}>Outfit Builder</button>
        </nav>
        <div className="market-account" ref={accountMenuRef}>
          <button
            type="button"
            className="market-profile-btn seller-header-account"
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
              <button type="button" onClick={() => navigate("/settings")}>
                <i className="fa-solid fa-gear" /> Settings
              </button>
              <button type="button" onClick={() => navigate("/marketplace/favorites")}>
                <i className="fa-regular fa-heart" /> Marketplace Saved Items
              </button>
              <button type="button" onClick={() => navigate("/saved-looks")}>
                <i className="fa-regular fa-bookmark" /> My Saved Looks
              </button>
              <div className="market-account-divider" />
              <button type="button" className="market-logout" onClick={logOut}>
                <i className="fa-solid fa-arrow-right-from-bracket" /> Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="seller-profile-main">
        <button type="button" className="seller-profile-back" onClick={() => navigate("/marketplace")}><i className="fa-solid fa-arrow-left" /> Back to Marketplace</button>

        {status === "loading" && <section className="seller-profile-state" role="status"><span className="market-loading-spinner" /><h1>Loading seller profile...</h1></section>}
        {status === "not-found" && <section className="seller-profile-state"><i className="fa-regular fa-circle-xmark" /><h1>Seller not found</h1><p>This public seller profile is not available.</p><button type="button" onClick={() => navigate("/marketplace")}>Browse Marketplace</button></section>}
        {status === "blocked-by-them" && <section className="seller-profile-state seller-profile-blocked"><i className="fa-solid fa-user-slash" /><h1>This account is unavailable</h1><p>You cannot view this account.</p></section>}
        {status === "blocked-by-me" && <section className="seller-profile-state seller-profile-blocked"><i className="fa-solid fa-user-slash" /><h1>You blocked this account</h1><p>This profile is hidden because you blocked this user.</p><button type="button" onClick={() => navigate("/settings")}>Manage Blocked Users</button></section>}
        {status === "error" && <section className="seller-profile-state"><i className="fa-solid fa-triangle-exclamation" /><h1>We could not load this profile</h1><p>Please try again in a moment.</p></section>}

        {status === "ready" && seller && <>
          <section className="seller-profile-hero">
            <MarketplaceSellerAvatar seller={seller} />
            <div className="seller-profile-copy">
              <span>RESTYLE SELLER</span><h1>{seller.name}</h1>
              <p>{seller.bio || "Sharing beautiful wardrobe pieces with the ReStyle community."}</p>
              <strong>{seller.activeListingCount} active {seller.activeListingCount === 1 ? "listing" : "listings"}</strong>
            </div>
            <div className="seller-profile-actions">
              {isOwnProfile ? (
                <button type="button" onClick={() => navigate("/marketplace?view=mine")}><i className="fa-regular fa-rectangle-list" /> Go to My Listings</button>
              ) : (
                <>
                  <button type="button" onClick={contactSeller} disabled={contacting || blocking}><i className="fa-regular fa-comment-dots" /> {contacting ? "Opening conversation..." : "Contact seller"}</button>
                  <button className="seller-block-button" type="button" onClick={blockSeller} disabled={contacting || blocking}><i className="fa-solid fa-user-slash" /> {blocking ? "Blocking..." : "Block user"}</button>
                </>
              )}
              {contactError && <p role="alert">{contactError}</p>}
            </div>
          </section>

          <section className="seller-listings" aria-labelledby="sellerListingsTitle">
            <div className="seller-listings-heading">
              <div><span>AVAILABLE NOW</span><h2 id="sellerListingsTitle">Pieces by {seller.name}</h2></div>
              <div className="market-type-filters" aria-label="Filter seller listings">
                {[["ALL","All"],["SALE","For Sale"],["RENT","For Rent"]].map(([value,label]) => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
              </div>
            </div>

            {visibleItems.length > 0 ? <div className="market-masonry">
              {visibleItems.map((item) => <MarketplaceItemCard key={item.id} item={item} onOpen={(itemId) => navigate(`/marketplace/items/${itemId}`)} onSellerOpen={(sellerId) => navigate(`/marketplace/sellers/${sellerId}`)} />)}
            </div> : <div className="seller-profile-empty"><i className="fa-solid fa-shirt" /><h3>No matching active listings</h3><p>Try another listing type.</p></div>}
          </section>
        </>}
      </main>
    </div>
  );
}
