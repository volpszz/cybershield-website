import {
    api,
    getSession,
    bindForm,
    setStatus,
    setupNavigation,
} from "./api.js";
setupNavigation();
const form = document.querySelector("#contact-form");
const status = document.querySelector("#contact-status");
// A failed optional session lookup must not prevent browsing the site.
getSession()
    .then(({ user }) => {
        if (!user) return;
        const accountLink = document.querySelector("[data-account-link]");
        accountLink.textContent = "Your workspace";
        accountLink.href = "/dashboard.html";
        document.querySelector("[data-register-link]").hidden = true;
        form.elements.name.value = user.name;
        form.elements.email.value = user.email;
    })
    .catch(() => {});
document.querySelectorAll("[data-service]").forEach((link) => {
    link.addEventListener("click", () => {
        form.elements.service.value = link.dataset.service;
        setStatus(status);
    });
});
bindForm(form, status, async (data) => {
    const result = await api("/api/contact", {
        method: "POST",
        body: {
            name: data.get("name").trim(),
            email: data.get("email").trim(),
            service: data.get("service"),
            message: data.get("message").trim(),
        },
    });
    form.reset();
    setStatus(
        status,
        `${result.message} It is stored in this local application, not sent by email.`,
    );
});
