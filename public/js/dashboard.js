import { api, getSession, bindForm, setStatus } from "./api.js";
const pageStatus = document.querySelector("#page-status");
const profileForm = document.querySelector("#profile-form");
const profileStatus = document.querySelector("#profile-status");
const inquiriesStatus = document.querySelector("#inquiries-status");
const refresh = document.querySelector("#refresh-inquiries");
const logout = document.querySelector("#logout");
const retry = document.querySelector("#retry-session");
const services = {
    firewall: "Firewall",
    pentest: "Business pentest",
    network: "Network equipment",
    custom: "Custom solutions",
};
const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Date unavailable"
        : dateFormatter.format(date);
}
function populateProfile(user) {
    profileForm.elements.name.value = user.name;
    profileForm.elements.email.value = user.email;
    profileForm.elements.company.value = user.company || "";
    document.querySelector("#welcome").textContent = `Welcome, ${user.name}.`;
    document.querySelector("#member-since").textContent =
        `Account created ${formatDate(user.createdAt)}`;
}
// API values become text nodes, never HTML. Requests may contain untrusted text.
function renderInquiries(inquiries) {
    const list = document.querySelector("#inquiries-list");
    list.replaceChildren();
    if (!inquiries.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        const title = document.createElement("h3");
        title.textContent = "Your next conversation starts here.";
        const copy = document.createElement("p");
        copy.textContent =
            "You have no saved requests yet. Submit a service request while signed in to see it here.";
        empty.append(title, copy);
        list.append(empty);
        return;
    }
    for (const inquiry of inquiries) {
        const article = document.createElement("article");
        article.className = "inquiry";
        const top = document.createElement("div");
        top.className = "inquiry-top";
        const title = document.createElement("h3");
        title.textContent = services[inquiry.service] || "Service request";
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = `Status: ${inquiry.status}`;
        top.append(title, badge);
        const time = document.createElement("time");
        time.textContent = formatDate(inquiry.createdAt);
        time.dateTime = inquiry.createdAt;
        const message = document.createElement("p");
        message.className = "inquiry-message";
        message.textContent = inquiry.message;
        const meta = document.createElement("p");
        meta.className = "inquiry-meta";
        meta.textContent = `${inquiry.name} · ${inquiry.email}`;
        article.append(top, time, message, meta);
        list.append(article);
    }
}
async function loadInquiries() {
    refresh.disabled = true;
    refresh.textContent = "Loading…";
    setStatus(inquiriesStatus, "Loading saved requests…");
    try {
        const { inquiries } = await api("/api/inquiries");
        renderInquiries(inquiries);
        setStatus(inquiriesStatus);
    } catch (error) {
        if (error.status === 401) {
            window.location.replace("/login.html");
            return;
        }
        setStatus(
            inquiriesStatus,
            `${error.message} Use Refresh to try again.`,
            true,
        );
    } finally {
        refresh.disabled = false;
        refresh.textContent = "Refresh";
    }
}
async function loadAccount() {
    retry.hidden = true;
    setStatus(pageStatus, "Loading your account…");
    try {
        const { user } = await getSession({ refresh: true });
        if (!user) {
            window.location.replace("/login.html");
            return;
        }
        populateProfile(user);
        document.querySelector("#account-content").hidden = false;
        logout.disabled = false;
        setStatus(pageStatus);
        await loadInquiries();
    } catch (error) {
        setStatus(pageStatus, error.message, true);
        retry.hidden = false;
    }
}
bindForm(profileForm, profileStatus, async (data) => {
    try {
        const { user } = await api("/api/profile", {
            method: "PATCH",
            body: {
                name: data.get("name").trim(),
                company: data.get("company").trim(),
            },
        });
        populateProfile(user);
        setStatus(profileStatus, "Your profile has been saved.");
    } catch (error) {
        if (error.status === 401) window.location.replace("/login.html");
        throw error;
    }
});
refresh.addEventListener("click", loadInquiries);
retry.addEventListener("click", loadAccount);
logout.addEventListener("click", async () => {
    logout.disabled = true;
    logout.textContent = "Logging out…";
    try {
        await api("/api/auth/logout", { method: "POST" });
        window.location.replace("/login.html");
    } catch (error) {
        setStatus(pageStatus, error.message, true);
        logout.disabled = false;
        logout.textContent = "Log out";
    }
});
loadAccount();
