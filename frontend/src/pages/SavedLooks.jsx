import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useAuthorizationConfig from "../hooks/useAuthorizationConfig";
import { API_BASE_URL } from "../config/api";

const SAVED_LOOKS_API_URL = `${API_BASE_URL}/outfits/saved`;

export default function SavedLooks() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const requestConfig = useAuthorizationConfig(token);
  const [looks, setLooks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [deletingLookId, setDeletingLookId] = useState("");
  const [pendingDeleteLook, setPendingDeleteLook] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadSavedLooks() {
      try {
        const { data } = await axios.get(SAVED_LOOKS_API_URL, requestConfig);
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
  }, [logout, navigate, requestConfig]);

  async function deleteSavedLook() {
    if (!pendingDeleteLook) return;
    const look = pendingDeleteLook;
    try {
      setDeletingLookId(look.id);
      setMessage("");
      await axios.delete(`${SAVED_LOOKS_API_URL}/${look.id}`, requestConfig);
      setLooks((currentLooks) => currentLooks.filter((savedLook) => savedLook.id !== look.id));
      setPendingDeleteLook(null);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setMessage(error.response?.data?.message || "Could not delete this look. Please try again.");
    } finally {
      setDeletingLookId("");
    }
  }

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
        {status === "ready" && message && (
          <p className="saved-looks-action-error" role="alert">{message}</p>
        )}

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
                  <button
                    type="button"
                    className="delete-saved-look"
                    onClick={() => setPendingDeleteLook(look)}
                    disabled={deletingLookId === look.id}
                  >
                    <i className="fa-regular fa-trash-can" />
                    {deletingLookId === look.id ? "Deleting…" : "Delete this look"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {pendingDeleteLook && (
        <div className="delete-look-overlay" role="presentation">
          <section
            className="delete-look-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-look-title"
            aria-describedby="delete-look-description"
          >
            <span className="delete-look-icon"><i className="fa-regular fa-trash-can" /></span>
            <h2 id="delete-look-title">Delete this saved look?</h2>
            <p id="delete-look-description">
              Are you sure you want to delete “{pendingDeleteLook.title}”? Once deleted,
              it will no longer appear in your saved looks.
            </p>
            <div className="delete-look-actions">
              <button
                type="button"
                className="cancel-delete-look"
                onClick={() => setPendingDeleteLook(null)}
                disabled={Boolean(deletingLookId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-delete-look"
                onClick={deleteSavedLook}
                disabled={Boolean(deletingLookId)}
              >
                {deletingLookId ? "Deleting…" : "Delete look"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
