const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", function(event){
    event.preventDefault();

    const email = document.getElementById("email");
    const password = document.getElementById("password");

    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");

    emailError.textContent = "";
    passwordError.textContent = "";

    email.classList.remove("input-error");
    password.classList.remove("input-error");

    let isValid = true;

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(email.value.trim() === ""){
        emailError.textContent = "Please enter your email.";
        email.classList.add("input-error");
        isValid = false;
    }
    else if(!emailPattern.test(email.value.trim())){
        emailError.textContent = "Please enter a valid email address.";
        email.classList.add("input-error");
        isValid = false;
    }

    if(password.value.trim() === ""){
        passwordError.textContent = "Please enter your password.";
        password.classList.add("input-error");
        isValid = false;
    }

    if(isValid){
        fetch("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email.value.trim(),
                password: password.value
            })
        })
        .then(response => response.json())
        .then(data => {
            if(data.success){
                localStorage.setItem("user", JSON.stringify(data.user));
                window.location.href = "Welcome Page.html";} 
                else {
                passwordError.textContent = "Incorrect email or password.";
                email.classList.add("input-error");
                password.classList.add("input-error");
            }
        })
        .catch(error => {
            passwordError.textContent = "Server error. Please try again.";
            console.log(error);
        });
    }
});