import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import usePageStyles from "../hooks/usePageStyles";

const OUTFIT_API_URL = "http://localhost:3001/api/outfits/generate";

const events = [
  ["Work", "fa-briefcase"],
  ["Date", "fa-heart"],
  ["Party", "fa-champagne-glasses"],
  ["Formal", "fa-gem"],
  ["Casual", "fa-mug-hot"],
  ["Other", "fa-pen"]
];

const styles = ["Casual", "Classic", "Elegant", "Sporty", "Streetwear"];
const weatherOptions = ["Warm", "Mild", "Cold", "Rainy"];

export default function OutfitBuilder() {
  usePageStyles("outfit-builder.css");

  const navigate = useNavigate();
  const [eventType, setEventType] = useState("Work");
  const [customEvent, setCustomEvent] = useState("");
  const [style, setStyle] = useState("Elegant");
  const [weather, setWeather] = useState("Mild");
  const [preferFavorites, setPreferFavorites] = useState(true);
  const [isPreview, setIsPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [outfit, setOutfit] = useState(null);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  async function submit(event) {
    event.preventDefault();

    if (eventType === "Other" && !customEvent.trim()) {
      window.alert("Please describe your event.");
      return;
    }

    try {
      setIsCreating(true);
      setAiError("");

      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        OUTFIT_API_URL,
        {
          event: eventType === "Other" ? customEvent.trim() : eventType,
          style,
          weather,
          preferFavorites
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setOutfit(data.outfit);
      setIsPreview(true);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      setAiError(
        error.response?.data?.message ||
          "Could not create your outfit. Please try again."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="stylist-studio">
      <button
        type="button"
        className="studio-back"
        onClick={() => navigate("/closet")}
      >
        <i className="fa-solid fa-arrow-left" />
        My Closet
      </button>

      <div className="studio-brand">
        Re<span>Style</span>
      </div>

      <section className={`stylist-window${isPreview ? " preview-mode" : ""}`}>
        {!isPreview ? (
          <form className="stylist-form" onSubmit={submit}>
            <header className="stylist-heading">
              <span className="stylist-sparkle">✦</span>
              <p>YOUR PERSONAL AI STYLIST</p>
              <h1>Create a look for your moment</h1>
              <span>
                Designed only with pieces from your own wardrobe
              </span>
            </header>

            <div className="studio-section">
              <div className="studio-label">
                Where are you going?
              </div>

              <div className="occasion-list">
                {events.map(([name, icon]) => (
                  <button
                    type="button"
                    key={name}
                    className={eventType === name ? "selected" : ""}
                    onClick={() => setEventType(name)}
                  >
                    <i className={`fa-solid ${icon}`} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>

              {eventType === "Other" && (
                <div className="other-event-field">
                  <textarea
                    value={customEvent}
                    onChange={(event) => setCustomEvent(event.target.value)}
                    placeholder="Tell your stylist about the event..."
                    maxLength={250}
                    autoFocus
                  />
                  <small>{customEvent.length}/250</small>
                </div>
              )}
            </div>

            <div className="studio-section preferences-section">
              <div className="studio-label">
                Set the mood
              </div>

              <div className="preference-row">
                <label>
                  <span>Style</span>
                  <select value={style} onChange={(event) => setStyle(event.target.value)}>
                    {styles.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>

                <label>
                  <span>Weather</span>
                  <select value={weather} onChange={(event) => setWeather(event.target.value)}>
                    {weatherOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>

                <label className="heart-choice">
                  <input
                    type="checkbox"
                    checked={preferFavorites}
                    onChange={(event) => setPreferFavorites(event.target.checked)}
                  />
                  <span className="heart-check">
                    <i className="fa-solid fa-heart" />
                  </span>
                  <span>
                    <strong>Favorites first</strong>
                    Prefer pieces I love
                  </span>
                </label>
              </div>
            </div>

            {aiError && <p className="ai-error">{aiError}</p>}

            <button
              type="submit"
              className="style-me-button"
              disabled={isCreating}
            >
              <span className="button-stars">✦</span>
              {isCreating ? "Creating your look..." : "Style Me"}
              <i className="fa-solid fa-arrow-right" />
            </button>
          </form>
        ) : (
          <div className="look-preview">
            <span className="preview-sparkle">✦</span>
            <p>YOUR PERSONAL LOOK IS READY</p>
            <h2>{outfit?.title}</h2>
            <div className="preview-request">
              <span>{eventType === "Other" ? customEvent : eventType}</span>
              <span>{style}</span>
              <span>{weather}</span>
            </div>
            <div className="outfit-items">
              {outfit?.items.map((item) => (
                <article className="outfit-piece" key={item._id}>
                  <img src={item.image} alt={item.name} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.category} · {item.color}</span>
                  </div>
                </article>
              ))}
            </div>

            <p className="outfit-explanation">{outfit?.explanation}</p>

            <ul className="styling-tips">
              {outfit?.stylingTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => {
                setIsPreview(false);
                setOutfit(null);
              }}
            >
              Edit my request
            </button>
          </div>
        )}
      </section>

    </main>
  );
}
