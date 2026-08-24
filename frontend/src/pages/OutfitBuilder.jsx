import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import usePageStyles from "../hooks/usePageStyles";
import { useAuth } from "../context/AuthContext";

const OUTFIT_API_URL = "http://localhost:3001/api/outfits/generate";
const TRY_ON_API_URL = "http://localhost:3001/api/outfits/try-on";
const TRY_ON_STATUS_API_URL = "http://localhost:3001/api/outfits/try-on/status";
const VIRTUAL_MODEL_API_URL =
  "http://localhost:3001/api/auth/virtual-model-image";
const FEMALE_AVATAR_URL = "/images/avatars/fashion-avatar-v2.png";
const MALE_AVATAR_URL = "/images/avatars/fashion-avatar-male.png";

function getDefaultAvatarUrl(user) {
  return user?.gender === "male" ? MALE_AVATAR_URL : FEMALE_AVATAR_URL;
}

function getPresetAvatarId(user) {
  return user?.gender === "male" ? "male-illustrated" : "female-illustrated";
}

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
  const { user, token, logout } = useAuth();
  const modelFileInputRef = useRef(null);
  const modalCloseButtonRef = useRef(null);
  const planModalRef = useRef(null);
  const defaultAvatarUrl = getDefaultAvatarUrl(user);
  const [eventType, setEventType] = useState("Work");
  const [customEvent, setCustomEvent] = useState("");
  const [style, setStyle] = useState("Elegant");
  const [weather, setWeather] = useState("Mild");
  const [preferFavorites, setPreferFavorites] = useState(true);
  const [isPreview, setIsPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [outfit, setOutfit] = useState(null);
  const [selectionId, setSelectionId] = useState("");
  const [aiError, setAiError] = useState("");
  const [modelChoice, setModelChoice] = useState("illustrated");
  const [personalModelUrl, setPersonalModelUrl] = useState("");
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [modelMessage, setModelMessage] = useState("");
  const [isTryingOn, setIsTryingOn] = useState(false);
  const [tryOnImage, setTryOnImage] = useState("");
  const [tryOnItems, setTryOnItems] = useState([]);
  const [tryOnError, setTryOnError] = useState("");
  const [quota, setQuota] = useState(null);
  const [isQuotaLoading, setIsQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState("");
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [plansMessage, setPlansMessage] = useState("");
  const userId = user?.id || user?._id;
  const sessionKey = userId ? `restyle:outfit-builder:${userId}` : "";

  function persistBuilderState(
    nextOutfit,
    nextSelectionId,
    nextModelChoice = modelChoice,
    nextTryOnImage = ""
  ) {
    if (!sessionKey) return;
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({
        selectionId: nextSelectionId,
        outfit: nextOutfit,
        modelChoice: nextModelChoice,
        tryOnImage: nextTryOnImage
      }));
    } catch {
      // The current screen still works if browser storage is unavailable or full.
    }
  }

  async function loadQuotaStatus() {
    if (!token) return;
    try {
      setIsQuotaLoading(true);
      setQuotaError("");
      const { data } = await axios.get(TRY_ON_STATUS_API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuota(data);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setQuota(null);
      setQuotaError("Could not load your try-on allowance.");
    } finally {
      setIsQuotaLoading(false);
    }
  }

  useEffect(() => {
    setOutfit(null);
    setSelectionId("");
    setTryOnImage("");
    setTryOnItems([]);
    setTryOnError("");
    setIsPreview(false);
    if (!sessionKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey));
      if (saved?.selectionId && saved?.outfit?.items?.length && saved?.tryOnImage) {
        setSelectionId(saved.selectionId);
        setOutfit(saved.outfit);
        setTryOnImage(saved.tryOnImage);
        setModelChoice(saved.modelChoice === "personal" ? "personal" : "illustrated");
        setIsPreview(true);
      }
    } catch {
      sessionStorage.removeItem(sessionKey);
    }
  }, [sessionKey]);

  useEffect(() => {
    loadQuotaStatus();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isPlansOpen) return undefined;
    modalCloseButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsPlansOpen(false);
      if (event.key === "Tab") {
        const controls = planModalRef.current?.querySelectorAll("button");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isPlansOpen]);

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    if (!token) {
      return undefined;
    }

    axios
      .get(VIRTUAL_MODEL_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob"
      })
      .then(({ data }) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(data);
        setPersonalModelUrl(objectUrl);
      })
      .catch((error) => {
        if (error.response?.status === 401) {
          logout();
          navigate("/login", { replace: true });
          return;
        }
        setPersonalModelUrl("");
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [logout, navigate, token]);

  async function uploadVirtualModel(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setModelMessage("Please choose a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setModelMessage("Your full-body image must be smaller than 5MB.");
      event.target.value = "";
      return;
    }

    const body = new FormData();
    body.append("virtualModelImage", file);

    try {
      setIsSavingModel(true);
      setModelMessage("");

      await axios.put(VIRTUAL_MODEL_API_URL, body, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (personalModelUrl.startsWith("blob:")) {
        URL.revokeObjectURL(personalModelUrl);
      }

      setPersonalModelUrl(URL.createObjectURL(file));
      setModelChoice("personal");
      setModelMessage("Your private model photo is ready.");
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setModelMessage(
        error.response?.data?.message ||
          "Could not save your model photo."
      );
    } finally {
      setIsSavingModel(false);
      event.target.value = "";
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (eventType === "Other" && !customEvent.trim()) {
      window.alert("Please describe your event.");
      return;
    }
    if (!quota) {
      setAiError(quotaError || "Your try-on allowance is still loading. Please wait a moment.");
      return;
    }
    if (quota.freeTryOnsRemaining === 0 && quota.tryOnCredits === 0) {
      setPlansMessage("");
      setIsPlansOpen(true);
      return;
    }

    try {
      setIsCreating(true);
      setAiError("");

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

      const nextSelectionId = data.selectionId || data.outfit?.selectionId;
      if (!nextSelectionId || !data.outfit?.items?.length) {
        throw new Error("The outfit response was incomplete");
      }
      setSelectionId(nextSelectionId);
      setOutfit(data.outfit);
      setTryOnImage("");
      setTryOnItems([]);
      setTryOnError("");
      setIsPreview(true);
      persistBuilderState(data.outfit, nextSelectionId);
      await createVirtualTryOn(nextSelectionId, data.outfit);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
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

  async function createVirtualTryOn(
    requestedSelectionId = selectionId,
    requestedOutfit = outfit
  ) {
    if (!requestedSelectionId || !requestedOutfit?.items?.length || isTryingOn) {
      return;
    }
    if (!quota) {
      setTryOnError("Load your try-on allowance before continuing.");
      return;
    }
    if (quota.freeTryOnsRemaining === 0 && quota.tryOnCredits === 0) {
      setPlansMessage("");
      setIsPlansOpen(true);
      return;
    }

    try {
      setIsTryingOn(true);
      setTryOnError("");
      const body = new FormData();
      body.append("selectionId", requestedSelectionId);
      if (modelChoice === "personal") {
        body.append("avatarSource", "personal");
      } else {
        body.append("avatarSource", "preset");
        body.append("avatarId", getPresetAvatarId(user));
      }

      const { data } = await axios.post(TRY_ON_API_URL, body, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTryOnImage(data.tryOnImage);
      setTryOnItems(Array.isArray(data.items)
        ? data.items.map((item) => ({
            ...item,
            image: requestedOutfit.items.find((outfitItem) =>
              String(outfitItem._id) === String(item.itemId)
            )?.image || ""
          }))
        : []);
      setQuota({
        freeTryOnsUsed: data.freeTryOnsUsed,
        freeTryOnsRemaining: data.freeTryOnsRemaining,
        subscriptionPlan: data.subscriptionPlan,
        tryOnCredits: data.tryOnCredits
      });
      persistBuilderState(
        requestedOutfit,
        requestedSelectionId,
        modelChoice,
        data.tryOnImage
      );
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      if (error.response?.status === 403 &&
        error.response?.data?.code === "FREE_TRY_ON_LIMIT_REACHED") {
        setPlansMessage("");
        setIsPlansOpen(true);
        return;
      }
      if (error.response?.status === 409 &&
        error.response?.data?.code === "TRY_ON_ALREADY_IN_PROGRESS") {
        setTryOnError("Your virtual try-on is already being created. Please wait a moment.");
        return;
      }
      setTryOnError(
        error.response?.data?.message ||
          "Could not create the virtual try-on. Please try again later."
      );
    } finally {
      setIsTryingOn(false);
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

            <div className="studio-section virtual-model-section">
              <div className="studio-label">Choose your virtual model</div>

              <div className="model-choice-grid">
                <button
                  type="button"
                  className={modelChoice === "illustrated" ? "selected" : ""}
                  onClick={() => setModelChoice("illustrated")}
                >
                  <img src={defaultAvatarUrl} alt="Default fashion avatar" />
                  <span>
                    <strong>Airy Avatar</strong>
                    A neutral mannequin, no personal photo needed
                  </span>
                </button>

                <button
                  type="button"
                  className={modelChoice === "personal" ? "selected" : ""}
                  onClick={() => {
                    if (personalModelUrl) {
                      setModelChoice("personal");
                    } else {
                      modelFileInputRef.current?.click();
                    }
                  }}
                >
                  {personalModelUrl ? (
                    <img src={personalModelUrl} alt="My virtual model" />
                  ) : (
                    <i className="fa-solid fa-camera" />
                  )}
                  <span>
                    <strong>My Digital Model</strong>
                    {personalModelUrl
                      ? "Use my face and body"
                      : "Upload a clear full-body photo"}
                  </span>
                </button>
              </div>

              <input
                ref={modelFileInputRef}
                className="model-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={uploadVirtualModel}
              />

              <button
                type="button"
                className="replace-model-button"
                disabled={isSavingModel}
                onClick={() => modelFileInputRef.current?.click()}
              >
                {isSavingModel ? "Saving photo..." : "Upload or replace my photo"}
              </button>

              <small className="model-privacy-note">
                <i className="fa-solid fa-lock" />
                Your selected avatar or body photo and wardrobe item images are
                securely sent to Google Gemini to create your virtual try-on.
              </small>

              <small className="model-photo-guidance">
                For the best result: stand facing the camera with your full body
                clearly visible and filling most of the photo.
              </small>

              {modelMessage && <p className="model-message">{modelMessage}</p>}
            </div>

            {aiError && <p className="ai-error">{aiError}</p>}

            <button
              type="submit"
              className="style-me-button"
              disabled={isCreating || isQuotaLoading}
            >
              <span className="button-stars">✦</span>
              {isCreating ? "Creating your complete look..." : "Style Me"}
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
            <div className="look-board">
              {isTryingOn ? (
                <div className="try-on-loading" role="status" aria-live="polite">
                  <div className="try-on-loader">
                    <i className="fa-solid fa-shirt" />
                  </div>
                  <strong>Creating your virtual try-on…</strong>
                  <span>
                    Keeping your appearance while dressing you in the selected
                    pieces from your wardrobe.
                  </span>
                </div>
              ) : tryOnImage ? (
                <div className={`look-model-stage${tryOnImage ? " result-ready" : ""}`}>
                  <span>YOUR VIRTUAL TRY-ON</span>
                  <img
                    src={tryOnImage}
                    alt="Generated virtual try-on"
                  />
                </div>
              ) : (
                <div className="try-on-ready">
                  <i className="fa-solid fa-wand-magic-sparkles" />
                  <strong>Your virtual look could not be completed</strong>
                  <span>Edit your request and create a new complete look.</span>
                </div>
              )}
            </div>

            <section className="selected-look-summary" aria-labelledby="used-items-title">
              <h3 id="used-items-title">Pieces used from your wardrobe</h3>
              <div className="selected-item-grid">
                {(tryOnItems.length ? tryOnItems : outfit?.items || []).map((item) => (
                  <article key={item.itemId || item._id} className="selected-item-card">
                    <img src={item.image} alt={item.name} loading="lazy" />
                    <span>
                      <strong>{item.name}</strong>
                      {item.detectedCategory || item.category}
                    </span>
                  </article>
                ))}
              </div>
            </section>

            {tryOnError && <p className="ai-error">{tryOnError}</p>}

            {tryOnImage && quota && (
              <div className="try-on-quota-result">
                <p>{quota.freeTryOnsRemaining} of 3 free try-ons remaining</p>
                {quota.tryOnCredits > 0 && (
                  <small>Additional try-on credits: {quota.tryOnCredits}</small>
                )}
              </div>
            )}

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
                setSelectionId("");
                setTryOnImage("");
                setTryOnItems([]);
                setTryOnError("");
                if (sessionKey) sessionStorage.removeItem(sessionKey);
              }}
            >
              Edit my request
            </button>
          </div>
        )}
      </section>

      {isPlansOpen && (
        <div className="try-on-plan-overlay" role="presentation">
          <section
            ref={planModalRef}
            className="try-on-plan-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="try-on-plan-title"
            aria-describedby="try-on-plan-description"
          >
            <button
              ref={modalCloseButtonRef}
              type="button"
              className="try-on-plan-close"
              aria-label="Close plans"
              onClick={() => setIsPlansOpen(false)}
            >
              ×
            </button>
            <h2 id="try-on-plan-title">Your free try-ons are complete</h2>
            <p id="try-on-plan-description">
              You have used all 3 free virtual try-ons. Choose a plan to continue creating personal looks.
            </p>
            <div className="try-on-plans">
              <article>
                <h3>Mini Plan</h3>
                <p>10 Try-ons for ₪9.90</p>
                <button type="button" onClick={() => setPlansMessage("Payments will be available soon.")}>
                  Choose Mini
                </button>
              </article>
              <article>
                <h3>Style Plan</h3>
                <p>30 Try-ons for ₪19.90</p>
                <button type="button" onClick={() => setPlansMessage("Payments will be available soon.")}>
                  Choose Style
                </button>
              </article>
            </div>
            {plansMessage && <p className="plans-coming-soon" role="status">{plansMessage}</p>}
          </section>
        </div>
      )}

    </main>
  );
}
