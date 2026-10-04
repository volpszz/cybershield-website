const registerForm = document.querySelector("#register-form");
const passwordInput = document.querySelector("#password");
const confirmPasswordInput = document.querySelector("#confirm-password");
const registerMessage = document.querySelector("#register-message");

function validatePasswordMatch() {
    const passwordsMatch =
        passwordInput.value === confirmPasswordInput.value;

    confirmPasswordInput.setCustomValidity(
        passwordsMatch ? "" : "Passwords do not match."
    );
}

passwordInput.addEventListener("input", validatePasswordMatch);
confirmPasswordInput.addEventListener("input", validatePasswordMatch);

registerForm.addEventListener("submit", (event) => {
    event.preventDefault();

    // Recheck in case values changed without an input event.
    validatePasswordMatch();

    if (!registerForm.reportValidity()) {
        return;
    }

    const formData = new FormData(registerForm);
    const email = formData.get("email");

    registerMessage.textContent =
        `Form validated for ${email}. No account has been created yet.`;
});

registerForm.addEventListener("input", () => {
    registerMessage.textContent = "";
});