import { useState } from "react";
import heroImg from "../assets/hero.png";

function MyCloset() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = [
    "All",
    "Tops",
    "Bottoms",
    "Dresses",
    "Shoes",
    "Bags",
    "Accessories"
  ];

  return (
    <div className="app">

      <header className="topbar">
        <div className="logo">
          Re<span>Style</span>
        </div>

        <nav>
          <a href="#">Home</a>
          <a href="#" className="active">My Closet</a>
          <a href="#">Marketplace</a>
          <a href="#">Outfit Builder</a>
          <a href="#">ReStyle Studio</a>
        </nav>

        <button className="logout-btn">
          Logout
        </button>
      </header>

      <main className="layout">

        <section
          className="hero"
          style={{
            backgroundImage: `
              linear-gradient(
                90deg,
                rgba(255,255,255,.98),
                rgba(255,255,255,.82),
                rgba(255,255,255,.16)
              ),
              url(${heroImg})
            `
          }}
        >
          <div>
            <p className="welcome-text">
              Welcome back
            </p>

            <h1>
              My <span>Closet</span>
            </h1>

            <p>
              Every great outfit starts with a great wardrobe ♡
            </p>

            <div className="hero-buttons">
              <button className="add-btn">
                + Add Item
              </button>

              <button className="build-btn">
                ✨ Build Outfit
              </button>
            </div>
          </div>
        </section>

        <section className="category-row">
          {categories.map((category) => (
            <button
              key={category}
              className={
                selectedCategory === category
                  ? "filter-btn active"
                  : "filter-btn"
              }
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </section>

        <section className="collection-section">

          <div className="collection-header">
            <div>
              <h2>Your Collection</h2>

              <p>
                Showing: {selectedCategory}
              </p>
            </div>

            <div className="stats">

              <div>
                <strong>0</strong>
                <span>Items</span>
              </div>

              <div>
                <strong>0</strong>
                <span>Favorites</span>
              </div>

              <div>
                <strong>6</strong>
                <span>Categories</span>
              </div>

            </div>
          </div>

          <div className="empty-state">
            <h3>Your closet is waiting...</h3>

            <p>
              Add your first item and start building your style.
            </p>
          </div>

        </section>

      </main>

    </div>
  );
}

export default MyCloset;