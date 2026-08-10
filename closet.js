const user = JSON.parse(localStorage.getItem("user"));

const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");

const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalOverlay = document.getElementById("modalOverlay");

const itemForm = document.getElementById("itemForm");
const closetGrid = document.getElementById("closetGrid");
const filterButtons = document.querySelectorAll(".filter-btn");

let closetItems = [];
let currentFilter = "All";
let editingItemId = null;

// ================================
// USER
// ================================

if (user) {
    welcomeText.textContent = `Welcome back, ${user.firstName}`;
} else {
    window.location.href = "login.html";
}

// ================================
// MODAL
// ================================

openModalBtn.addEventListener("click", function () {
    editingItemId = null;
    itemForm.reset();
    modalOverlay.classList.add("show");
});

closeModalBtn.addEventListener("click", function () {
    editingItemId = null;
    itemForm.reset();
    modalOverlay.classList.remove("show");
});

modalOverlay.addEventListener("click", function (event) {
    if (event.target === modalOverlay) {
        editingItemId = null;
        itemForm.reset();
        modalOverlay.classList.remove("show");
    }
});

// ================================
// LOGOUT
// ================================

logoutBtn.addEventListener("click", function () {
    localStorage.removeItem("user");
    window.location.href = "Welcome Page.html";
});

// ================================
// LOAD ITEMS FROM MONGODB
// ================================

async function loadItems() {
    try {
        const response = await fetch(
            `http://localhost:3001/api/items?email=${encodeURIComponent(user.email)}`
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Could not load your closet.");
            return;
        }

        closetItems = data.items || [];

        renderItems();
        updateStats();

    } catch (error) {
        console.error("Error loading items:", error);
        alert("Could not connect to the server.");
    }
}

// ================================
// ADD OR EDIT ITEM
// ================================

itemForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const itemImage = document.getElementById("itemImage");
    const itemName = document.getElementById("itemName");
    const itemCategory = document.getElementById("itemCategory");
    const itemColor = document.getElementById("itemColor");
    const itemSeason = document.getElementById("itemSeason");
    const itemStyle = document.getElementById("itemStyle");

    if (
        itemName.value.trim() === "" ||
        itemColor.value.trim() === ""
    ) {
        alert("Please fill in item name and color.");
        return;
    }

    const formData = new FormData();

    formData.append("email", user.email);
    formData.append("name", itemName.value.trim());
    formData.append("category", itemCategory.value);
    formData.append("color", itemColor.value.trim());
    formData.append("season", itemSeason.value);
    formData.append("style", itemStyle.value);

    if (!editingItemId) {
        formData.append("favorite", "false");
    }

    if (itemImage.files.length > 0) {
        formData.append("image", itemImage.files[0]);
    }

    try {
        let response;

        if (editingItemId) {
            response = await fetch(
                `http://localhost:3001/api/items/${editingItemId}`,
                {
                    method: "PUT",
                    body: formData
                }
            );
        } else {
            response = await fetch(
                "http://localhost:3001/api/items",
                {
                    method: "POST",
                    body: formData
                }
            );
        }

        const data = await response.json();

        if (!response.ok) {
            alert(
                data.message ||
                (
                    editingItemId
                        ? "Could not update item."
                        : "Could not add item."
                )
            );

            return;
        }

        editingItemId = null;
        itemForm.reset();
        modalOverlay.classList.remove("show");

        await loadItems();

    } catch (error) {
        console.error("Error saving item:", error);
        alert("Could not connect to the server.");
    }
});

// ================================
// FILTERS
// ================================

filterButtons.forEach(button => {
    button.addEventListener("click", function () {

        filterButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        currentFilter = button.dataset.category;

        renderItems();
    });
});

// ================================
// RENDER ITEMS
// ================================

function renderItems() {
    closetGrid.innerHTML = "";

    const filteredItems =
        currentFilter === "All"
            ? closetItems
            : closetItems.filter(
                item => item.category === currentFilter
            );

    if (filteredItems.length === 0) {
        closetGrid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-shirt"></i>

                <h3>Your closet is empty</h3>

                <p>
                    Start by adding your first clothing item.
                </p>
            </div>
        `;

        updateStats();

        return;
    }

    filteredItems.forEach(item => {
        const card = document.createElement("div");

        card.className = "item-card";

        card.innerHTML = `
            ${
                item.image
                    ? `<img src="${item.image}" alt="${item.name}">`
                    : `<div class="no-image">No Image</div>`
            }

            <div class="item-info">

                <h3>${item.name}</h3>

                <p>
                    <strong>Category:</strong>
                    ${item.category}
                </p>

                <p>
                    <strong>Color:</strong>
                    ${item.color}
                </p>

                <p>
                    <strong>Season:</strong>
                    ${item.season}
                </p>

                <p>
                    <strong>Style:</strong>
                    ${item.style}
                </p>

                <div class="item-actions">

                    <button
                        class="favorite-btn"
                        onclick="toggleFavorite('${item._id}', ${item.favorite})"
                    >
                        ${
                            item.favorite
                                ? "♥ Favorite"
                                : "♡ Favorite"
                        }
                    </button>

                    <button
                        class="edit-btn"
                        onclick="editItem('${item._id}')"
                    >
                        Edit
                    </button>

                    <button
                        class="delete-btn"
                        onclick="deleteItem('${item._id}')"
                    >
                        Delete
                    </button>

                </div>

            </div>
        `;

        closetGrid.appendChild(card);
    });

    updateStats();
}

// ================================
// EDIT ITEM
// ================================

function editItem(id) {
    const item = closetItems.find(
        item => item._id === id
    );

    if (!item) {
        return;
    }

    editingItemId = id;

    document.getElementById("itemName").value =
        item.name || "";

    document.getElementById("itemCategory").value =
        item.category || "Tops";

    document.getElementById("itemColor").value =
        item.color || "";

    document.getElementById("itemSeason").value =
        item.season || "All Season";

    document.getElementById("itemStyle").value =
        item.style || "Casual";

    document.getElementById("itemImage").value = "";

    modalOverlay.classList.add("show");
}

// ================================
// FAVORITE ITEM
// ================================

async function toggleFavorite(id, currentFavorite) {
    try {
        const response = await fetch(
            `http://localhost:3001/api/items/${id}/favorite`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: user.email,
                    favorite: !currentFavorite
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Could not update favorite.");
            return;
        }

        await loadItems();

    } catch (error) {
        console.error("Error updating favorite:", error);
        alert("Could not connect to the server.");
    }
}

// ================================
// DELETE ITEM
// ================================

async function deleteItem(id) {
    const confirmDelete = confirm(
        "Are you sure you want to delete this item?"
    );

    if (!confirmDelete) {
        return;
    }

    try {
        const response = await fetch(
            `http://localhost:3001/api/items/${id}?email=${encodeURIComponent(user.email)}`,
            {
                method: "DELETE"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Could not delete item.");
            return;
        }

        await loadItems();

    } catch (error) {
        console.error("Error deleting item:", error);
        alert("Could not connect to the server.");
    }
}

// ================================
// UPDATE STATS
// ================================

function updateStats() {
    const totalItems = closetItems.length;

    const totalFavorites =
        closetItems.filter(item => item.favorite).length;

    const itemsCount =
        document.getElementById("itemsCount");

    const favoritesCount =
        document.getElementById("favoritesCount");

    const sideItemsCount =
        document.getElementById("sideItemsCount");

    const sideFavoritesCount =
        document.getElementById("sideFavoritesCount");

    if (itemsCount) {
        itemsCount.textContent = totalItems;
    }

    if (favoritesCount) {
        favoritesCount.textContent = totalFavorites;
    }

    if (sideItemsCount) {
        sideItemsCount.textContent = totalItems;
    }

    if (sideFavoritesCount) {
        sideFavoritesCount.textContent = totalFavorites;
    }
}

// ================================
// START
// ================================

loadItems();