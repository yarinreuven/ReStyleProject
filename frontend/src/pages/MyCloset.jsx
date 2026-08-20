import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";

const API_URL = "http://localhost:3001/api/items";

const categories = [
  "All",
  "Tops",
  "Bottoms",
  "Dresses",
  "Jackets",
  "Shoes",
  "Bags",
  "Accessories"
];

const categoryLabels = {
  Jackets: "Jackets & Coats"
};

function CategoryIcon({ category }) {
  const paths = {
    All: (
      <>
        <path d="M24 5c.7 7.4 4.6 11.3 12 12-7.4.7-11.3 4.6-12 12-.7-7.4-4.6-11.3-12-12 7.4-.7 11.3-4.6 12-12Z" />
        <path d="M39 27c.3 3.7 2.3 5.7 6 6-3.7.3-5.7 2.3-6 6-.3-3.7-2.3-5.7-6-6 3.7-.3 5.7-2.3 6-6Z" />
      </>
    ),
    Tops: (
      <path d="M18 12 8 18l5 10 6-3v18h22V25l6 3 5-10-10-6-6 7H24l-6-7Z" />
    ),
    Bottoms: (
      <path d="M17 8h30l-3 36-12-1-2-22-2 22-12 1 1-36Zm1 9h25M30 8v13" />
    ),
    Dresses: (
      <path d="M24 8h12l3 10-5 4 11 23H15l11-23-5-4 3-10Zm0 0c1 5 11 5 12 0M26 22h8" />
    ),
    Jackets: (
      <path d="M21 9 11 16l5 12 5-3v20h18V25l5 3 5-12-10-7-5 7h-8l-5-7Zm5 7 4 29m4-29-4 29M26 25h-5m13 0h5" />
    ),
    Shoes: (
      <path d="M10 36c9 0 13-6 16-16l8 2c1 8 7 11 15 13 3 1 4 8-1 9H13c-6 0-8-8-3-8Zm14-9 10 3M18 35h25" />
    ),
    Bags: (
      <>
        <path d="M11 21h38l-3 25H14l-3-25Z" />
        <path d="M21 22v-5c0-11 18-11 18 0v5M20 30h.1M40 30h.1" />
      </>
    ),
    Accessories: (
      <path d="m30 8 17 13-17 27L13 21 30 8Zm-17 13h34M22 9l-4 12 12 27 12-27-4-12M18 21h24" />
    )
  };

  return (
    <svg
      className="category-icon"
      viewBox="0 0 60 56"
      aria-hidden="true"
    >
      {paths[category]}
    </svg>
  );
}

const seasons = [
  "All Season",
  "Summer",
  "Winter",
  "Spring",
  "Fall"
];

const styles = [
  "Casual",
  "Classic",
  "Elegant",
  "Sporty",
  "Streetwear"
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const LESS_WORN_DAYS = 60;
const RECENT_DAYS = 30;

function daysSince(date) {
  if (!date) {
    return Infinity;
  }

  return Math.floor(
    (Date.now() - new Date(date).getTime()) / DAY_IN_MS
  );
}

function isLessWorn(item) {
  const referenceDate = item.lastWornAt || item.createdAt;
  return daysSince(referenceDate) >= LESS_WORN_DAYS;
}

function isRecentlyAdded(item) {
  return daysSince(item.createdAt) <= RECENT_DAYS;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hasWearDate(item, dateKey) {
  return (item.wornDates || []).some(
    (date) => new Date(date).toISOString().slice(0, 10) === dateKey
  );
}

const blankItem = {
  name: "",
  category: "Tops",
  color: "",
  season: "All Season",
  style: "Casual",
  image: null
};

export default function MyCloset() {
  usePageStyles("closet.css");

  const navigate = useNavigate();

  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });

  const [token] = useState(() =>
    localStorage.getItem("token")
  );

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("All");
  const [insightFilter, setInsightFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankItem);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [wearItem, setWearItem] = useState(null);
  const [wearDate, setWearDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isSavingWear, setIsSavingWear] = useState(false);
  const accountMenuRef = useRef(null);

  const requestConfig = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`
      }
    }),
    [token]
  );

  useEffect(() => {
    if (!user || !token) {
      navigate("/login", { replace: true });
      return;
    }

    async function getItems() {
      try {
        setIsLoading(true);
        setPageError("");

        const { data } = await axios.get(
          API_URL,
          requestConfig
        );

        setItems(data.items || []);
      } catch (error) {
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }

        setPageError(
          error.response?.data?.message ||
            "Could not load your wardrobe."
        );
      } finally {
        setIsLoading(false);
      }
    }

    getItems();
  }, [navigate, requestConfig, token, user]);

  useEffect(() => {
    function closeAccountMenu(event) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeAccountMenu);

    return () => {
      document.removeEventListener("mousedown", closeAccountMenu);
    };
  }, []);

  async function loadItems() {
    try {
      setPageError("");

      const { data } = await axios.get(
        API_URL,
        requestConfig
      );

      setItems(data.items || []);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }

      setPageError(
        error.response?.data?.message ||
          "Could not load your wardrobe."
      );
    }
  }

  const visibleItems = useMemo(() => {
    let result = filter === "All"
      ? items
      : items.filter((item) => item.category === filter);

    if (insightFilter === "favorites") {
      result = result.filter((item) => item.favorite);
    }

    if (insightFilter === "lessWorn") {
      result = result.filter(isLessWorn);
    }

    if (insightFilter === "recent") {
      result = result.filter(isRecentlyAdded);
    }

    return result;
  }, [items, filter, insightFilter]);

  const favorites = items.filter(
    (item) => item.favorite
  ).length;

  const lessWorn = items.filter(isLessWorn).length;
  const recentlyAdded = items.filter(isRecentlyAdded).length;

  function openNewItem() {
    setEditingId(null);
    setForm(blankItem);
    setModalOpen(true);
  }

  function closeModal() {
    setEditingId(null);
    setForm(blankItem);
    setModalOpen(false);
  }

  function change(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  }

  function chooseImage(event) {
    setForm((currentForm) => ({
      ...currentForm,
      image: event.target.files?.[0] || null
    }));
  }

  async function saveItem(event) {
    event.preventDefault();

    if (!form.name.trim() || !form.color.trim()) {
      window.alert(
        "Please fill in item name and color."
      );
      return;
    }

    if (!editingId && !(form.image instanceof File)) {
      window.alert(
        "Please upload an image to add the item."
      );
      return;
    }

    const body = new FormData();

    body.append("name", form.name.trim());
    body.append("category", form.category);
    body.append("color", form.color.trim());
    body.append("season", form.season);
    body.append("style", form.style);

    if (!editingId) {
      body.append("favorite", "false");
    }

    if (form.image instanceof File) {
      body.append("image", form.image);
    }

    try {
      setIsSaving(true);

      if (editingId) {
        await axios.put(
          `${API_URL}/${editingId}`,
          body,
          requestConfig
        );
      } else {
        await axios.post(
          API_URL,
          body,
          requestConfig
        );
      }

      closeModal();
      await loadItems();
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }

      window.alert(
        error.response?.data?.message ||
          "Could not save item."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function editItem(item) {
    setEditingId(item._id);

    setForm({
      name: item.name || "",
      category: item.category || "Tops",
      color: item.color || "",
      season: item.season || "All Season",
      style: item.style || "Casual",
      image: null
    });

    setModalOpen(true);
  }

  async function toggleFavorite(item) {
    try {
      await axios.put(
        `${API_URL}/${item._id}/favorite`,
        {
          favorite: !item.favorite
        },
        requestConfig
      );

      await loadItems();
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }

      window.alert(
        error.response?.data?.message ||
          "Could not update favorite."
      );
    }
  }

  function updateItemFromResponse(updatedItem) {
    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem._id === updatedItem._id
          ? {
              ...currentItem,
              ...updatedItem,
              image: currentItem.image
            }
          : currentItem
      )
    );
  }

  async function addWearDate() {
    try {
      setIsSavingWear(true);
      const { data } = await axios.put(
        `${API_URL}/${wearItem._id}/worn`,
        { date: wearDate },
        requestConfig
      );

      updateItemFromResponse(data.item);
      setWearItem((current) => ({ ...current, ...data.item }));
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }

      window.alert(
        error.response?.data?.message ||
          "Could not update wear history."
      );
    } finally {
      setIsSavingWear(false);
    }
  }

  async function toggleWornToday(item) {
    const date = todayKey();

    try {
      setIsSavingWear(true);

      const { data } = hasWearDate(item, date)
        ? await axios.delete(`${API_URL}/${item._id}/worn`, {
            ...requestConfig,
            data: { date }
          })
        : await axios.put(
            `${API_URL}/${item._id}/worn`,
            { date },
            requestConfig
          );

      updateItemFromResponse(data.item);
    } catch (error) {
      window.alert(
        error.response?.data?.message ||
          "Could not update today's wear status."
      );
    } finally {
      setIsSavingWear(false);
    }
  }

  async function removeWearDate(date) {
    try {
      setIsSavingWear(true);
      const { data } = await axios.delete(
        `${API_URL}/${wearItem._id}/worn`,
        {
          ...requestConfig,
          data: { date }
        }
      );

      updateItemFromResponse(data.item);
      setWearItem((current) => ({ ...current, ...data.item }));
    } catch (error) {
      window.alert(
        error.response?.data?.message ||
          "Could not remove this wear date."
      );
    } finally {
      setIsSavingWear(false);
    }
  }

  async function deleteItem(item) {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this item?"
    );

    if (!shouldDelete) {
      return;
    }

    try {
      await axios.delete(
        `${API_URL}/${item._id}`,
        requestConfig
      );

      await loadItems();
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }

      window.alert(
        error.response?.data?.message ||
          "Could not delete item."
      );
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  if (!user || !token) {
    return null;
  }

  return (
    <>
      <header className="topbar">
        <div className="logo">
          Re<span>Style</span>
        </div>

        <nav>
          <button
            type="button"
            onClick={() => navigate("/")}
          >
            Home
          </button>

          <button
            type="button"
            className="active"
          >
            My Closet
          </button>

          <button type="button">
            Marketplace
          </button>

          <button
            type="button"
            onClick={() => navigate("/outfit-builder")}
          >
            Outfit Builder
          </button>

          <button type="button">
            ReStyle Studio
          </button>
        </nav>

        <div className="account-actions" ref={accountMenuRef}>
          <button
            type="button"
            className="profile-btn"
            onClick={() => setAccountMenuOpen((open) => !open)}
            aria-label="Open account menu"
            aria-expanded={accountMenuOpen}
          >
            <ProfileAvatar token={token} user={user} />
            <span>{user.firstName}</span>
            <i className="fa-solid fa-chevron-down account-chevron" />
          </button>

          {accountMenuOpen && (
            <div className="account-menu">
              <div className="account-menu-header">
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <span>{user.email}</span>
              </div>

              <button
                type="button"
                onClick={() => navigate("/profile")}
              >
                <i className="fa-regular fa-user" />
                My Profile
              </button>

              <div className="account-menu-divider" />

              <button
                type="button"
                className="menu-logout-btn"
                onClick={logout}
              >
                <i className="fa-solid fa-arrow-right-from-bracket" />
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="layout">
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              Your personal wardrobe
            </span>

            <p className="welcome-text">
              Welcome back, {user.firstName}
            </p>

            <h1>
              My <span>Closet</span>
            </h1>

            <p>
              Every great outfit starts with a great
              wardrobe ♡
            </p>

            <div className="hero-buttons">
              <button
                type="button"
                className="add-btn"
                onClick={openNewItem}
              >
                <i className="fa-solid fa-plus" />
                Add Item
              </button>

              <button
                type="button"
                className="build-btn"
                onClick={() => navigate("/outfit-builder")}
              >
                <i className="fa-solid fa-wand-magic-sparkles" />
                Build Outfit
              </button>
            </div>
          </div>

        </section>

        <section className="category-section">
          <div className="category-row">
            {categories.map((name) => (
              <button
                type="button"
                key={name}
                className={`filter-btn${filter === name ? " active" : ""}`}
                onClick={() => setFilter(name)}
              >
                <span className="category-art">
                  <CategoryIcon category={name} />
                </span>
                <span>{categoryLabels[name] || name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="main-content">
          <div className="collection">
            <div className="collection-header">
              <h2>My Wardrobe</h2>
              <div className="wardrobe-insights">
                {[
                  ["all", items.length, "All"],
                  ["favorites", favorites, "Favorites"],
                  ["lessWorn", lessWorn, "Less Worn"],
                  ["recent", recentlyAdded, "New"]
                ].map(([value, count, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={
                      `insight-card${
                        insightFilter === value ? " active" : ""
                      }`
                    }
                    onClick={() => setInsightFilter(value)}
                  >
                    {label} <span>{count}</span>
                  </button>
                ))}
              </div>
            </div>

            {pageError && (
              <p className="error-message">
                {pageError}
              </p>
            )}

            <section className="closet-grid">
              {isLoading ? (
                <div className="empty-state">
                  <i className="fa-solid fa-spinner fa-spin" />
                  <h3>Loading your wardrobe...</h3>
                </div>
              ) : visibleItems.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-shirt" />

                  <h3>
                    {items.length === 0
                      ? "Your wardrobe is waiting..."
                      : "No pieces match this view"}
                  </h3>

                  <p>
                    {items.length === 0
                      ? "Add your first item and start building your style."
                      : "Try another category or wardrobe insight."}
                  </p>

                  {items.length === 0 ? (
                    <button type="button" onClick={openNewItem}>
                      Add First Item
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("All");
                        setInsightFilter("all");
                      }}
                    >
                      Show All Items
                    </button>
                  )}
                </div>
              ) : (
                visibleItems.map((item) => (
                  <article
                    className="item-card"
                    key={item._id}
                  >
                    <div className="item-media">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                        />
                      ) : (
                        <div className="no-image">
                          <i className="fa-solid fa-shirt" />
                          <span>No Image</span>
                        </div>
                      )}

                      {isLessWorn(item) && (
                        <span className="less-worn-badge">
                          Not worn recently
                        </span>
                      )}

                      <button
                        type="button"
                        className={
                          `card-heart${
                            item.favorite ? " selected" : ""
                          }`
                        }
                        onClick={() => toggleFavorite(item)}
                        aria-label={
                          item.favorite
                            ? "Remove from favorites"
                            : "Add to favorites"
                        }
                      >
                        <i
                          className={
                            item.favorite
                              ? "fa-solid fa-heart"
                              : "fa-regular fa-heart"
                          }
                        />
                      </button>
                    </div>

                    <div className="item-info">
                      <div className="item-title-row">
                        <div>
                          <span className="item-caption">
                            MY WARDROBE
                          </span>
                          <h3>{item.name}</h3>
                        </div>

                        <span className="item-color">
                          {item.color}
                        </span>
                      </div>

                      <div className="wear-controls">
                        <div className="wear-summary">
                          <span>Wear diary</span>
                          <strong>{item.wearCount || 0}</strong>
                          <small>times worn</small>
                        </div>

                        <div className="wear-buttons">
                          <button
                            type="button"
                            className={
                              `worn-today-btn${
                                hasWearDate(item, todayKey())
                                  ? " marked"
                                  : ""
                              }`
                            }
                            disabled={isSavingWear}
                            onClick={() => toggleWornToday(item)}
                          >
                            <i
                              className={
                                hasWearDate(item, todayKey())
                                  ? "fa-solid fa-check"
                                  : "fa-regular fa-calendar-check"
                              }
                            />
                            {hasWearDate(item, todayKey())
                              ? "Worn today"
                              : "Wear today"}
                          </button>

                          <button
                            type="button"
                            className="past-date-btn"
                            onClick={() => {
                              setWearItem(item);
                              setWearDate(todayKey());
                            }}
                          >
                            <i className="fa-solid fa-plus" />
                            Add past date
                          </button>
                        </div>
                      </div>

                      {isLessWorn(item) && (
                        <div className="restyle-suggestion">
                          <strong>Give this piece a new story</strong>
                          <span>Try in a look · Sell or rent · Restyle</span>
                        </div>
                      )}

                      <div className="item-actions">
                        <button
                          type="button"
                          className="edit-btn"
                          onClick={() =>
                            editItem(item)
                          }
                        >
                          <i className="fa-regular fa-pen-to-square" />
                          Edit item
                        </button>

                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            deleteItem(item)
                          }
                        >
                          <i className="fa-regular fa-trash-can" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>

        </section>
      </main>

      {wearItem && (
        <div className="wear-modal-overlay">
          <section className="wear-modal">
            <button
              type="button"
              className="close-btn"
              onClick={() => setWearItem(null)}
            >
              <i className="fa-solid fa-xmark" />
            </button>

            <span className="wear-modal-kicker">WEAR DIARY</span>
            <h2>{wearItem.name}</h2>
            <p>Add the date you wore this piece.</p>

            <div className="wear-date-form">
              <input
                type="date"
                value={wearDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setWearDate(event.target.value)}
              />
              <button
                type="button"
                disabled={isSavingWear || !wearDate}
                onClick={addWearDate}
              >
                Add date
              </button>
            </div>

            <div className="wear-history-list">
              {(wearItem.wornDates || []).length === 0 ? (
                <p className="no-wear-history">
                  No wear dates recorded yet.
                </p>
              ) : (
                [...wearItem.wornDates]
                  .sort((first, second) =>
                    new Date(second) - new Date(first)
                  )
                  .map((date) => {
                    const dateKey = new Date(date)
                      .toISOString()
                      .slice(0, 10);

                    return (
                      <div className="wear-history-row" key={dateKey}>
                        <span>
                          <i className="fa-regular fa-calendar-check" />
                          {new Date(date).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          disabled={isSavingWear}
                          onClick={() => removeWearDate(dateKey)}
                          aria-label={`Remove wear date ${dateKey}`}
                        >
                          <i className="fa-regular fa-trash-can" />
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
          </section>
        </div>
      )}

      <div
        className={
          `modal-overlay${modalOpen ? " show" : ""}`
        }
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeModal();
          }
        }}
      >
        <div className="modal">
          <button
            type="button"
            className="close-btn"
            onClick={closeModal}
          >
            <i className="fa-solid fa-xmark" />
          </button>

          <h2>
            {editingId ? "Edit Item" : "Add New Item"}{" "}
            <span>♡</span>
          </h2>

          <p className="modal-subtitle">
            Upload your item and add the details.
          </p>

          <form onSubmit={saveItem}>
            <label className="upload-area">
              <input
                type="file"
                accept="image/*"
                onChange={chooseImage}
              />

              <i className="fa-solid fa-cloud-arrow-up" />
              <strong>
                {editingId ? "Change Image" : "Upload Image"}
              </strong>
              <small>
                {editingId
                  ? "Optional — your current image will stay"
                  : "Required — PNG or JPG up to 10MB"}
              </small>
            </label>

            <label htmlFor="itemName">
              Item Name
            </label>

            <input
              id="itemName"
              name="name"
              type="text"
              placeholder="Example: White Shirt"
              value={form.name}
              onChange={change}
            />

            <label htmlFor="itemCategory">
              Category
            </label>

            <select
              id="itemCategory"
              name="category"
              value={form.category}
              onChange={change}
            >
              {categories.slice(1).map((name) => (
                <option key={name} value={name}>
                  {categoryLabels[name] || name}
                </option>
              ))}
            </select>

            <label htmlFor="itemColor">
              Color
            </label>

            <input
              id="itemColor"
              name="color"
              type="text"
              placeholder="Example: White"
              value={form.color}
              onChange={change}
            />

            <div className="form-row">
              <div>
                <label htmlFor="itemSeason">
                  Season
                </label>

                <select
                  id="itemSeason"
                  name="season"
                  value={form.season}
                  onChange={change}
                >
                  {seasons.map((season) => (
                    <option
                      key={season}
                      value={season}
                    >
                      {season}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="itemStyle">
                  Style
                </label>

                <select
                  id="itemStyle"
                  name="style"
                  value={form.style}
                  onChange={change}
                >
                  {styles.map((style) => (
                    <option
                      key={style}
                      value={style}
                    >
                      {style}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="save-btn"
              disabled={isSaving}
            >
              <i className="fa-solid fa-bag-shopping" />
              {isSaving
                ? "Saving..."
                : editingId
                  ? "Update Item"
                  : "Save Item"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
