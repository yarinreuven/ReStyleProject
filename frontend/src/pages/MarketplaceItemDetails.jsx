import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import MarketplaceItemCard from "../components/MarketplaceItemCard";
import MarketplaceFavoriteButton from "../components/MarketplaceFavoriteButton";
import MarketplaceSellerAvatar from "../components/MarketplaceSellerAvatar";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";
import { useAuth } from "../context/AuthContext";
import useMarketplaceFavoritesSync from "../hooks/useMarketplaceFavoritesSync";
import { selectMarketplaceFavoritesError } from "../store/marketplaceFavoritesSlice.js";
import { API_BASE_URL } from "../config/api";

const API_URL = `${API_BASE_URL}/marketplace`;
const imageShapes = ["standard", "compact", "tall"];

function normalizeMarketplaceItem(item, index) {
  const isRental = item.listingType === "rent";
  return {
    id: item._id || item.id,
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
      id: item.seller?.id || "",
      name: item.seller?.name || "ReStyle member",
      avatar: item.seller?.avatar || ""
    }
  };
}

export default function MarketplaceItemDetails() {
  usePageStyles("marketplace.css");
  usePageStyles("marketplace-item.css");
  const navigate = useNavigate();
  const { itemId } = useParams();
  const accountMenuRef = useRef(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [openSection, setOpenSection] = useState("product");
  const [item, setItem] = useState(null);
  const [relatedItems, setRelatedItems] = useState([]);
  const [sellerListingCount, setSellerListingCount] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [contacting, setContacting] = useState(false);
  const { user, token, logout: logoutUser } = useAuth();
  const favoritesError = useSelector(selectMarketplaceFavoritesError);
  useMarketplaceFavoritesSync();

  useEffect(() => {
    if (!user || !token) navigate("/login", { replace: true });
  }, [navigate, token, user]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus("loading");
    setActiveImage(0);

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
        logoutUser();
        navigate("/login", { replace: true });
        return;
      }
      setStatus(error.response?.status === 404 ? "not-found" : "error");
    });

    return () => { cancelled = true; };
  }, [itemId, logoutUser, navigate, token]);

  useEffect(() => {
    if (!token || !item?.seller?.id) return;
    let cancelled = false;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      axios.get(API_URL, { headers }),
      axios.get(`${API_URL}/sellers/${item.seller.id}`, { headers })
    ]).then(([feedResult, sellerResult]) => {
      if (cancelled) return;
      if (
        (feedResult.status === "rejected" && feedResult.reason?.response?.status === 401) ||
        (sellerResult.status === "rejected" && sellerResult.reason?.response?.status === 401)
      ) {
        logoutUser();
        navigate("/login", { replace: true });
        return;
      }
      if (feedResult.status === "fulfilled") {
        const otherItems = (feedResult.value.data.items || [])
          .filter((candidate) => String(candidate.id || candidate._id) !== String(itemId))
          .sort((first, second) => Number(second.category === item.category) - Number(first.category === item.category))
          .slice(0, 4)
          .map(normalizeMarketplaceItem);
        setRelatedItems(otherItems);
      }
      if (sellerResult.status === "fulfilled") {
        setSellerListingCount(sellerResult.value.data.seller?.activeListingCount ?? null);
      }
    });

    return () => { cancelled = true; };
  }, [item, itemId, logoutUser, navigate, token]);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setLightboxOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [lightboxOpen]);

  useEffect(() => {
    function closeMenu(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) setAccountMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  function logout() {
    logoutUser();
    navigate("/login", { replace: true });
  }

  async function contactSeller() {
    try {
      setContacting(true);
      setMessage("");
      const { data } = await axios.post(
        `${API_BASE_URL}/messages/conversations`,
        { itemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/marketplace?chat=${data.conversation.id}`);
    } catch (error) {
      if (error.response?.status === 401) {
        logoutUser();
        navigate("/login", { replace: true });
        return;
      }
      setMessage(error.response?.data?.message || "Could not open this conversation.");
    } finally {
      setContacting(false);
    }
  }

  function showAdjacentImage(direction) {
    setActiveImage((current) => (current + direction + item.images.length) % item.images.length);
  }

  if (!user || !token) return null;

  const isRental = item?.listingType === "rent";
  const price = isRental ? item?.rentalPricePerDay : item?.price;
  const isOwnListing = item && String(item.seller?.id) === String(user.id || user._id);
  const availabilityLabel = item?.availabilityStatus === "active" ? "Available" : "Unavailable";
  const accordionSections = item ? [
    {
      id: "product",
      label: "Product details",
      content: <dl><div><dt>Brand</dt><dd>{item.brand}</dd></div><div><dt>Category</dt><dd>{item.category}</dd></div><div><dt>Listing</dt><dd>{isRental ? "For rent" : "For sale"}</dd></div></dl>
    },
    { id: "size", label: "Size & fit", content: <p>Size: {item.size}</p> },
    { id: "condition", label: "Condition", content: <p>{item.condition}</p> },
    {
      id: "terms",
      label: "Delivery & rental terms",
      content: <p>{isRental ? `Rental price: ₪${price} per day. ` : "Offered for sale. "}Current availability: {availabilityLabel}.</p>
    }
  ] : [];

  return (
    <div className="market-detail-page">
      <header className="market-detail-topbar">
        <button className="market-detail-logo" type="button" onClick={() => navigate("/")}>Re<span>Style</span></button>
        <nav aria-label="Main navigation">
          <button type="button" onClick={() => navigate("/")}>Home</button>
          <button type="button" onClick={() => navigate("/closet")}>My Closet</button>
          <button type="button" className="active" onClick={() => navigate("/marketplace")}>Marketplace</button>
          <button type="button" onClick={() => navigate("/outfit-builder")}>Outfit Builder</button>
          <button type="button" onClick={() => navigate("/restyle-studio")}>ReStyle Studio</button>
        </nav>
        <div className="market-detail-account" ref={accountMenuRef}>
          <button type="button" className="market-detail-profile" onClick={() => setAccountMenuOpen((open) => !open)} aria-expanded={accountMenuOpen}>
            <ProfileAvatar token={token} user={user} /><span>{user.firstName}</span><i className="fa-solid fa-chevron-down" />
          </button>
          {accountMenuOpen && (
            <div className="market-detail-menu">
              <strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span>
              <button type="button" onClick={() => navigate("/profile")}><i className="fa-regular fa-user" /> My Profile</button>
              <button type="button" onClick={() => navigate("/settings")}><i className="fa-solid fa-gear" /> Settings</button>
              <button type="button" onClick={() => navigate("/marketplace/favorites")}><i className="fa-regular fa-heart" /> Marketplace Saved Items</button>
              <button type="button" onClick={() => navigate("/saved-looks")}><i className="fa-regular fa-bookmark" /> My Saved Looks</button>
              <button type="button" onClick={logout}><i className="fa-solid fa-arrow-right-from-bracket" /> Logout</button>
            </div>
          )}
        </div>
      </header>

      <main className="market-detail-main">
        <div className="market-detail-breadcrumbs" aria-label="Breadcrumb">
          <button type="button" onClick={() => navigate("/marketplace")}>Marketplace</button><span aria-hidden="true">/</span><span>{item?.category || "Category"}</span>
        </div>

        {status === "loading" && <section className="market-detail-state" role="status"><span className="market-detail-spinner" /><h1>Loading this piece...</h1></section>}
        {status === "not-found" && <section className="market-detail-state"><i className="fa-regular fa-circle-xmark" /><h1>Item not found</h1><p>This listing may have been removed or is no longer available.</p><button type="button" onClick={() => navigate("/marketplace")}>Browse Marketplace</button></section>}
        {status === "error" && <section className="market-detail-state"><i className="fa-solid fa-triangle-exclamation" /><h1>We could not load this item</h1><p>Please try again in a moment.</p></section>}

        {status === "ready" && item && (
          <>
            <article className="market-detail-card">
              <section className={`market-detail-gallery${item.images.length <= 1 ? " single-image" : ""}`} aria-label={`${item.name} images`}>
                <div className="market-detail-main-image">
                  <img src={item.images[activeImage]} alt={`${item.name} — image ${activeImage + 1}`} />
                  <button className="market-detail-zoom" type="button" onClick={() => setLightboxOpen(true)} aria-label={`Enlarge image of ${item.name}`}><i className="fa-solid fa-expand" /></button>
                </div>
                {item.images.length > 1 && <div className="market-detail-thumbnails">
                  {item.images.map((image, index) => <button type="button" className={activeImage === index ? "active" : ""} key={`${image}-${index}`} onClick={() => setActiveImage(index)} aria-label={`Show image ${index + 1} of ${item.name}`} aria-pressed={activeImage === index}><img src={image} alt={`${item.name} thumbnail ${index + 1}`} /></button>)}
                </div>}
              </section>

              <section className="market-detail-info">
                <div className="market-detail-label">{item.brand} · {item.category}</div>
                <div className="market-detail-badges">
                  <span className={isRental ? "rent" : "sale"}>{isRental ? "FOR RENT" : "FOR SALE"}</span>
                  <span className={`availability ${item.availabilityStatus}`}>{availabilityLabel}</span>
                </div>
                <h1>{item.name}</h1>
                <p className="market-detail-price">₪{price}{isRental && <small>/ day</small>}</p>
                <div className="market-detail-quick-facts"><span><small>Size</small>{item.size}</span><span><small>Condition</small>{item.condition}</span></div>
                <p className="market-detail-summary">{item.description}</p>

                <div className="market-detail-accordions">
                  {accordionSections.map((section) => {
                    const expanded = openSection === section.id;
                    return <div className="market-detail-accordion" key={section.id}>
                      <button type="button" onClick={() => setOpenSection(expanded ? "" : section.id)} aria-expanded={expanded} aria-controls={`detail-panel-${section.id}`}>
                        <span>{section.label}</span><i className={`fa-solid fa-${expanded ? "minus" : "plus"}`} aria-hidden="true" />
                      </button>
                      {expanded && <div id={`detail-panel-${section.id}`} className="market-detail-accordion-panel">{section.content}</div>}
                    </div>;
                  })}
                </div>

                <section className="market-detail-seller" aria-label="Seller">
                  <button type="button" className="market-detail-seller-identity" onClick={() => navigate(`/marketplace/sellers/${item.seller.id}`)}>
                    <MarketplaceSellerAvatar seller={item.seller} /><span><small>Listed by</small><strong>{item.seller?.name || "ReStyle member"}</strong>{sellerListingCount !== null && <em>{sellerListingCount} active {sellerListingCount === 1 ? "listing" : "listings"}</em>}</span>
                  </button>
                  <button type="button" className="market-detail-view-profile" onClick={() => navigate(`/marketplace/sellers/${item.seller.id}`)}>View profile <i className="fa-solid fa-arrow-right" /></button>
                </section>

                {!isOwnListing ? <div className="market-detail-actions">
                  <button type="button" className="market-contact-seller" onClick={contactSeller} disabled={item.availabilityStatus !== "active" || contacting}>
                    <i className="fa-regular fa-comment-dots" /> {contacting ? "Opening conversation..." : "Contact seller"}
                  </button>
                  <MarketplaceFavoriteButton
                    item={item}
                    className="market-save-item"
                    showLabel
                  />
                </div> : <div className="market-detail-owner-actions">
                  <span><i className="fa-regular fa-circle-check" /> This is your listing</span>
                  <button type="button" onClick={() => navigate("/marketplace?view=mine")}>Manage listing</button>
                </div>}
                {message && <p className="market-detail-coming-soon" role="status">{message}</p>}
                {favoritesError && <p className="market-detail-coming-soon" role="alert">{favoritesError}</p>}
                <div className="market-detail-trust"><span><i className="fa-solid fa-shield-heart" /> Secure ReStyle conversation</span><span><i className="fa-solid fa-leaf" /> Give fashion a second life</span></div>
              </section>
            </article>

            {relatedItems.length > 0 && <section className="market-detail-recommendations" aria-labelledby="recommendations-title">
              <p>More from the community</p><h2 id="recommendations-title">You may also like</h2>
              <div className="market-detail-recommendations-grid">
                {relatedItems.map((related) => <MarketplaceItemCard key={related.id} item={related} onOpen={(id) => navigate(`/marketplace/items/${id}`)} onSellerOpen={(sellerId) => navigate(`/marketplace/sellers/${sellerId}`)} />)}
              </div>
            </section>}
          </>
        )}
      </main>

      {lightboxOpen && item && <div className="market-detail-lightbox" role="dialog" aria-modal="true" aria-label={`${item.name} image viewer`} onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxOpen(false); }}>
        <button type="button" className="market-detail-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Close image viewer"><i className="fa-solid fa-xmark" /></button>
        {item.images.length > 1 && <button type="button" className="market-detail-lightbox-previous" onClick={() => showAdjacentImage(-1)} aria-label="Previous image"><i className="fa-solid fa-chevron-left" /></button>}
        <img src={item.images[activeImage]} alt={`${item.name} enlarged — image ${activeImage + 1}`} />
        {item.images.length > 1 && <button type="button" className="market-detail-lightbox-next" onClick={() => showAdjacentImage(1)} aria-label="Next image"><i className="fa-solid fa-chevron-right" /></button>}
      </div>}
    </div>
  );
}
