import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import useAuthorizationConfig from "../hooks/useAuthorizationConfig";
import { useAuth } from "../context/AuthContext";
import ProfileAvatar from "../components/ProfileAvatar";
import PayPalCheckout from "../components/PayPalCheckout";
import { API_BASE_URL } from "../config/api";

const OUTFIT_API_URL = `${API_BASE_URL}/outfits/generate`;
const TRY_ON_API_URL = `${API_BASE_URL}/outfits/try-on`;
const TRY_ON_STATUS_API_URL = `${API_BASE_URL}/outfits/try-on/status`;
const SAVED_LOOKS_API_URL = `${API_BASE_URL}/outfits/saved`;
const VIRTUAL_MODEL_API_URL =
  `${API_BASE_URL}/auth/virtual-model-image`;
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

  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const requestConfig = useAuthorizationConfig(token);
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
  const [isSavingLook, setIsSavingLook] = useState(false);
  const [savedLookId, setSavedLookId] = useState("");
  const [saveLookMessage, setSaveLookMessage] = useState("");
  const [quota, setQuota] = useState(null);
  const [isQuotaLoading, setIsQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState("");
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState("");
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const userId = user?.id || user?._id;
  const sessionKey = userId ? `restyle:outfit-builder:${userId}` : "";

  function persistBuilderState(
    nextOutfit,
    nextSelectionId,
    nextModelChoice = modelChoice
  ) {
    if (!sessionKey) return;
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({
        selectionId: nextSelectionId,
        outfit: nextOutfit,
        modelChoice: nextModelChoice
      }));
    } catch {
      // The current screen still works if browser storage is unavailable or full.
    }
  }

  const loadQuotaStatus = useCallback(async () => {
    if (!token) return;
    try {
      setIsQuotaLoading(true);
      setQuotaError("");
      const { data } = await axios.get(TRY_ON_STATUS_API_URL, requestConfig);
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
  }, [logout, navigate, requestConfig, token]);

  useEffect(() => {
    setOutfit(null);
    setSelectionId("");
    setTryOnImage("");
    setTryOnItems([]);
    setTryOnError("");
    setSavedLookId("");
    setSaveLookMessage("");
    setIsPreview(false);
    if (!sessionKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey));
      if (saved?.selectionId && saved?.outfit?.items?.length) {
        setSelectionId(saved.selectionId);
        setOutfit(saved.outfit);
        setModelChoice(saved.modelChoice === "personal" ? "personal" : "illustrated");
        setIsPreview(true);
        if (Object.hasOwn(saved, "tryOnImage")) {
          sessionStorage.setItem(sessionKey, JSON.stringify({
            selectionId: saved.selectionId,
            outfit: saved.outfit,
            modelChoice: saved.modelChoice === "personal" ? "personal" : "illustrated"
          }));
        }
      }
    } catch {
      sessionStorage.removeItem(sessionKey);
    }
  }, [sessionKey]);

  useEffect(() => {
    loadQuotaStatus();
  }, [loadQuotaStatus]);

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
        ...requestConfig,
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
  }, [logout, navigate, requestConfig, token]);

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
      setModelMessage("Your digital model photo must be smaller than 5MB.");
      event.target.value = "";
      return;
    }

    try {
      const image = await createImageBitmap(file);
      const unsuitableDimensions = image.width < 300 || image.height < 600 ||
        image.height / image.width < 1.15;
      image.close();
      if (unsuitableDimensions) {
        setModelMessage(
          "This photo is not suitable. Please upload a clear vertical photo showing one person from head to at least both knees."
        );
        event.target.value = "";
        return;
      }
    } catch {
      setModelMessage("This photo could not be read. Please choose a different photo.");
      event.target.value = "";
      return;
    }

    const body = new FormData();
    body.append("virtualModelImage", file);

    try {
      setIsSavingModel(true);
      setModelMessage("");

      await axios.put(VIRTUAL_MODEL_API_URL, body, requestConfig);

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
      setAiError("Please describe your event.");
      return;
    }
    if (!quota) {
      setAiError(quotaError || "Your try-on allowance is still loading. Please wait a moment.");
      return;
    }
    if (quota.freeTryOnsRemaining === 0 && quota.tryOnCredits === 0) {
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
          preferFavorites,
          avatarSource: modelChoice === "personal" ? "personal" : "preset"
        },
        requestConfig
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
      setSavedLookId("");
      setSaveLookMessage("");
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

      const { data } = await axios.post(TRY_ON_API_URL, body, requestConfig);

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
        modelChoice
      );
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      if (error.response?.status === 403 &&
        error.response?.data?.code === "FREE_TRY_ON_LIMIT_REACHED") {
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

  async function saveCurrentLook() {
    if (!selectionId || !tryOnImage || isSavingLook || savedLookId) return;

    try {
      setIsSavingLook(true);
      setSaveLookMessage("");
      const { data } = await axios.post(
        SAVED_LOOKS_API_URL,
        { selectionId },
        requestConfig
      );
      setSavedLookId(data.savedLookId);
      setSaveLookMessage("This look was saved to your account.");
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setSaveLookMessage(
        error.response?.data?.message || "Could not save this look. Please try again."
      );
    } finally {
      setIsSavingLook(false);
    }
  }

  return (
    <main className="stylist-studio">
      <header className="outfit-main-header">
        <button type="button" className="outfit-main-logo" onClick={() => navigate("/")}>Re<span>Style</span></button>
        <nav aria-label="Main navigation">
          <button type="button" onClick={() => navigate("/")}>Home</button>
          <button type="button" onClick={() => navigate("/closet")}>My Closet</button>
          <button type="button" onClick={() => navigate("/marketplace")}>Marketplace</button>
          <button type="button" className="active" aria-current="page">Outfit Builder</button>
          <button type="button" onClick={() => navigate("/restyle-studio")}>ReStyle Studio</button>
        </nav>
        <button type="button" className="outfit-main-profile" onClick={() => navigate("/profile")} aria-label="Open profile">
          <ProfileAvatar token={token} user={user} />
          <span>{user?.firstName}</span>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </button>
      </header>
      <button
        type="button"
        className="studio-back"
        onClick={() => navigate("/closet")}
      >
        <i className="fa-solid fa-arrow-left" />
        My Closet
      </button>

      <button
        type="button"
        className="studio-saved-looks"
        onClick={() => navigate("/saved-looks")}
      >
        <i className="fa-solid fa-bookmark" />
        <span>My Saved Looks</span>
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
                    onClick={() => {
                      setEventType(name);
                      if (aiError === "Please describe your event.") setAiError("");
                    }}
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
                    onChange={(event) => {
                      setCustomEvent(event.target.value);
                      if (aiError === "Please describe your event.") setAiError("");
                    }}
                    placeholder="Tell your stylist about the event..."
                    aria-label="Describe your event"
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
                    <strong>Favorites only</strong>
                    Use only pieces I love
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
                      : "Upload a clear head-to-knees photo"}
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
                For the best result: face the camera with your head and both
                knees clearly visible. Your arms can rest naturally.
              </small>

              {modelMessage && <p className="model-message">{modelMessage}</p>}
            </div>

            {aiError && <p className="ai-error" role="alert">{aiError}</p>}

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

            {!tryOnImage && tryOnError && (
              <button
                type="button"
                className="try-on-button"
                onClick={() => createVirtualTryOn(selectionId, outfit)}
                disabled={isTryingOn || isQuotaLoading}
              >
                <i className="fa-solid fa-rotate-right" />
                Try virtual look again
              </button>
            )}

            {quota && (
              <div className="try-on-quota-result">
                <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                <div>
                  <strong>{quota.tryOnCredits} credits remaining</strong>
                  <span>{quota.freeTryOnsRemaining} of 3 free try-ons remaining</span>
                </div>
                {quota.freeTryOnsRemaining === 0 && quota.tryOnCredits === 0 && (
                  <button type="button" onClick={() => setIsPlansOpen(true)}>View plans</button>
                )}
              </div>
            )}

            <section className="look-explanation-card" aria-labelledby="look-explanation-title">
              <h3 id="look-explanation-title">Why this look works</h3>
              <p className="outfit-explanation">{outfit?.explanation}</p>
              {!!outfit?.stylingTips?.length && (
                <>
                  <h4>Styling tips</h4>
                  <ul className="styling-tips">
                    {outfit.stylingTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <div className="result-actions">
              {tryOnImage && (
                <button
                  type="button"
                  className="save-look-button"
                  onClick={saveCurrentLook}
                  disabled={isSavingLook || Boolean(savedLookId)}
                >
                  <i className={`fa-solid ${savedLookId ? "fa-check" : "fa-bookmark"}`} />
                  {isSavingLook
                    ? "Saving…"
                    : savedLookId
                      ? "Saved to my looks"
                      : "Save this look"}
                </button>
              )}
              <button
                type="button"
                className="edit-request-button"
                onClick={() => {
                  setIsPreview(false);
                  setOutfit(null);
                  setSelectionId("");
                  setTryOnImage("");
                  setTryOnItems([]);
                  setTryOnError("");
                  setSavedLookId("");
                  setSaveLookMessage("");
                  if (sessionKey) sessionStorage.removeItem(sessionKey);
                }}
              >
                Edit my request
              </button>
            </div>
            {saveLookMessage && (
              <p className={`save-look-message${savedLookId ? " success" : ""}`} role="status">
                {saveLookMessage}
              </p>
            )}
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
              onClick={() => { setIsPlansOpen(false); setCheckoutPlan(""); }}
            >
              ×
            </button>
            <h2 id="try-on-plan-title">Your free try-ons are complete</h2>
            <p id="try-on-plan-description">
              {checkoutPlan
                ? "Complete your purchase securely with PayPal Sandbox. No real money will be charged."
                : "Choose a try-on credit package to keep creating personal looks."}
            </p>
            {!checkoutPlan ? (
              <div className="try-on-plans">
                <article>
                  <h3>Mini Plan</h3>
                  <p>10 Try-ons for ₪9.90</p>
                  <button type="button" onClick={() => { setCheckoutPlan("mini"); setPurchaseMessage(""); }}>Choose Mini</button>
                </article>
                <article>
                  <h3>Style Plan</h3>
                  <p>30 Try-ons for ₪19.90</p>
                  <button type="button" onClick={() => { setCheckoutPlan("style"); setPurchaseMessage(""); }}>Choose Style</button>
                </article>
              </div>
            ) : (
              <div className="paypal-plan-checkout">
                <div className="paypal-order-summary">
                  <span>{checkoutPlan === "mini" ? "Mini · 10 try-ons" : "Style · 30 try-ons"}</span>
                  <strong>{checkoutPlan === "mini" ? "₪9.90" : "₪19.90"}</strong>
                </div>
                <PayPalCheckout
                  token={token}
                  plan={checkoutPlan}
                  product="tryon"
                  onSuccess={(data) => {
                    setQuota((current) => current ? { ...current, tryOnCredits: data.tryOnCredits, subscriptionPlan: data.subscriptionPlan } : current);
                    setPurchaseMessage(`Payment approved. ${data.creditsAdded} try-on credits were added.`);
                    setCheckoutPlan("");
                  }}
                />
                <button type="button" className="paypal-back-button" onClick={() => setCheckoutPlan("")}>Back to plans</button>
              </div>
            )}
            {purchaseMessage && <p className="plans-coming-soon" role="status">{purchaseMessage}</p>}
          </section>
        </div>
      )}

    </main>
  );
}
