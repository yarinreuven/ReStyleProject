import {
  useEffect,
  useMemo,
  useState
} from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import usePageStyles from "../hooks/usePageStyles";

const API_URL = "http://localhost:3001/api/items";

const categories = [
  ["All", "fa-solid fa-border-all"],
  ["Tops", "fa-solid fa-shirt"],
  ["Bottoms", "fa-solid fa-person"],
  ["Dresses", "fa-solid fa-person-dress"],
  ["Shoes", "fa-solid fa-shoe-prints"],
  ["Bags", "fa-solid fa-bag-shopping"],
  ["Accessories", "fa-regular fa-gem"]
];

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankItem);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState("");

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
    if (filter === "All") {
      return items;
    }

    return items.filter(
      (item) => item.category === filter
    );
  }, [items, filter]);

  const favorites = items.filter(
    (item) => item.favorite
  ).length;

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

          <button type="button">
            Outfit Builder
          </button>

          <button type="button">
            ReStyle Studio
          </button>
        </nav>

        <button
          type="button"
          className="logout-btn"
          onClick={logout}
        >
          Logout
        </button>
      </header>

      <main className="layout">
        <section className="hero">
          <div>
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
              >
                <i className="fa-solid fa-wand-magic-sparkles" />
                Build Outfit
              </button>
            </div>
          </div>
        </section>

        <section className="category-row">
          {categories.map(([name, icon]) => (
            <button
              type="button"
              key={name}
              className={
                `filter-btn${
                  filter === name ? " active" : ""
                }`
              }
              onClick={() => setFilter(name)}
            >
              <i className={icon} />
              <span>{name}</span>
            </button>
          ))}
        </section>

        <section className="main-content">
          <div className="collection">
            <div className="collection-header">
              <h2>Your Collection</h2>

              <div className="stats">
                <div>
                  <strong>{items.length}</strong>
                  <span>Items</span>
                </div>

                <div>
                  <strong>{favorites}</strong>
                  <span>Favorites</span>
                </div>

                <div>
                  <strong>6</strong>
                  <span>Categories</span>
                </div>
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
                    Your wardrobe is waiting...
                  </h3>

                  <p>
                    Add your first item and start
                    building your style.
                  </p>

                  <button
                    type="button"
                    onClick={openNewItem}
                  >
                    Add First Item
                  </button>
                </div>
              ) : (
                visibleItems.map((item) => (
                  <article
                    className="item-card"
                    key={item._id}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                      />
                    ) : (
                      <div className="no-image">
                        No Image
                      </div>
                    )}

                    <div className="item-info">
                      <h3>{item.name}</h3>
                      <p>
                        Category: {item.category}
                      </p>
                      <p>Color: {item.color}</p>
                      <p>Season: {item.season}</p>
                      <p>Style: {item.style}</p>

                      <div className="item-actions">
                        <button
                          type="button"
                          className="favorite-btn"
                          onClick={() =>
                            toggleFavorite(item)
                          }
                        >
                          {item.favorite
                            ? "♥ Favorite"
                            : "♡ Favorite"}
                        </button>

                        <button
                          type="button"
                          className="edit-btn"
                          onClick={() =>
                            editItem(item)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            deleteItem(item)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>

          <aside className="side-panel">
            <div className="side-card">
              <h3>Your Stats</h3>

              <div className="side-stat">
                <i className="fa-solid fa-shirt" />
                <div>
                  <strong>{items.length}</strong>
                  <span>Total Items</span>
                </div>
              </div>

              <div className="side-stat">
                <i className="fa-regular fa-heart" />
                <div>
                  <strong>{favorites}</strong>
                  <span>Favorites</span>
                </div>
              </div>

              <div className="side-stat">
                <i className="fa-solid fa-layer-group" />
                <div>
                  <strong>6</strong>
                  <span>Categories</span>
                </div>
              </div>
            </div>

            <div className="style-card">
              <h3>Style Tip ✨</h3>
              <p>
                Mix soft colors with one statement
                piece for a clean, classy look.
              </p>
            </div>
          </aside>
        </section>
      </main>

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
              <strong>Upload Image</strong>
              <small>PNG, JPG up to 10MB</small>
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
              {categories.slice(1).map(([name]) => (
                <option key={name} value={name}>
                  {name}
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
                : "Save Item"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}