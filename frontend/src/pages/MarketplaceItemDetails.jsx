import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";

const API_URL = "http://localhost:3001/api/marketplace";

export default function MarketplaceItemDetails() {
  usePageStyles("marketplace-item.css");
  const navigate = useNavigate();
  const { itemId } = useParams();
  const accountMenuRef = useRef(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [contacting, setContacting] = useState(false);
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

    axios.get(`${API_URL}/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(({ data }) => {
      if (!cancelled) {
        setItem(data.item);
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
  }, [itemId, navigate, token]);

  useEffect(() => {
    function closeMenu(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) setAccountMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  async function contactSeller() {
    try {
      setContacting(true);
      setMessage("");
      const { data } = await axios.post(
        "http://localhost:3001/api/messages/conversations",
        { itemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/marketplace?chat=${data.conversation.id}`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not open this conversation.");
    } finally {
      setContacting(false);
    }
  }

  if (!user || !token) return null;

  const isRental = item?.listingType === "rent";
  const price = isRental ? item?.rentalPricePerDay : item?.price;
  const sellerAvatar = item?.seller?.avatar || "/images/avatars/fashion-avatar-v2.png";
  const isOwnListing = item && String(item.seller?.id) === String(user.id || user._id);

  return (
    <div className="market-detail-page">
      <header className="market-detail-topbar">
        <button className="market-detail-logo" type="button" onClick={() => navigate("/")}>Re<span>Style</span></button>
        <nav aria-label="Main navigation">
          <button type="button" onClick={() => navigate("/")}>Home</button>
          <button type="button" onClick={() => navigate("/closet")}>My Closet</button>
          <button type="button" className="active" onClick={() => navigate("/marketplace")}>Marketplace</button>
          <button type="button" onClick={() => navigate("/outfit-builder")}>Outfit Builder</button>
        </nav>
        <div className="market-detail-account" ref={accountMenuRef}>
          <button type="button" className="market-detail-profile" onClick={() => setAccountMenuOpen((open) => !open)} aria-expanded={accountMenuOpen}>
            <ProfileAvatar token={token} user={user} /><span>{user.firstName}</span><i className="fa-solid fa-chevron-down" />
          </button>
          {accountMenuOpen && (
            <div className="market-detail-menu">
              <strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span>
              <button type="button" onClick={() => navigate("/profile")}><i className="fa-regular fa-user" /> My Profile</button>
              <button type="button" onClick={logout}><i className="fa-solid fa-arrow-right-from-bracket" /> Logout</button>
            </div>
          )}
        </div>
      </header>

      <main className="market-detail-main">
        <button type="button" className="market-detail-back" onClick={() => navigate("/marketplace")}><i className="fa-solid fa-arrow-left" /> Back to Marketplace</button>

        {status === "loading" && <section className="market-detail-state" role="status"><span className="market-detail-spinner" /><h1>Loading this piece...</h1></section>}
        {status === "not-found" && <section className="market-detail-state"><i className="fa-regular fa-circle-xmark" /><h1>Item not found</h1><p>This listing may have been removed or is no longer available.</p><button type="button" onClick={() => navigate("/marketplace")}>Browse Marketplace</button></section>}
        {status === "error" && <section className="market-detail-state"><i className="fa-solid fa-triangle-exclamation" /><h1>We could not load this item</h1><p>Please try again in a moment.</p></section>}

        {status === "ready" && item && (
          <article className="market-detail-card">
            <section className="market-detail-gallery" aria-label={`${item.name} images`}>
              <div className="market-detail-main-image"><img src={item.images[activeImage]} alt={item.name} /></div>
              {item.images.length > 1 && <div className="market-detail-thumbnails">
                {item.images.map((image, index) => <button type="button" className={activeImage === index ? "active" : ""} key={index} onClick={() => setActiveImage(index)} aria-label={`Show image ${index + 1}`}><img src={image} alt="" /></button>)}
              </div>}
            </section>

            <section className="market-detail-info">
              <div className="market-detail-badges">
                <span className={isRental ? "rent" : "sale"}>{isRental ? "FOR RENT" : "FOR SALE"}</span>
                <span className={`availability ${item.availabilityStatus}`}>{item.availabilityStatus === "active" ? "Available" : "Unavailable"}</span>
              </div>
              <h1>{item.name}</h1>
              <p className="market-detail-price">₪{price}{isRental && <small>/ day</small>}</p>
              <dl className="market-detail-specs">
                <div><dt>Size</dt><dd>{item.size}</dd></div><div><dt>Condition</dt><dd>{item.condition}</dd></div>
                <div><dt>Brand</dt><dd>{item.brand}</dd></div><div><dt>Category</dt><dd>{item.category}</dd></div>
              </dl>
              <div className="market-detail-description"><h2>About this piece</h2><p>{item.description}</p></div>
              <button type="button" className="market-detail-seller" onClick={() => navigate(`/marketplace/sellers/${item.seller.id}`)}>
                <img src={sellerAvatar} alt={item.seller?.name || "Seller"} /><span><small>Listed by</small><strong>{item.seller?.name || "ReStyle member"}</strong></span><i className="fa-solid fa-chevron-right" />
              </button>
              <button type="button" className="market-contact-seller" onClick={contactSeller} disabled={item.availabilityStatus !== "active" || isOwnListing || contacting}>
                <i className="fa-regular fa-comment-dots" /> {contacting ? "Opening conversation..." : isOwnListing ? "This is your listing" : "Contact Seller"}
              </button>
              {message && <p className="market-detail-coming-soon" role="status">{message}</p>}
            </section>
          </article>
        )}
      </main>
    </div>
  );
}
