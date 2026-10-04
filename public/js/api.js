// A cookie identifies the session. The CSRF token stays in this module's memory.
let csrfToken = "";
let sessionPromise;

export async function api(path, { method = "GET", body } = {}) {
    const mutation = !["GET", "HEAD"].includes(method);
    if (mutation && !csrfToken) await getSession();
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (mutation) headers["x-csrf-token"] = csrfToken;
    let response;
    try {
        response = await fetch(path, {
            method,
            headers,
            credentials: "same-origin",
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
    } catch {
        throw new Error(
            "Unable to connect. Check your connection and try again.",
        );
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(
            data.message ||
                "The request could not be completed. Please try again.",
        );
        error.status = response.status;
        if (response.status === 403) {
            csrfToken = "";
            sessionPromise = undefined;
        }
        throw error;
    }
    if (data.csrfToken) csrfToken = data.csrfToken;
    return data;
}

export function getSession({ refresh = false } = {}) {
    if (!sessionPromise || refresh) {
        sessionPromise = api("/api/session").catch((error) => {
            sessionPromise = undefined;
            throw error;
        });
    }
    return sessionPromise;
}

export function setStatus(element, message = "", isError = false) {
    element.textContent = message;
    element.classList.toggle("error", isError);
}

export function bindForm(form, status, handler) {
    form.addEventListener("input", () => setStatus(status));
    form.addEventListener("change", () => setStatus(status));
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity() || form.getAttribute("aria-busy") === "true")
            return;
        const button = form.querySelector('[type="submit"]');
        const label = button.textContent;
        button.disabled = true;
        button.textContent = "Please wait…";
        form.setAttribute("aria-busy", "true");
        setStatus(status);
        try {
            await handler(new FormData(form));
        } catch (error) {
            setStatus(status, error.message, true);
        } finally {
            button.disabled = false;
            button.textContent = label;
            form.setAttribute("aria-busy", "false");
        }
    });
}

export function setupPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = document.getElementById(
                button.getAttribute("aria-controls"),
            );
            const visible = input.type === "password";
            input.type = visible ? "text" : "password";
            button.textContent = visible ? "Hide" : "Show";
            button.setAttribute("aria-pressed", String(visible));
            button.setAttribute(
                "aria-label",
                `${visible ? "Hide" : "Show"} ${input.labels[0].textContent.toLowerCase()}`,
            );
        });
    });
}

export function setupNavigation() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const nav = document.querySelector("#site-nav");
    if (toggle && nav) {
        toggle.hidden = false;
        toggle.addEventListener("click", () => {
            const expanded = toggle.getAttribute("aria-expanded") !== "true";
            toggle.setAttribute("aria-expanded", String(expanded));
            nav.classList.toggle("is-open", expanded);
        });
        nav.addEventListener("click", (event) => {
            if (event.target.closest("a")) {
                nav.classList.remove("is-open");
                toggle.setAttribute("aria-expanded", "false");
            }
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && nav.classList.contains("is-open")) {
                nav.classList.remove("is-open");
                toggle.setAttribute("aria-expanded", "false");
                toggle.focus();
            }
        });
    }
}
