const loginForm = document.querySelector("#login-form")
const passwordInput = document.querySelector("#password");
const togglePassword = document.querySelector("#toggle-password");
const loginMessage = document.querySelector("#login-message");

togglePassword.addEventListener("click", () => {
    const showPassword = passwordInput.type === "password";

 passwordInput.type = showPassword ? "text" : "password";
    togglePassword.textContent = showPassword
        ? "Hide password"
        : "Show password";

    togglePassword.setAttribute("aria-pressed", String(showPassword));
});


loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const email = formData.get("email");

    loginMessage.textContent =
        `Form validated for ${email}. Authentication is not connected yet.`;
});