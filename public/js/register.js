import { api, bindForm, setupPasswordToggles } from "./api.js";
setupPasswordToggles();
const form = document.querySelector("#register-form");
const password = document.querySelector("#password");
const confirmation = document.querySelector("#confirm-password");
function validatePasswordMatch() {
    confirmation.setCustomValidity(
        password.value === confirmation.value ? "" : "Passwords do not match.",
    );
}
password.addEventListener("input", validatePasswordMatch);
confirmation.addEventListener("input", validatePasswordMatch);
// Recheck autofilled/programmatically changed fields before the shared handler.
form.addEventListener("submit", validatePasswordMatch);
bindForm(form, document.querySelector("#register-status"), async (data) => {
    validatePasswordMatch();
    if (!form.reportValidity()) return;
    await api("/api/auth/register", {
        method: "POST",
        body: {
            name: data.get("name").trim(),
            email: data.get("email").trim(),
            company: data.get("company").trim(),
            password: data.get("password"),
        },
    });
    form.reset();
    window.location.assign("/dashboard.html");
});
