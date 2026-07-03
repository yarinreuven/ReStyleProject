const user = JSON.parse(localStorage.getItem("user"));
const userArea = document.getElementById("userArea");
const getStartedBtn = document.getElementById("getStartedBtn");

if (user && userArea) {
    userArea.innerHTML = `
        <div class="user-menu">
            <button class="user-btn" id="userBtn">
                <span class="user-avatar">${user.firstName.charAt(0).toUpperCase()}</span>
                <span>Hi ${user.firstName}</span>
                <i class="fa-solid fa-chevron-down"></i>
            </button>

            <div class="dropdown" id="dropdownMenu">
                <a href="profile.html">
                    <i class="fa-regular fa-user"></i>
                    My Profile
                </a>

                <a href="#">
                    <i class="fa-solid fa-gear"></i>
                    Account Settings
                </a>

                <a href="#">
                    <i class="fa-regular fa-heart"></i>
                    My Favorites
                </a>

                <button id="logoutBtn">
                    <i class="fa-solid fa-right-from-bracket"></i>
                    Logout
                </button>
            </div>
        </div>
    `;

    if (getStartedBtn) {
        getStartedBtn.textContent = "Go to My Closet";
        getStartedBtn.href = "closet.html";
    }

    const userBtn = document.getElementById("userBtn");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const logoutBtn = document.getElementById("logoutBtn");

    userBtn.addEventListener("click", function () {
        dropdownMenu.classList.toggle("show");
    });

    logoutBtn.addEventListener("click", function () {
        localStorage.removeItem("user");
        window.location.href = "Welcome Page.html";
    });
}