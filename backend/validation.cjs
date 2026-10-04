"use strict";
function invalid(message) {
    const error = new Error(message);
    error.status = 400;
    throw error;
}
function object(body) {
    if (!body || typeof body !== "object" || Array.isArray(body))
        invalid("A JSON object is required.");
    return body;
}
function text(value, label, min, max, trim = true) {
    if (typeof value !== "string") invalid(`${label} must be text.`);
    const result = trim ? value.trim() : value;
    const length = [...result].length;
    if (
        length < min ||
        length > max ||
        (trim && /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result))
    )
        invalid(`${label} must contain ${min} to ${max} characters.`);
    return result;
}
function email(value) {
    const normalized = text(value, "Email", 3, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
        invalid("Enter a valid email address.");
    return normalized;
}
function password(value) {
    return text(value, "Password", 15, 128, false);
}
function profile(body) {
    object(body);
    return {
        name: text(body.name, "Name", 2, 100),
        company: text(
            body.company === undefined ? "" : body.company,
            "Company",
            0,
            150,
        ),
    };
}
module.exports = { object, text, email, password, profile, invalid };
