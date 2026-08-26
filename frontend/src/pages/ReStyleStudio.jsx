import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import ProfileAvatar from "../components/ProfileAvatar";
import { useAuth } from "../context/AuthContext";
import usePageStyles from "../hooks/usePageStyles";
import {
  isAutomaticallyEligibleForRestyle,
  LESS_WORN_DAYS
} from "../utils/wardrobeInsights";

const studioSteps = [
  ["01", "Choose a garment", "Select an item from My Closet or upload a new photo."],
  ["02", "Tell us about it", "Add the fabric, condition, available tools and preferred difficulty."],
  ["03", "Explore ideas", "Receive practical transformations tailored to the garment."],
  ["04", "Make it yours", "Follow the guide, track your progress and save the finished piece."]
];

const ITEMS_API_URL = "http://localhost:3001/api/items";
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxUploadSize = 5 * 1024 * 1024;

export default function ReStyleStudio() {
  usePageStyles("restyle-studio.css");

  const navigate = useNavigate();
  const menuRef = useRef(null);
  const selectionRef = useRef(null);
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState("closet");
  const [closetItems, setClosetItems] = useState([]);
  const [closetStatus, setClosetStatus] = useState("loading");
  const [closetError, setClosetError] = useState("");
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const { user, token, logout } = useAuth();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function loadClosetItems() {
      try {
        setClosetStatus("loading");
        setClosetError("");
        const { data } = await axios.get(ITEMS_API_URL, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) {
          setClosetItems((data.items || []).filter(isAutomaticallyEligibleForRestyle));
          setClosetStatus("ready");
        }
      } catch (error) {
        if (cancelled) return;
        if (error.response?.status === 401) {
          logout();
          navigate("/login", { replace: true });
          return;
        }
        setClosetError(error.response?.data?.message || "Could not load your closet items.");
        setClosetStatus("error");
      }
    }

    loadClosetItems();
    return () => { cancelled = true; };
  }, [logout, navigate, token]);

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

  function chooseClosetItem(item) {
    setUploadError("");
    setSelectedGarment({
      source: "closet",
      id: item._id || item.id,
      name: item.name,
      category: item.category,
      image: item.image
    });
  }

  function chooseUploadedImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!acceptedImageTypes.includes(file.type)) {
      setUploadError("Please choose a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > maxUploadSize) {
      setUploadError("The image must be smaller than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedGarment({
        source: "upload",
        id: "",
        name: file.name.replace(/\.[^.]+$/, ""),
        category: "",
        image: String(reader.result),
        file
      });
      setUploadError("");
    };
    reader.onerror = () => setUploadError("Could not read this image. Please try another one.");
    reader.readAsDataURL(file);
  }

  function removeSelection() {
    setSelectedGarment(null);
    setUploadError("");
  }

  function scrollToSelection() {
    selectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          <button type="button" onClick={scrollToSelection}>
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

      <section className="restyle-garment-section" ref={selectionRef} aria-labelledby="garmentSelectionTitle">
        <div className="restyle-garment-heading">
          <span>STEP 01</span>
          <h2 id="garmentSelectionTitle">Choose the piece to transform</h2>
          <p>
            We show garments that have not been worn for at least {LESS_WORN_DAYS} days
            and have a realistic path to transformation. You can also bring in a piece
            that is not saved in your closet.
          </p>
        </div>

        <div className="restyle-source-tabs" role="tablist" aria-label="Garment source">
          <button
            type="button"
            role="tab"
            aria-selected={selectionMode === "closet"}
            className={selectionMode === "closet" ? "active" : ""}
            onClick={() => setSelectionMode("closet")}
          >
            <i className="fa-solid fa-shirt" /> From My Closet
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectionMode === "upload"}
            className={selectionMode === "upload" ? "active" : ""}
            onClick={() => setSelectionMode("upload")}
          >
            <i className="fa-solid fa-cloud-arrow-up" /> Upload a Photo
          </button>
        </div>

        <div className={`restyle-garment-workspace${selectedGarment ? " has-selection" : ""}`}>
          <div className="restyle-garment-picker">
            {selectionMode === "closet" ? (
              <>
                {closetStatus === "loading" && (
                  <div className="restyle-selection-state" role="status">
                    <span className="restyle-selection-loader" />
                    <strong>Loading your closet...</strong>
                  </div>
                )}
                {closetStatus === "error" && (
                  <div className="restyle-selection-state error" role="alert">
                    <i className="fa-solid fa-circle-exclamation" />
                    <strong>{closetError}</strong>
                  </div>
                )}
                {closetStatus === "ready" && closetItems.length === 0 && (
                  <div className="restyle-selection-state">
                    <i className="fa-regular fa-image" />
                    <strong>No garments currently need a restyle</strong>
                    <p>
                      Only suitable clothing that has not been worn for {LESS_WORN_DAYS}
                      days appears here. You can still upload another piece for review.
                    </p>
                    <button type="button" onClick={() => setSelectionMode("upload")}>Upload a Photo</button>
                  </div>
                )}
                {closetStatus === "ready" && closetItems.length > 0 && (
                  <div className="restyle-closet-grid">
                    {closetItems.map((item) => {
                      const itemId = item._id || item.id;
                      const selected = selectedGarment?.source === "closet" && selectedGarment.id === itemId;
                      return (
                        <button
                          type="button"
                          key={itemId}
                          className={selected ? "selected" : ""}
                          onClick={() => chooseClosetItem(item)}
                          aria-pressed={selected}
                        >
                          <img src={item.image} alt={item.name} loading="lazy" />
                          <span><strong>{item.name}</strong><small>{item.category}</small></span>
                          {selected && <i className="fa-solid fa-circle-check" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="restyle-upload-panel">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseUploadedImage}
                  hidden
                />
                <button type="button" className="restyle-upload-dropzone" onClick={() => fileInputRef.current?.click()}>
                  <span><i className="fa-solid fa-cloud-arrow-up" /></span>
                  <strong>{selectedGarment?.source === "upload" ? "Choose a different photo" : "Choose a garment photo"}</strong>
                  <small>JPG, PNG or WEBP · up to 5MB</small>
                </button>
                <p><i className="fa-regular fa-lightbulb" /> Use a clear, well-lit photo where the garment is easy to see.</p>
                <p><i className="fa-solid fa-shield-heart" /> Unsupported accessories will only continue when a practical, verified transformation is available.</p>
                {uploadError && <div className="restyle-upload-error" role="alert">{uploadError}</div>}
              </div>
            )}
          </div>

          <aside className="restyle-selection-preview" aria-live="polite">
            {selectedGarment ? (
              <>
                <div className="restyle-preview-image">
                  <img src={selectedGarment.image} alt={`Selected garment: ${selectedGarment.name}`} />
                  <span>{selectedGarment.source === "closet" ? "MY CLOSET" : "NEW UPLOAD"}</span>
                </div>
                <div className="restyle-preview-details">
                  <small>SELECTED GARMENT</small>
                  <h3>{selectedGarment.name || "Uploaded garment"}</h3>
                  {selectedGarment.category && <p>{selectedGarment.category}</p>}
                  <div>
                    <button
                      type="button"
                      onClick={() => selectedGarment.source === "upload"
                        ? fileInputRef.current?.click()
                        : setSelectionMode("closet")}
                    >
                      <i className="fa-solid fa-arrows-rotate" /> Replace
                    </button>
                    <button type="button" className="remove" onClick={removeSelection}>
                      <i className="fa-regular fa-trash-can" /> Remove
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="restyle-preview-empty">
                <i className="fa-regular fa-image" />
                <strong>Your garment preview</strong>
                <p>The piece you choose will appear here before you continue.</p>
              </div>
            )}
          </aside>
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
