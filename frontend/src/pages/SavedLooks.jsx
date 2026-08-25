import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import usePageStyles from "../hooks/usePageStyles";

const SAVED_LOOKS_API_URL = "http://localhost:3001/api/outfits/saved";

export default function SavedLooks() {
  usePageStyles("saved-looks.css");
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const [looks, setLooks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSavedLooks() {
      try {
        const { data } = await axios.get(SAVED_LOOKS_API_URL, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!active) return;
        setLooks(Array.isArray(data.savedLooks) ? data.savedLooks : []);
        setStatus("ready");
      } catch (error) {
        if (!active) return;
        if (error.response?.status === 401) {
          logout();
          navigate("/login", { replace: true });
          return;
        }
        setMessage("Could not load your saved looks. Please try again.");
        setStatus("error");
      }
    }

    loadSavedLooks();
    return () => { active = false; };
  }, [logout, navigate, token]);

  return (
    <main className="saved-looks-page">
      <header className="saved-looks-header">
        <button type="button" onClick={() => navigate("/outfit-builder")}>
          <i className="fa-solid fa-arrow-left" /> Outfit Builder
        </button>
        <div className="saved-looks-brand">Re<span>Style</span></div>
        <button type="button" onClick={() => navigate("/closet")}>My Closet</button>
      </header>

      <section className="saved-looks-content">
        <span className="saved-looks-sparkle">✦</span>
        <p className="saved-looks-eyebrow">YOUR PERSONAL COLLECTION</p>
        <h1>My Saved Looks</h1>
        <p className="saved-looks-intro">Your favorite AI-styled outfits, saved to your account.</p>

        {status === "loading" && (
          <div className="saved-looks-state" role="status">
            <span className="saved-looks-loader" />
            <strong>Loading your looks…</strong>
          </div>
        )}

        {status === "error" && (
          <div className="saved-looks-state error" role="alert">
            <i className="fa-solid fa-circle-exclamation" />
            <strong>{message}</strong>
          </div>
        )}

        {status === "ready" && looks.length === 0 && (
          <div className="saved-looks-empty">
            <i className="fa-regular fa-bookmark" />
            <h2>No saved looks yet</h2>
            <p>Create a virtual look and select “Save this look” to keep it here.</p>
            <button type="button" onClick={() => navigate("/outfit-builder")}>Create a look</button>
          </div>
        )}

        {status === "ready" && looks.length > 0 && (
          <div className="saved-looks-grid">
            {looks.map((look) => (
              <article className="saved-look-card" key={look.id}>
                <img className="saved-look-main-image" src={look.image} alt={look.title} />
                <div className="saved-look-details">
                  <time dateTime={look.savedAt}>
                    Saved {new Date(look.savedAt).toLocaleDateString()}
                  </time>
                  <h2>{look.title}</h2>
                  <div className="saved-look-items" aria-label="Wardrobe pieces">
                    {look.items.map((item) => (
                      <span key={item.id}>
                        {item.image && <img src={item.image} alt="" />}
                        {item.name}
                      </span>
                    ))}
                  </div>
                  <h3>Why this look works</h3>
                  <p>{look.explanation}</p>
                  {!!look.stylingTips?.length && (
                    <ul>
                      {look.stylingTips.map((tip) => <li key={tip}>{tip}</li>)}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
