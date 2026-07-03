const user = JSON.parse(localStorage.getItem("user"));

const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");

const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalOverlay = document.getElementById("modalOverlay");

const itemForm = document.getElementById("itemForm");
const closetGrid = document.getElementById("closetGrid");
const filterButtons = document.querySelectorAll(".filter-btn");

let closetItems = JSON.parse(localStorage.getItem("closetItems")) || [];
let currentFilter = "All";

if (user) {
    welcomeText.textContent = `Welcome back, ${user.firstName}`;
} else {
    window.location.href = "login.html";
}

openModalBtn.addEventListener("click", function(){
    modalOverlay.classList.add("show");
});

closeModalBtn.addEventListener("click", function(){
    modalOverlay.classList.remove("show");
});

modalOverlay.addEventListener("click", function(event){
    if(event.target === modalOverlay){
        modalOverlay.classList.remove("show");
    }
});

logoutBtn.addEventListener("click", function(){
    localStorage.removeItem("user");
    window.location.href = "Welcome Page.html";
});

itemForm.addEventListener("submit", function(event){
    event.preventDefault();

    const itemImage = document.getElementById("itemImage");
    const itemName = document.getElementById("itemName");
    const itemCategory = document.getElementById("itemCategory");
    const itemColor = document.getElementById("itemColor");
    const itemSeason = document.getElementById("itemSeason");
    const itemStyle = document.getElementById("itemStyle");

    if(itemName.value.trim() === "" || itemColor.value.trim() === ""){
        alert("Please fill in item name and color.");
        return;
    }

    const file = itemImage.files[0];

    if(file){
        const reader = new FileReader();

        reader.onload = function(){
            saveItem(reader.result);
        };

        reader.readAsDataURL(file);
    } else {
        saveItem("");
    }

    function saveItem(imageData){
        const newItem = {
            id: Date.now(),
            name: itemName.value.trim(),
            category: itemCategory.value,
            color: itemColor.value.trim(),
            season: itemSeason.value,
            style: itemStyle.value,
            image: imageData,
            favorite: false
        };

        closetItems.push(newItem);
        localStorage.setItem("closetItems", JSON.stringify(closetItems));

        itemForm.reset();
        modalOverlay.classList.remove("show");
        renderItems();
    }
});

filterButtons.forEach(button => {
    button.addEventListener("click", function(){
        filterButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");

        currentFilter = button.dataset.category;
        renderItems();
    });
});

function renderItems(){
    closetGrid.innerHTML = "";

    const filteredItems = currentFilter === "All"
        ? closetItems
        : closetItems.filter(item => item.category === currentFilter);

    if(filteredItems.length === 0){
        closetGrid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-shirt"></i>
                <h3>Your closet is empty</h3>
                <p>Start by adding your first clothing item.</p>
            </div>
        `;
        return;
    }

    filteredItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "item-card";

        card.innerHTML = `
            ${item.image ? `<img src="${item.image}" alt="${item.name}">` : `<div class="no-image">No Image</div>`}

            <div class="item-info">
                <h3>${item.name}</h3>
                <p><strong>Category:</strong> ${item.category}</p>
                <p><strong>Color:</strong> ${item.color}</p>
                <p><strong>Season:</strong> ${item.season}</p>
                <p><strong>Style:</strong> ${item.style}</p>

                <div class="item-actions">
                    <button class="favorite-btn" onclick="toggleFavorite(${item.id})">
                        ${item.favorite ? "♥ Favorite" : "♡ Favorite"}
                    </button>

                    <button class="delete-btn" onclick="deleteItem(${item.id})">
                        Delete
                    </button>
                </div>
            </div>
        `;

        closetGrid.appendChild(card);
    });
}

function deleteItem(id){
    closetItems = closetItems.filter(item => item.id !== id);
    localStorage.setItem("closetItems", JSON.stringify(closetItems));
    renderItems();
}

function toggleFavorite(id){
    closetItems = closetItems.map(item => {
        if(item.id === id){
            return {
                ...item,
                favorite: !item.favorite
            };
        }

        return item;
    });

    localStorage.setItem("closetItems", JSON.stringify(closetItems));
    renderItems();
    document.getElementById("itemsCount").textContent = closetItems.length;
document.getElementById("favoritesCount").textContent =
    closetItems.filter(item => item.favorite).length;
}
renderItems();