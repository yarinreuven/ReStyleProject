const registerForm = document.getElementById("registerForm");

registerForm.addEventListener("submit", async function(event){
    event.preventDefault();

    const firstName = document.getElementById("firstName");
    const lastName = document.getElementById("lastName");
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");
    const language = document.getElementById("language");

    const firstNameError = document.getElementById("firstNameError");
    const lastNameError = document.getElementById("lastNameError");
    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");
    const confirmPasswordError = document.getElementById("confirmPasswordError");

    const inputs = [firstName, lastName, email, password, confirmPassword];
    const errors = [firstNameError, lastNameError, emailError, passwordError, confirmPasswordError];

    inputs.forEach(input => input.classList.remove("input-error"));

    errors.forEach(error => {
        error.textContent = "";
        error.classList.remove("success-message");
    });

    let isValid = true;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(firstName.value.trim() === ""){
        firstNameError.textContent = "First name is required";
        firstName.classList.add("input-error");
        isValid = false;
    }

    if(lastName.value.trim() === ""){
        lastNameError.textContent = "Last name is required";
        lastName.classList.add("input-error");
        isValid = false;
    }

    if(email.value.trim() === ""){
        emailError.textContent = "Email is required";
        email.classList.add("input-error");
        isValid = false;
    }
    else if(!emailPattern.test(email.value.trim())){
        emailError.textContent = "Please enter a valid email address";
        email.classList.add("input-error");
        isValid = false;
    }

    if(password.value.trim() === ""){
        passwordError.textContent = "Password is required";
        password.classList.add("input-error");
        isValid = false;
    }
    else if(password.value.length < 6){
        passwordError.textContent = "Password must be at least 6 characters";
        password.classList.add("input-error");
        isValid = false;
    }

    if(confirmPassword.value.trim() === ""){
        confirmPasswordError.textContent = "Confirm password is required";
        confirmPassword.classList.add("input-error");
        isValid = false;
    }
    else if(confirmPassword.value !== password.value){
        confirmPasswordError.textContent = "Passwords do not match";
        confirmPassword.classList.add("input-error");
        isValid = false;
    }

    if(!isValid) return;

    try {
        const response = await fetch("http://localhost:3001/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                firstName: firstName.value.trim(),
                lastName: lastName.value.trim(),
                email: email.value.trim(),
                password: password.value,
                confirmPassword: confirmPassword.value,
                language: language.value
            })
        });

        const data = await response.json();

        if(data.success){
            emailError.textContent = "Account created successfully! Redirecting to login...";
            emailError.classList.add("success-message");

            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);
        } 
        else {
            emailError.textContent = data.message || "Registration failed";
            emailError.classList.remove("success-message");
            email.classList.add("input-error");
        }

    } catch (error) {
        emailError.textContent = "Server error. Please try again.";
        emailError.classList.remove("success-message");
        email.classList.add("input-error");
        console.log(error);
    }
});