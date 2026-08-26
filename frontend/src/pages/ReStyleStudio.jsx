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
const RESTYLE_PROJECTS_API_URL = "http://localhost:3001/api/restyle-projects";
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxUploadSize = 5 * 1024 * 1024;
const garmentTypes = ["Tops", "Bottoms", "Dresses", "Skirts", "Jackets", "Shirts", "Sweaters", "Other"];
const fabricTypes = ["Denim", "Cotton", "Knit", "Satin", "Linen", "Wool", "Polyester", "Leather", "Unknown"];
const garmentConditions = [
  ["good", "Good condition"],
  ["stained", "Stained"],
  ["torn", "Torn or damaged"],
  ["too-small", "Too small"],
  ["too-large", "Too large"],
  ["worn", "Worn out"]
];
const availableTools = [
  ["scissors", "Fabric scissors", "fa-solid fa-scissors"],
  ["needle-thread", "Needle & thread", "fa-solid fa-needle"],
  ["sewing-machine", "Sewing machine", "fa-solid fa-gears"],
  ["fabric-glue", "Fabric glue", "fa-solid fa-droplet"],
  ["measuring-tape", "Measuring tape", "fa-solid fa-ruler"],
  ["iron", "Iron", "fa-solid fa-temperature-high"],
  ["paint-dye", "Fabric paint or dye", "fa-solid fa-palette"],
  ["none", "No tools yet", "fa-regular fa-circle-xmark"]
];
const creationPreferences = [
  ["clothing", "A new garment", "fa-solid fa-shirt"],
  ["bag", "A bag", "fa-solid fa-bag-shopping"],
  ["accessory", "An accessory", "fa-solid fa-gem"],
  ["home", "Something for home", "fa-solid fa-house"],
  ["any", "Any practical idea", "fa-solid fa-wand-magic-sparkles"]
];

const blankGarmentDetails = {
  garmentType: "",
  fabric: "",
  condition: "",
  sewingSkill: "",
  tools: [],
  difficulty: "",
  preference: ""
};

export default function ReStyleStudio() {
  usePageStyles("restyle-studio.css");

  const navigate = useNavigate();
  const menuRef = useRef(null);
  const selectionRef = useRef(null);
  const detailsRef = useRef(null);
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState("closet");
  const [closetItems, setClosetItems] = useState([]);
  const [closetStatus, setClosetStatus] = useState("loading");
  const [closetError, setClosetError] = useState("");
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [garmentDetails, setGarmentDetails] = useState(blankGarmentDetails);
  const [detailsErrors, setDetailsErrors] = useState({});
  const [detailsReady, setDetailsReady] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectError, setProjectError] = useState("");
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
    setGarmentDetails({ ...blankGarmentDetails, garmentType: item.category || "" });
    setDetailsErrors({});
    setDetailsReady(false);
    setProjectId("");
    setProjectError("");
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
      setGarmentDetails(blankGarmentDetails);
      setDetailsErrors({});
      setDetailsReady(false);
      setProjectId("");
      setProjectError("");
      setUploadError("");
    };
    reader.onerror = () => setUploadError("Could not read this image. Please try another one.");
    reader.readAsDataURL(file);
  }

  function removeSelection() {
    setSelectedGarment(null);
    setGarmentDetails(blankGarmentDetails);
    setDetailsErrors({});
    setDetailsReady(false);
    setProjectId("");
    setProjectError("");
    setUploadError("");
  }

  function scrollToSelection() {
    selectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateDetail(event) {
    const { name, value } = event.target;
    setGarmentDetails((current) => ({ ...current, [name]: value }));
    setDetailsErrors((current) => ({ ...current, [name]: "" }));
    setDetailsReady(false);
  }

  function selectDetail(name, value) {
    setGarmentDetails((current) => ({ ...current, [name]: value }));
    setDetailsErrors((current) => ({ ...current, [name]: "" }));
    setDetailsReady(false);
  }

  function toggleTool(tool) {
    setGarmentDetails((current) => {
      if (tool === "none") {
        return { ...current, tools: current.tools.includes("none") ? [] : ["none"] };
      }
      const withoutNone = current.tools.filter((entry) => entry !== "none");
      return {
        ...current,
        tools: withoutNone.includes(tool)
          ? withoutNone.filter((entry) => entry !== tool)
          : [...withoutNone, tool]
      };
    });
    setDetailsErrors((current) => ({ ...current, tools: "" }));
    setDetailsReady(false);
  }

  async function validateGarmentDetails(event) {
    event.preventDefault();
    const requiredFields = ["garmentType", "fabric", "condition", "sewingSkill", "difficulty", "preference"];
    const nextErrors = {};
    requiredFields.forEach((field) => {
      if (!garmentDetails[field]) nextErrors[field] = "Please choose an option.";
    });
    if (garmentDetails.tools.length === 0) nextErrors.tools = "Choose your available tools, or select No tools yet.";

    setDetailsErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setDetailsReady(false);
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    try {
      setIsSavingProject(true);
      setProjectError("");
      let response;
      if (projectId) {
        response = await axios.patch(
          `${RESTYLE_PROJECTS_API_URL}/${projectId}`,
          { details: garmentDetails },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        const body = new FormData();
        body.append("name", `${selectedGarment.name || "Garment"} ReStyle Project`);
        body.append("sourceType", selectedGarment.source);
        body.append("sourceName", selectedGarment.name || "Uploaded garment");
        body.append("details", JSON.stringify(garmentDetails));
        if (selectedGarment.source === "closet") body.append("sourceItemId", selectedGarment.id);
        if (selectedGarment.source === "upload") body.append("sourceImage", selectedGarment.file);
        response = await axios.post(RESTYLE_PROJECTS_API_URL, body, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setProjectId(response.data.project.id);
      setDetailsReady(true);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setDetailsReady(false);
      setProjectError(error.response?.data?.message || "Could not save this ReStyle project.");
    } finally {
      setIsSavingProject(false);
    }
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
                  <button type="button" className="restyle-preview-continue" onClick={() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    Continue with this piece <i className="fa-solid fa-arrow-down" />
                  </button>
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

      {selectedGarment && (
        <section className="restyle-details-section" ref={detailsRef} aria-labelledby="garmentDetailsTitle">
          <div className="restyle-details-heading">
            <span>STEP 02</span>
            <h2 id="garmentDetailsTitle">Tell us what you are working with</h2>
            <p>These details keep future suggestions realistic, safe and matched to your abilities.</p>
          </div>

          <form className="restyle-details-form" onSubmit={validateGarmentDetails} noValidate>
            <div className="restyle-details-grid">
              <label className={detailsErrors.garmentType ? "has-error" : ""}>
                <span>Garment type</span>
                <select name="garmentType" value={garmentDetails.garmentType} onChange={updateDetail}>
                  <option value="">Choose a type</option>
                  {garmentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                {selectedGarment.source === "closet" && <small>Filled from My Closet. You can correct it if needed.</small>}
                {detailsErrors.garmentType && <em>{detailsErrors.garmentType}</em>}
              </label>

              <label className={detailsErrors.fabric ? "has-error" : ""}>
                <span>Fabric</span>
                <select name="fabric" value={garmentDetails.fabric} onChange={updateDetail}>
                  <option value="">Choose a fabric</option>
                  {fabricTypes.map((fabric) => <option key={fabric} value={fabric}>{fabric}</option>)}
                </select>
                <small>Choose Unknown if you are not sure.</small>
                {detailsErrors.fabric && <em>{detailsErrors.fabric}</em>}
              </label>
            </div>

            <fieldset className={detailsErrors.condition ? "has-error" : ""}>
              <legend>What is the garment&apos;s current condition?</legend>
              <div className="restyle-choice-grid condition-grid">
                {garmentConditions.map(([value, label]) => (
                  <button key={value} type="button" className={garmentDetails.condition === value ? "selected" : ""} onClick={() => selectDetail("condition", value)} aria-pressed={garmentDetails.condition === value}>
                    {label}
                  </button>
                ))}
              </div>
              {detailsErrors.condition && <em>{detailsErrors.condition}</em>}
            </fieldset>

            <div className="restyle-details-two-column">
              <fieldset className={detailsErrors.sewingSkill ? "has-error" : ""}>
                <legend>Can you sew?</legend>
                <div className="restyle-choice-grid compact">
                  {["No sewing", "Basic hand sewing", "Confident", "Advanced"].map((skill) => (
                    <button key={skill} type="button" className={garmentDetails.sewingSkill === skill ? "selected" : ""} onClick={() => selectDetail("sewingSkill", skill)} aria-pressed={garmentDetails.sewingSkill === skill}>{skill}</button>
                  ))}
                </div>
                {detailsErrors.sewingSkill && <em>{detailsErrors.sewingSkill}</em>}
              </fieldset>

              <fieldset className={detailsErrors.difficulty ? "has-error" : ""}>
                <legend>Preferred difficulty</legend>
                <div className="restyle-choice-grid compact">
                  {["Easy", "Medium", "Challenging"].map((difficulty) => (
                    <button key={difficulty} type="button" className={garmentDetails.difficulty === difficulty ? "selected" : ""} onClick={() => selectDetail("difficulty", difficulty)} aria-pressed={garmentDetails.difficulty === difficulty}>{difficulty}</button>
                  ))}
                </div>
                {detailsErrors.difficulty && <em>{detailsErrors.difficulty}</em>}
              </fieldset>
            </div>

            <fieldset className={detailsErrors.tools ? "has-error" : ""}>
              <legend>Which tools do you have available?</legend>
              <div className="restyle-tool-grid">
                {availableTools.map(([value, label, icon]) => (
                  <button key={value} type="button" className={garmentDetails.tools.includes(value) ? "selected" : ""} onClick={() => toggleTool(value)} aria-pressed={garmentDetails.tools.includes(value)}>
                    <i className={icon} aria-hidden="true" /><span>{label}</span>
                  </button>
                ))}
              </div>
              {detailsErrors.tools && <em>{detailsErrors.tools}</em>}
            </fieldset>

            <fieldset className={detailsErrors.preference ? "has-error" : ""}>
              <legend>What would you most like to create?</legend>
              <div className="restyle-preference-grid">
                {creationPreferences.map(([value, label, icon]) => (
                  <button key={value} type="button" className={garmentDetails.preference === value ? "selected" : ""} onClick={() => selectDetail("preference", value)} aria-pressed={garmentDetails.preference === value}>
                    <i className={icon} aria-hidden="true" /><span>{label}</span>
                  </button>
                ))}
              </div>
              {detailsErrors.preference && <em>{detailsErrors.preference}</em>}
            </fieldset>

            <div className="restyle-details-submit">
              <div>
                <strong>Ready for thoughtful ideas</strong>
                <span>We will use only transformations that match these details.</span>
              </div>
              <button type="submit" disabled={isSavingProject}><i className="fa-solid fa-wand-magic-sparkles" /> {isSavingProject ? "Saving project..." : "Confirm garment details"}</button>
            </div>

            {projectError && <div className="restyle-project-error" role="alert"><i className="fa-solid fa-circle-exclamation" /> {projectError}</div>}

            {detailsReady && (
              <div className="restyle-details-success" role="status">
                <i className="fa-solid fa-circle-check" />
                <div><strong>Garment details are ready</strong><span>The next stage will use them to find suitable transformation ideas.</span></div>
              </div>
            )}
          </form>
        </section>
      )}

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
