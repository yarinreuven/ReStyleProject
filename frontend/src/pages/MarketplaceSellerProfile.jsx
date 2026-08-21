import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import MarketplaceItemCard from "../components/MarketplaceItemCard";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";

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
      avatar: item.seller?.avatar || "/images/avatars/fashion-avatar-v2.png"
    }
  };
}

export default function MarketplaceSellerProfile() {
  usePageStyles("marketplace.css");
  usePageStyles("marketplace-seller.css");
  const navigate = useNavigate();
  const { userId } = useParams();
  const [seller, setSeller] = useState(null);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [status, setStatus] = useState("loading");
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const [token] = useState(() => localStorage.getItem("token"));

  useEffect(() => {
    if (!user || !token) navigate("/login", { replace: true });
  }, [navigate, token, user]);

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
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }
      setStatus(error.response?.status === 404 ? "not-found" : "error");
    });

    return () => { cancelled = true; };
  }, [navigate, token, userId]);

  const visibleItems = useMemo(
    () => filter === "ALL" ? items : items.filter((item) => item.listingType === filter),
    [filter, items]
  );
  const isOwnProfile = seller && String(user.id || user._id) === String(seller.id);
  const sellerAvatar = seller?.avatar || "/images/avatars/fashion-avatar-v2.png";

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
        <button type="button" className="seller-header-account" onClick={() => navigate("/profile")}>
          <ProfileAvatar token={token} user={user} /><span>{user.firstName}</span>
        </button>
      </header>

      <main className="seller-profile-main">
        <button type="button" className="seller-profile-back" onClick={() => navigate("/marketplace")}><i className="fa-solid fa-arrow-left" /> Back to Marketplace</button>

        {status === "loading" && <section className="seller-profile-state" role="status"><span className="market-loading-spinner" /><h1>Loading seller profile...</h1></section>}
        {status === "not-found" && <section className="seller-profile-state"><i className="fa-regular fa-circle-xmark" /><h1>Seller not found</h1><p>This public seller profile is not available.</p><button type="button" onClick={() => navigate("/marketplace")}>Browse Marketplace</button></section>}
        {status === "error" && <section className="seller-profile-state"><i className="fa-solid fa-triangle-exclamation" /><h1>We could not load this profile</h1><p>Please try again in a moment.</p></section>}

        {status === "ready" && seller && <>
          <section className="seller-profile-hero">
            <img src={sellerAvatar} alt={seller.name} />
            <div className="seller-profile-copy">
              <span>RESTYLE SELLER</span><h1>{seller.name}</h1>
              <p>{seller.bio || "Sharing beautiful wardrobe pieces with the ReStyle community."}</p>
              <strong>{seller.activeListingCount} active {seller.activeListingCount === 1 ? "listing" : "listings"}</strong>
            </div>
            {isOwnProfile && <button type="button" onClick={() => navigate("/marketplace?view=mine")}><i className="fa-regular fa-rectangle-list" /> Go to My Listings</button>}
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
