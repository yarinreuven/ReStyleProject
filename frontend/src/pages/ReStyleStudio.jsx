import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import ProfileAvatar from "../components/ProfileAvatar";
import PayPalCheckout from "../components/PayPalCheckout";
import { useAuth } from "../context/AuthContext";
import usePageStyles from "../hooks/usePageStyles";
import {
  isAutomaticallyEligibleForRestyle,
  LESS_WORN_DAYS
} from "../utils/wardrobeInsights";

const studioSteps = [
  ["Choose a garment", "fa-shirt"],
  ["Tell us about it", "fa-sliders"],
  ["Explore ideas", "fa-wand-magic-sparkles"],
  ["Make it yours", "fa-scissors"]
];

const ITEMS_API_URL = "http://localhost:3001/api/items";
const RESTYLE_PROJECTS_API_URL = "http://localhost:3001/api/restyle-projects";
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxUploadSize = 5 * 1024 * 1024;
const garmentTypes = ["Tops", "Bottoms", "Dresses", "Skirts", "Jackets", "Shirts", "Sweaters"];
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
  ["crochet-hook", "Crochet hook", "fa-solid fa-wand-magic"],
  ["none", "No tools yet", "fa-regular fa-circle-xmark"]
];
const creationPreferences = [
  ["clothing", "A new garment", "fa-solid fa-shirt"],
  ["bag", "A bag", "fa-solid fa-bag-shopping"],
  ["accessory", "An accessory", "fa-solid fa-gem"],
  ["home", "Something for home", "fa-solid fa-house"],
  ["any", "Any practical idea", "fa-solid fa-wand-magic-sparkles"]
];

const compatibleClosetTypes = {
  Tops: new Set(["Tops", "Shirts", "Sweaters"]),
  Bottoms: new Set(["Bottoms", "Skirts"]),
  Dresses: new Set(["Dresses"]),
  Jackets: new Set(["Jackets"])
};

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
  const workspaceRef = useRef(null);
  const selectionRef = useRef(null);
  const detailsRef = useRef(null);
  const ideasRef = useRef(null);
  const guideRef = useRef(null);
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStudioStep, setActiveStudioStep] = useState(1);
  const [selectionMode, setSelectionMode] = useState("closet");
  const [closetItems, setClosetItems] = useState([]);
  const [closetStatus, setClosetStatus] = useState("loading");
  const [closetError, setClosetError] = useState("");
  const [savedProjects, setSavedProjects] = useState([]);
  const [projectsStatus, setProjectsStatus] = useState("loading");
  const [projectsError, setProjectsError] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectPendingDelete, setProjectPendingDelete] = useState(null);
  const [projectDeleting, setProjectDeleting] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [garmentDetails, setGarmentDetails] = useState(blankGarmentDetails);
  const [detailsErrors, setDetailsErrors] = useState({});
  const [detailsReady, setDetailsReady] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [ideas, setIdeas] = useState([]);
  const [responsibleFallback, setResponsibleFallback] = useState(null);
  const [ideasStatus, setIdeasStatus] = useState("idle");
  const [ideasMessage, setIdeasMessage] = useState("");
  const [guide, setGuide] = useState(null);
  const [guideStatus, setGuideStatus] = useState("idle");
  const [guideError, setGuideError] = useState("");
  const [completedStepIds, setCompletedStepIds] = useState([]);
  const [guideProgress, setGuideProgress] = useState(0);
  const [studioQuota, setStudioQuota] = useState(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState("");
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const { user, token, logout } = useAuth();

  useEffect(() => {
    if (!token) return;
    axios.get(`${RESTYLE_PROJECTS_API_URL}/quota`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(({ data }) => setStudioQuota(data)).catch(() => setStudioQuota(null));
  }, [token]);

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
    if (!token) return;
    let cancelled = false;

    async function loadSavedProjects() {
      try {
        setProjectsStatus("loading");
        setProjectsError("");
        const { data } = await axios.get(RESTYLE_PROJECTS_API_URL, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) {
          setSavedProjects(data.projects || []);
          setProjectsStatus("ready");
        }
      } catch (error) {
        if (cancelled) return;
        if (error.response?.status === 401) {
          logout();
          navigate("/login", { replace: true });
          return;
        }
        setProjectsError("Could not load your saved ReStyle projects.");
        setProjectsStatus("error");
      }
    }

    loadSavedProjects();
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

  useEffect(() => {
    if (!projectsOpen && !projectPendingDelete) return;
    function closeProjects(event) {
      if (event.key !== "Escape") return;
      if (projectPendingDelete && !projectDeleting) setProjectPendingDelete(null);
      else if (!projectPendingDelete) setProjectsOpen(false);
    }
    document.addEventListener("keydown", closeProjects);
    return () => document.removeEventListener("keydown", closeProjects);
  }, [projectDeleting, projectPendingDelete, projectsOpen]);

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
    setIdeas([]);
    setIdeasStatus("idle");
    setGuide(null);
    setGuideStatus("idle");
    setCompletedStepIds([]);
    setGuideProgress(0);
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
      setIdeas([]);
      setIdeasStatus("idle");
      setGuide(null);
      setGuideStatus("idle");
      setCompletedStepIds([]);
      setGuideProgress(0);
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
    setIdeas([]);
    setIdeasStatus("idle");
    setGuide(null);
    setGuideStatus("idle");
    setCompletedStepIds([]);
    setGuideProgress(0);
    setActiveStudioStep(1);
    setUploadError("");
  }

  function chooseAnotherGarment() {
    if (selectedGarment?.source === "upload") {
      fileInputRef.current?.click();
      return;
    }

    removeSelection();
    setSelectionMode("closet");
    window.setTimeout(() => selectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function scrollToSelection() {
    setActiveStudioStep(1);
    selectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function moveToStudioStep(step) {
    setActiveStudioStep(step);
    window.setTimeout(() => workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function updateDetail(event) {
    const { name, value } = event.target;
    setGarmentDetails((current) => ({ ...current, [name]: value }));
    setDetailsErrors((current) => ({ ...current, [name]: "" }));
    setDetailsReady(false);
    setIdeas([]);
    setIdeasStatus("idle");
    setGuide(null);
    setGuideStatus("idle");
  }

  function selectDetail(name, value) {
    setGarmentDetails((current) => ({ ...current, [name]: value }));
    setDetailsErrors((current) => ({ ...current, [name]: "" }));
    setDetailsReady(false);
    setIdeas([]);
    setIdeasStatus("idle");
    setGuide(null);
    setGuideStatus("idle");
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
    setIdeas([]);
    setIdeasStatus("idle");
    setGuide(null);
    setGuideStatus("idle");
  }

  async function validateGarmentDetails(event) {
    event.preventDefault();
    const requiredFields = ["garmentType", "fabric", "condition", "sewingSkill", "difficulty", "preference"];
    const nextErrors = {};
    requiredFields.forEach((field) => {
      if (!garmentDetails[field]) nextErrors[field] = "Please choose an option.";
    });
    if (garmentDetails.tools.length === 0) nextErrors.tools = "Choose your available tools, or select No tools yet.";

    if (
      selectedGarment.source === "closet" &&
      garmentDetails.garmentType &&
      !compatibleClosetTypes[selectedGarment.category]?.has(garmentDetails.garmentType)
    ) {
      nextErrors.garmentType = `This does not match the ${selectedGarment.category} category saved for this garment.`;
    }

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
      setSavedProjects((current) => [
        response.data.project,
        ...current.filter((project) => project.id !== response.data.project.id)
      ]);
      setDetailsReady(true);
      moveToStudioStep(3);
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

  async function generateIdeas() {
    if (!projectId || ideasStatus === "loading") return;
    try {
      setIdeasStatus("loading");
      setIdeasMessage("");
      setResponsibleFallback(null);
      ideasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const { data } = await axios.post(
        `${RESTYLE_PROJECTS_API_URL}/${projectId}/ideas`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIdeas(data.ideas || []);
      if (data.quota) setStudioQuota(data.quota);
      setResponsibleFallback(data.fallback || null);
      setIdeasMessage(data.message || "");
      setIdeasStatus((data.ideas || []).length > 0 ? "ready" : "empty");
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      if (error.response?.status === 403 && error.response?.data?.code === "RESTYLE_LIMIT_REACHED") {
        setIdeasStatus("idle");
        setPlansOpen(true);
        return;
      }
      setIdeasMessage(error.response?.data?.message || "Could not find ReStyle ideas. Please try again.");
      setIdeasStatus("error");
    }
  }

  function formatTool(tool) {
    return availableTools.find(([value]) => value === tool)?.[1] || tool;
  }

  async function openGuide(ideaId) {
    try {
      setGuideStatus("loading");
      setGuideError("");
      const { data } = await axios.post(
        `${RESTYLE_PROJECTS_API_URL}/${projectId}/ideas/${ideaId}/select`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGuide(data.guide);
      setCompletedStepIds(data.completedStepIds || []);
      setGuideProgress(data.progress || 0);
      setGuideStatus("ready");
      setSavedProjects((current) => current.map((project) => project.id === projectId
        ? { ...project, selectedIdeaId: ideaId, status: "in_progress" }
        : project));
      moveToStudioStep(4);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setGuideError(error.response?.data?.message || "Could not open this guide.");
      setGuideStatus("error");
    }
  }

  function normalizeSavedIdeas(project) {
    return (project.generatedIdeas || []).map((idea) => ({ ...idea, id: idea.id || idea.ideaId }));
  }

  async function continueSavedProject(savedProject) {
    try {
      setProjectsError("");
      const { data } = await axios.get(`${RESTYLE_PROJECTS_API_URL}/${savedProject.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const project = data.project;
      setSelectedGarment({
        source: project.sourceType,
        id: project.sourceItemId || "",
        name: project.sourceName,
        category: project.sourceCategory || project.details?.garmentType || "",
        image: project.sourceImage
      });
      setGarmentDetails(project.details || blankGarmentDetails);
      setProjectId(project.id);
      setDetailsReady(true);
      setDetailsErrors({});
      setProjectError("");
      setCompletedStepIds(project.completedStepIds || []);
      setGuideProgress(project.progress || 0);
      setIdeas(normalizeSavedIdeas(project));
      setIdeasStatus((project.generatedIdeas || []).length > 0 ? "ready" : "idle");
      setIdeasMessage((project.generatedIdeas || []).length > 0
        ? `${project.generatedIdeas.length} saved paths for this garment`
        : "");
      setResponsibleFallback(null);
      setGuide(null);
      setGuideStatus("idle");

      const ideasResponse = await axios.post(
        `${RESTYLE_PROJECTS_API_URL}/${project.id}/ideas`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const refreshedIdeas = ideasResponse.data.ideas || [];
      setIdeas(refreshedIdeas);
      setIdeasStatus(refreshedIdeas.length > 0 ? "ready" : "empty");
      setIdeasMessage(ideasResponse.data.message || "");
      setResponsibleFallback(ideasResponse.data.fallback || null);

      if (project.selectedIdeaId) {
        const guideResponse = await axios.post(
          `${RESTYLE_PROJECTS_API_URL}/${project.id}/ideas/${project.selectedIdeaId}/select`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setGuide(guideResponse.data.guide);
        setCompletedStepIds(guideResponse.data.completedStepIds || []);
        setGuideProgress(guideResponse.data.progress || 0);
        setGuideStatus("ready");
        setProjectsOpen(false);
        moveToStudioStep(4);
      } else {
        setProjectsOpen(false);
        moveToStudioStep(3);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setProjectsError(error.response?.data?.message || "Could not continue this ReStyle project.");
    }
  }

  async function deleteSavedProject(savedProject) {
    try {
      setProjectDeleting(true);
      setProjectsError("");
      await axios.delete(`${RESTYLE_PROJECTS_API_URL}/${savedProject.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSavedProjects((current) => current.filter((project) => project.id !== savedProject.id));
      if (projectId === savedProject.id) removeSelection();
      setProjectPendingDelete(null);
    } catch (error) {
      setProjectsError(error.response?.data?.message || "Could not delete this ReStyle project.");
      setProjectPendingDelete(null);
    } finally {
      setProjectDeleting(false);
    }
  }

  async function toggleGuideStep(stepId) {
    if (!guide || guideStatus === "saving") return;
    setGuideError("");
    const nextCompleted = completedStepIds.includes(stepId)
      ? completedStepIds.filter((id) => id !== stepId)
      : [...completedStepIds, stepId];
    const progress = Math.round((nextCompleted.length / guide.steps.length) * 100);
    const previousCompleted = completedStepIds;
    const previousProgress = guideProgress;
    setCompletedStepIds(nextCompleted);
    setGuideProgress(progress);
    setGuideStatus("saving");
    try {
      await axios.patch(
        `${RESTYLE_PROJECTS_API_URL}/${projectId}`,
        {
          completedStepIds: nextCompleted,
          progress,
          status: progress === 100 ? "completed" : "in_progress"
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedProjects((current) => current.map((project) => project.id === projectId
        ? { ...project, completedStepIds: nextCompleted, progress, status: progress === 100 ? "completed" : "in_progress" }
        : project));
      setGuideStatus("ready");
    } catch (error) {
      setCompletedStepIds(previousCompleted);
      setGuideProgress(previousProgress);
      setGuideStatus("ready");
      setGuideError(error.response?.data?.message || "Could not save your progress.");
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

      <section className="restyle-journey" ref={workspaceRef} aria-label="ReStyle Studio progress">
        <div className="restyle-journey-intro">
          <span>YOUR CREATIVE WORKSPACE</span>
          <h1>From forgotten to reimagined.</h1>
          <p>Choose a piece and let the studio guide you naturally from inspiration to creation.</p>
        </div>
        <ol className="restyle-journey-steps">
          {studioSteps.map(([title, icon], index) => {
            const step = index + 1;
            const unlocked = step === 1 ||
              (step === 2 && Boolean(selectedGarment)) ||
              (step === 3 && Boolean(projectId && detailsReady)) ||
              (step === 4 && Boolean(guide));
            const complete = activeStudioStep > step ||
              (step === 1 && Boolean(selectedGarment)) ||
              (step === 2 && Boolean(projectId && detailsReady)) ||
              (step === 3 && ideasStatus === "ready");
            return (
              <li key={title} className={`${activeStudioStep === step ? "active" : ""}${complete ? " complete" : ""}`}>
                <button type="button" disabled={!unlocked} onClick={() => moveToStudioStep(step)} aria-current={activeStudioStep === step ? "step" : undefined}>
                  <span><i className={`fa-solid ${complete ? "fa-check" : icon}`} /></span>
                  <strong>{title}</strong>
                </button>
              </li>
            );
          })}
        </ol>
        {selectedGarment ? (
          <div className="restyle-journey-piece">
            <img src={selectedGarment.image} alt="" />
            <div><small>CURRENT PIECE</small><strong>{selectedGarment.name || "Uploaded garment"}</strong><span>{selectedGarment.category || garmentDetails.garmentType || "Details not added yet"}</span></div>
            <button type="button" onClick={() => moveToStudioStep(1)}>Change</button>
          </div>
        ) : (
          <button type="button" className="restyle-projects-trigger" onClick={() => setProjectsOpen(true)} disabled={projectsStatus === "loading" && savedProjects.length === 0}>
            <span><i className="fa-regular fa-folder-open" /></span>
            <div><strong>My Projects</strong><small>{projectsStatus === "loading" ? "Loading..." : `${savedProjects.length} saved`}</small></div>
            <i className="fa-solid fa-chevron-right" />
          </button>
        )}
      </section>

      {projectsOpen && (
        <div className="restyle-projects-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProjectsOpen(false); }}>
          <section className="restyle-projects-dialog" role="dialog" aria-modal="true" aria-labelledby="savedRestyleProjectsTitle">
            <button type="button" className="restyle-projects-close" aria-label="Close saved projects" onClick={() => setProjectsOpen(false)}><i className="fa-solid fa-xmark" /></button>
            <div className="restyle-saved-projects-heading">
              <div><span>MY RESTYLE PROJECTS</span><h2 id="savedRestyleProjectsTitle">Continue where you left off</h2></div>
              <p>Your selected guide and every completed step are saved automatically.</p>
            </div>
            {projectsStatus === "loading" && <div className="restyle-saved-loading" role="status"><span className="restyle-selection-loader" /> Loading saved projects...</div>}
            {projectsError && <div className="restyle-project-error" role="alert">{projectsError}</div>}
            {projectsStatus === "ready" && savedProjects.length === 0 && <div className="restyle-projects-empty"><i className="fa-regular fa-folder-open" /><strong>No saved projects yet</strong><p>Your projects will appear here after you confirm garment details.</p></div>}
            {savedProjects.length > 0 && (
              <div className="restyle-saved-project-grid">
                {savedProjects.map((project) => (
                  <article key={project.id}>
                    <div className="restyle-saved-project-image">{project.sourceImage ? <img src={project.sourceImage} alt="" /> : <i className="fa-solid fa-shirt" />}<span>{project.progress || 0}%</span></div>
                    <div className="restyle-saved-project-content">
                      <small>{project.status === "completed" ? "COMPLETED" : project.selectedIdeaId ? "GUIDE IN PROGRESS" : "SAVED PROJECT"}</small>
                      <h3>{project.name}</h3>
                      <p>{project.details?.fabric} {project.details?.garmentType} · {project.generatedIdeas?.length || 0} ideas</p>
                      <div className="restyle-saved-project-progress"><span style={{ width: `${project.progress || 0}%` }} /></div>
                      <div><button type="button" onClick={() => continueSavedProject(project)}><i className="fa-solid fa-arrow-right" /> Continue</button><button type="button" className="delete" aria-label={`Delete ${project.name}`} onClick={() => setProjectPendingDelete(project)}><i className="fa-regular fa-trash-can" /></button></div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {projectPendingDelete && (
        <div className="restyle-delete-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !projectDeleting) setProjectPendingDelete(null); }}>
          <section className="restyle-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="restyleDeleteTitle" aria-describedby="restyleDeleteDescription">
            <span className="restyle-delete-icon"><i className="fa-regular fa-trash-can" /></span>
            <small>DELETE PROJECT</small>
            <h2 id="restyleDeleteTitle">Delete this ReStyle project?</h2>
            <p id="restyleDeleteDescription">“{projectPendingDelete.name}” and its saved guide progress will be permanently removed.</p>
            <div>
              <button type="button" className="cancel" disabled={projectDeleting} onClick={() => setProjectPendingDelete(null)}>Keep project</button>
              <button type="button" className="confirm" disabled={projectDeleting} onClick={() => deleteSavedProject(projectPendingDelete)}>
                {projectDeleting ? <><span className="restyle-delete-spinner" /> Deleting...</> : <><i className="fa-regular fa-trash-can" /> Delete project</>}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="restyle-studio-hero" hidden={activeStudioStep !== 1}>
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

      <section className="restyle-garment-section" ref={selectionRef} aria-labelledby="garmentSelectionTitle" hidden={activeStudioStep !== 1}>
        <div className="restyle-garment-heading">
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
                <p><i className="fa-solid fa-shield-heart" /> Clothing only. Shoes, bags and other accessories are not supported.</p>
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
                    <button type="button" onClick={chooseAnotherGarment}>
                      <i className="fa-solid fa-arrows-rotate" /> Choose another garment
                    </button>
                  </div>
                  <button type="button" className="restyle-preview-continue" onClick={() => moveToStudioStep(2)}>
                    Continue with this piece <i className="fa-solid fa-arrow-right" />
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
        <section className="restyle-details-section" ref={detailsRef} aria-labelledby="garmentDetailsTitle" hidden={activeStudioStep !== 2}>
          <div className="restyle-details-heading">
            <button type="button" className="restyle-stage-back" onClick={() => moveToStudioStep(1)}><i className="fa-solid fa-arrow-left" /> Back to garment</button>
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
                {selectedGarment.source === "upload" && <small>Choose the type of the garment visible in the uploaded photo.</small>}
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

      {projectId && detailsReady && (
        <section className="restyle-ideas-section" ref={ideasRef} aria-labelledby="restyleIdeasTitle" hidden={activeStudioStep !== 3}>
          <div className="restyle-ideas-heading">
            <button type="button" className="restyle-stage-back" onClick={() => moveToStudioStep(2)}><i className="fa-solid fa-arrow-left" /> Back to details</button>
            <h2 id="restyleIdeasTitle">Practical ideas for this piece</h2>
            <p>Every result comes from a reviewed transformation catalog and must match your garment details and available tools.</p>
            {studioQuota && (
              <small className="restyle-quota-status">
                {studioQuota.restyleFreeRemaining} of 3 free generations remaining
                {studioQuota.credits > 0 ? ` · ${studioQuota.credits} ReStyle Studio credits` : ""}
              </small>
            )}
            {ideasStatus === "idle" && (
              <button type="button" onClick={generateIdeas}><i className="fa-solid fa-wand-magic-sparkles" /> Find suitable ideas</button>
            )}
          </div>

          {ideasStatus === "loading" && (
            <div className="restyle-ideas-state" role="status">
              <span className="restyle-selection-loader" />
              <strong>Matching safe transformations...</strong>
              <p>Checking the garment, fabric, condition, skills and tools.</p>
            </div>
          )}

          {ideasStatus === "error" && (
            <div className="restyle-ideas-state error" role="alert">
              <i className="fa-solid fa-circle-exclamation" />
              <strong>We could not find ideas</strong>
              <p>{ideasMessage}</p>
              <button type="button" onClick={generateIdeas}>Try Again</button>
            </div>
          )}

          {ideasStatus === "empty" && (
            <div className="restyle-ideas-state empty">
              <i className="fa-solid fa-shield-heart" />
              <strong>A safer path for this piece</strong>
              <p>{ideasMessage}</p>
              {responsibleFallback && (
                <div className="restyle-fallback-card featured">
                  <div><span>RESPONSIBLE NEXT PATH</span><h3>{responsibleFallback.title}</h3><p>{responsibleFallback.description}</p><small>{responsibleFallback.reason}</small></div>
                  <ol>{responsibleFallback.actions.map((action) => <li key={action.title}><strong>{action.title}</strong><span>{action.description}</span></li>)}</ol>
                </div>
              )}
              <button type="button" onClick={() => moveToStudioStep(1)}>Choose a different garment</button>
            </div>
          )}

          {ideasStatus === "ready" && (
            <>
              <div className="restyle-ideas-summary"><i className="fa-solid fa-circle-check" /> {ideasMessage}</div>
              <div className="restyle-idea-grid">
                {ideas.map((idea) => (
                  <article key={idea.id} className="restyle-idea-card">
                    <div className="restyle-idea-visual" aria-hidden="true">
                      <i className={`fa-solid fa-${idea.icon}`} />
                      <span>{idea.outputType}</span>
                    </div>
                    <div className="restyle-idea-content">
                      <div className="restyle-idea-meta">
                        <span className="restyle-match-score"><i className="fa-solid fa-bullseye" /> {idea.matchScore}% · {idea.matchLabel}</span>
                        <span><i className="fa-regular fa-clock" /> {idea.timeMinutes} min</span>
                        <span><i className="fa-solid fa-signal" /> {idea.difficulty}</span>
                        <span><i className="fa-solid fa-needle" /> {idea.sewingRequired ? "Sewing" : "No sewing"}</span>
                      </div>
                      <h3>{idea.title}</h3>
                      <p>{idea.description}</p>
                      <div className="restyle-idea-fit"><i className="fa-solid fa-check" /><span>{idea.whyItFits}</span></div>
                      <div className="restyle-idea-requirements">
                        <div><strong>Tools</strong><span>{idea.requiredTools.map(formatTool).join(", ")}</span></div>
                        <div><strong>Materials</strong><span>{idea.materials.join(", ")}</span></div>
                      </div>
                      <button type="button" onClick={() => openGuide(idea.id)}><i className="fa-regular fa-map" /> Open step-by-step guide</button>
                    </div>
                  </article>
                ))}
              </div>
              {responsibleFallback && (
                <aside className="restyle-fallback-card">
                  <div><span>IF THESE DO NOT FEEL RIGHT</span><h3>{responsibleFallback.title}</h3><p>{responsibleFallback.description}</p><small>{responsibleFallback.reason}</small></div>
                  <ol>{responsibleFallback.actions.map((action) => <li key={action.title}><strong>{action.title}</strong><span>{action.description}</span></li>)}</ol>
                </aside>
              )}
            </>
          )}
        </section>
      )}

      {guideStatus === "loading" && (
        <section className="restyle-guide-section" ref={guideRef} hidden={activeStudioStep !== 4}>
          <div className="restyle-ideas-state" role="status"><span className="restyle-selection-loader" /><strong>Opening your guide...</strong></div>
        </section>
      )}

      {guideStatus === "error" && (
        <section className="restyle-guide-section" ref={guideRef} hidden={activeStudioStep !== 4}>
          <div className="restyle-ideas-state error" role="alert"><i className="fa-solid fa-circle-exclamation" /><strong>{guideError}</strong></div>
        </section>
      )}

      {guide && ["ready", "saving"].includes(guideStatus) && (
        <section className="restyle-guide-section" ref={guideRef} aria-labelledby="restyleGuideTitle" hidden={activeStudioStep !== 4}>
          <div className="restyle-guide-heading">
            <button type="button" className="restyle-stage-back" onClick={() => moveToStudioStep(3)}><i className="fa-solid fa-arrow-left" /> Back to ideas</button>
            <h2 id="restyleGuideTitle">{guide.idea.title}</h2>
            <p>{guide.idea.description}</p>
          </div>

          <div className="restyle-guide-progress" aria-label={`${guideProgress}% complete`}>
            <div><strong>Project progress</strong><span>{guideProgress}%</span></div>
            <div className="restyle-progress-track"><span style={{ width: `${guideProgress}%` }} /></div>
            {guideStatus === "saving" && <small>Saving progress...</small>}
          </div>
          {guideError && <div className="restyle-project-error" role="alert">{guideError}</div>}

          <div className="restyle-guide-layout">
            <div className="restyle-guide-steps">
              <h3>Step-by-step instructions</h3>
              {guide.steps.map((step, index) => {
                const complete = completedStepIds.includes(step.id);
                return (
                  <button key={step.id} type="button" className={complete ? "complete" : ""} onClick={() => toggleGuideStep(step.id)} aria-pressed={complete}>
                    <span>{complete ? <i className="fa-solid fa-check" /> : index + 1}</span>
                    <div><strong>{step.title}</strong><p>{step.instruction}</p></div>
                  </button>
                );
              })}
            </div>

            <aside className="restyle-guide-sidebar">
              <section><h3><i className="fa-solid fa-toolbox" /> Tools</h3><ul>{guide.idea.requiredTools.map((tool) => <li key={tool}>{formatTool(tool)}</li>)}</ul></section>
              <section><h3><i className="fa-solid fa-layer-group" /> Materials</h3><ul>{guide.idea.materials.map((material) => <li key={material}>{material}</li>)}</ul></section>
              <section className="tips"><h3><i className="fa-regular fa-lightbulb" /> Helpful tips</h3><ul>{guide.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></section>
              <section className="warnings"><h3><i className="fa-solid fa-triangle-exclamation" /> Safety notes</h3><ul>{guide.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>
              <section className="video-status">
                <h3><i className="fa-solid fa-circle-play" /> Video tutorial</h3>
                {guide.verifiedVideo ? (
                  <a href={guide.verifiedVideo.url} target="_blank" rel="noreferrer">{guide.verifiedVideo.title} · {guide.verifiedVideo.source}</a>
                ) : (
                  <>
                    <p>Open current YouTube results for this exact technique. The link is a search, not an AI-guessed video.</p>
                    <a
                      href={guide.videoSearch?.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${guide.idea.title} upcycling tutorial`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="fa-brands fa-youtube" /> {guide.videoSearch?.title || "Find a video tutorial"}
                    </a>
                  </>
                )}
              </section>
            </aside>
          </div>
        </section>
      )}

      {plansOpen && (
        <div className="restyle-plan-overlay" role="presentation">
          <section className="restyle-plan-dialog" role="dialog" aria-modal="true" aria-labelledby="restyle-plan-title">
            <button type="button" className="restyle-plan-close" aria-label="Close plans" onClick={() => { setPlansOpen(false); setCheckoutPlan(""); }}>×</button>
            <h2 id="restyle-plan-title">Your free Studio generations are complete</h2>
            <p>{checkoutPlan ? "Complete your purchase with PayPal Sandbox. No real money will be charged." : "Choose a ReStyle Studio credit package. These credits are only for Studio generations."}</p>
            {!checkoutPlan ? (
              <div className="restyle-plan-grid">
                <article><h3>Mini</h3><p>5 Studio credits · ₪15</p><button type="button" onClick={() => setCheckoutPlan("mini")}>Choose Mini</button></article>
                <article><h3>Style</h3><p>10 Studio credits · ₪30</p><button type="button" onClick={() => setCheckoutPlan("style")}>Choose Style</button></article>
              </div>
            ) : (
              <div className="restyle-paypal-checkout">
                <PayPalCheckout token={token} plan={checkoutPlan} product="restyle" onSuccess={(data) => {
                  setStudioQuota((current) => current ? { ...current, credits: data.restyleCredits, subscriptionPlan: data.subscriptionPlan } : current);
                  setPurchaseMessage(`Payment approved. ${data.creditsAdded} ReStyle Studio credits were added.`);
                  setCheckoutPlan("");
                }} />
                <button type="button" onClick={() => setCheckoutPlan("")}>Back to plans</button>
              </div>
            )}
            {purchaseMessage && <p className="restyle-purchase-message" role="status">{purchaseMessage}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
