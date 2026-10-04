import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const moduleUrl = new URL("../js/api.js", import.meta.url);
test("API helper exists and sends in-memory CSRF with same-origin cookies", async () => {
    assert.ok(existsSync(moduleUrl), "Shared API helper is missing");
    const calls = [];
    globalThis.fetch = async (path, options) => {
        calls.push({ path, options });
        return {
            ok: true,
            status: 200,
            json: async () =>
                path === "/api/session"
                    ? { user: null, csrfToken: "anonymous-token" }
                    : { user: { name: "Ada" }, csrfToken: "rotated-token" },
        };
    };
    const { api, getSession } = await import(moduleUrl);
    await getSession();
    await api("/api/auth/login", {
        method: "POST",
        body: { email: "ada@example.test", password: "long-test-password" },
    });
    await api("/api/profile", {
        method: "PATCH",
        body: { name: "Ada", company: "" },
    });
    assert.equal(calls[1].options.credentials, "same-origin");
    assert.equal(calls[1].options.headers["x-csrf-token"], "anonymous-token");
    assert.equal(calls[2].options.headers["x-csrf-token"], "rotated-token");
});
test("API surfaces backend errors and rejects unavailable responses", async () => {
    if (!existsSync(moduleUrl)) return;
    const { api } = await import(moduleUrl);
    globalThis.fetch = async () => ({
        ok: false,
        status: 409,
        json: async () => ({ message: "Email already registered." }),
    });
    await assert.rejects(
        api("/api/auth/register", { method: "POST", body: {} }),
        /Email already registered/,
    );
    globalThis.fetch = async () => {
        throw new TypeError("Failed to fetch");
    };
    await assert.rejects(api("/api/inquiries"), /connect/);
});
