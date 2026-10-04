import { api, bindForm, setupPasswordToggles } from "./api.js";
setupPasswordToggles();
const form = document.querySelector("#login-form");
bindForm(form, document.querySelector("#login-status"), async (data) => {
    await api("/api/auth/login", {
        method: "POST",
        body: {
            email: data.get("email").trim(),
            password: data.get("password"),
        },
    });
    form.reset();
    window.location.assign("/dashboard.html");
});
