"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");

async function fixture(t, options = {}) {
    const { createApp } = require("../app.cjs");
    const dir = mkdtempSync(
        path.join(process.env.TMPDIR || os.tmpdir(), "cybershield-test-"),
    );
    const app = createApp({
        dbPath: path.join(dir, "test.sqlite"),
        ...options,
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        app.locals.close();
        rmSync(dir, { recursive: true, force: true });
    });
    return { app, base, dir };
}
function client(base) {
    let cookie = "",
        csrf = "";
    return {
        get cookie() {
            return cookie;
        },
        get csrf() {
            return csrf;
        },
        async request(url, method = "GET", body, extra = {}) {
            const headers = { cookie, ...extra };
            if (body !== undefined) {
                headers["content-type"] = "application/json";
                headers["x-csrf-token"] = csrf;
            }
            Object.assign(headers, extra);
            const response = await fetch(base + url, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                redirect: "manual",
            });
            if (response.headers.get("set-cookie"))
                cookie = response.headers.get("set-cookie").split(";")[0];
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }
            if (data.csrfToken) csrf = data.csrfToken;
            return { status: response.status, data, headers: response.headers };
        },
    };
}
test("anonymous sessions enforce CSRF and origin checks", async (t) => {
    const { base } = await fixture(t);
    const c = client(base);
    const session = await c.request("/api/session");
    assert.equal(session.status, 200);
    assert.equal(session.data.user, null);
    assert.match(session.data.csrfToken, /^[a-f0-9]{64}$/);
    assert.match(session.headers.get("set-cookie"), /HttpOnly/);
    assert.match(session.headers.get("set-cookie"), /SameSite=Lax/);
    assert.equal(
        (
            await c.request(
                "/api/auth/logout",
                "POST",
                {},
                { "x-csrf-token": "" },
            )
        ).status,
        403,
    );
    assert.equal(
        (
            await c.request(
                "/api/auth/logout",
                "POST",
                {},
                { origin: "https://evil.example" },
            )
        ).status,
        403,
    );
    assert.equal((await c.request("/api/auth/logout", "POST", {})).status, 200);
    assert.equal((await c.request("/api/auth/logout", "POST", {})).status, 403);
});

const account = {
    name: "Alice Example",
    email: "alice@example.com",
    password: "a long passphrase for testing",
    company: "Example Ltd",
};
test("registration validates input and rotates anonymous session", async (t) => {
    const { base } = await fixture(t);
    const c = client(base);
    await c.request("/api/session");
    const oldCookie = c.cookie,
        oldCsrf = c.csrf;
    for (const body of [
        {},
        { ...account, password: "short" },
        { ...account, password: "x".repeat(129) },
        { ...account, name: [] },
        { ...account, email: "not-email" },
        { ...account, company: 123 },
    ]) {
        assert.equal(
            (await c.request("/api/auth/register", "POST", body)).status,
            400,
        );
    }
    const r = await c.request("/api/auth/register", "POST", {
        ...account,
        email: " ALICE@EXAMPLE.COM ",
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.user.email, account.email);
    assert.equal(r.data.user.company, account.company);
    assert.ok(r.data.user.id);
    assert.ok(r.data.user.createdAt);
    assert.equal(r.data.user.password, undefined);
    assert.notEqual(c.cookie, oldCookie);
    assert.notEqual(c.csrf, oldCsrf);
    assert.deepEqual((await c.request("/api/session")).data.user, r.data.user);
    assert.equal(
        (await c.request("/api/auth/register", "POST", account)).status,
        409,
    );
});
test("login rejects bad credentials, rotates session and logout revokes it", async (t) => {
    const { base } = await fixture(t);
    const c = client(base);
    await c.request("/api/session");
    await c.request("/api/auth/register", "POST", account);
    assert.equal((await c.request("/api/auth/logout", "POST", {})).status, 200);
    await c.request("/api/session");
    assert.equal(
        (
            await c.request("/api/auth/login", "POST", {
                email: account.email,
                password: "invalid password value",
            })
        ).status,
        401,
    );
    assert.equal(
        (
            await c.request("/api/auth/login", "POST", {
                email: "missing@example.com",
                password: account.password,
            })
        ).status,
        401,
    );
    assert.equal(
        (
            await c.request("/api/auth/login", "POST", {
                email: account.email,
                password: 10,
            })
        ).status,
        400,
    );
    const previous = c.cookie;
    const r = await c.request("/api/auth/login", "POST", {
        email: account.email,
        password: account.password,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.name, account.name);
    assert.notEqual(c.cookie, previous);
    const authenticated = c.cookie;
    await c.request("/api/auth/logout", "POST", {});
    assert.equal(
        (
            await c.request("/api/session", "GET", undefined, {
                cookie: authenticated,
            })
        ).data.user,
        null,
    );
});

test("profile requires authentication and persists validated changes", async (t) => {
    const { base } = await fixture(t);
    const c = client(base);
    await c.request("/api/session");
    assert.equal(
        (
            await c.request("/api/profile", "PATCH", {
                name: "New Name",
                company: "",
            })
        ).status,
        401,
    );
    await c.request("/api/auth/register", "POST", account);
    assert.equal(
        (await c.request("/api/profile", "PATCH", { name: "", company: "" }))
            .status,
        400,
    );
    const r = await c.request("/api/profile", "PATCH", {
        name: "New Name",
        company: "New Company",
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.name, "New Name");
    assert.equal(
        (await c.request("/api/session")).data.user.company,
        "New Company",
    );
});
test("contact saves real inquiries and enforces account ownership", async (t) => {
    const { base } = await fixture(t);
    const c = client(base);
    await c.request("/api/session");
    assert.equal((await c.request("/api/inquiries")).status, 401);
    const inquiry = {
        name: "Visitor Example",
        email: "visitor@example.com",
        service: "firewall",
        message: "Please help us configure our firewall.",
    };
    assert.equal(
        (
            await c.request("/api/contact", "POST", {
                ...inquiry,
                service: "invalid",
            })
        ).status,
        400,
    );
    assert.equal(
        (await c.request("/api/contact", "POST", { ...inquiry, message: "" }))
            .status,
        400,
    );
    assert.equal(
        (await c.request("/api/contact", "POST", inquiry)).status,
        201,
    );
    await c.request("/api/auth/register", "POST", account);
    assert.deepEqual((await c.request("/api/inquiries")).data.inquiries, []);
    const r = await c.request("/api/contact", "POST", {
        ...inquiry,
        service: "pentest",
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.message, "Your request has been saved.");
    assert.equal(r.data.inquiry.status, "new");
    const rows = (await c.request("/api/inquiries")).data.inquiries;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, r.data.inquiry.id);
    assert.equal(rows[0].message, inquiry.message);
    const other = client(base);
    await other.request("/api/session");
    await other.request("/api/auth/register", "POST", {
        ...account,
        email: "other@example.com",
    });
    assert.deepEqual(
        (await other.request("/api/inquiries")).data.inquiries,
        [],
    );
});
test("users, sessions and inquiries survive app recreation", async (t) => {
    const { base, app, dir } = await fixture(t);
    const c = client(base);
    await c.request("/api/session");
    await c.request("/api/auth/register", "POST", account);
    await c.request("/api/contact", "POST", {
        name: account.name,
        email: account.email,
        service: "custom",
        message: "A durable request for custom security.",
    });
    // Closing the first app's database simulates process restart without erasing files.
    app.locals.close();
    const second = require("../app.cjs").createApp({
        dbPath: path.join(dir, "test.sqlite"),
    });
    const server = second.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    try {
        const secondClient = client(
            `http://127.0.0.1:${server.address().port}`,
        );
        const headers = { cookie: c.cookie };
        assert.equal(
            (
                await secondClient.request(
                    "/api/session",
                    "GET",
                    undefined,
                    headers,
                )
            ).data.user.email,
            account.email,
        );
        assert.equal(
            (
                await secondClient.request(
                    "/api/inquiries",
                    "GET",
                    undefined,
                    headers,
                )
            ).data.inquiries.length,
            1,
        );
    } finally {
        await new Promise((resolve) => server.close(resolve));
        second.locals.close();
    }
});

test("security headers, bounded JSON and JSON-only errors protect API", async (t) => {
    const { base, app } = await fixture(t);
    const c = client(base);
    const health = await c.request("/api/health");
    assert.equal(health.headers.get("x-powered-by"), null);
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.match(
        health.headers.get("content-security-policy"),
        /script-src 'self'/,
    );
    assert.equal((await c.request("/api/not-real")).status, 404);
    assert.equal(
        typeof (await c.request("/api/not-real")).data.message,
        "string",
    );
    await c.request("/api/session");
    const oversized = await c.request("/api/contact", "POST", {
        message: "x".repeat(20000),
    });
    assert.equal(oversized.status, 413);
    assert.deepEqual(Object.keys(oversized.data), ["message"]);
    const malformed = await fetch(base + "/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{broken",
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { message: "Invalid JSON body." });
    app.locals.close();
    const internal = await c.request("/api/session");
    assert.equal(internal.status, 500);
    assert.deepEqual(internal.data, {
        message: "An unexpected server error occurred.",
    });
});
test("per-IP API and auth limits reject requests before hash work", async (t) => {
    const { base } = await fixture(t, {
        rateLimit: { apiMax: 5, authMax: 2, windowMs: 60000 },
    });
    const c = client(base);
    await c.request("/api/session");
    for (let i = 0; i < 2; i++)
        assert.equal(
            (await c.request("/api/auth/login", "POST", {})).status,
            400,
        );
    const limited = await c.request("/api/auth/login", "POST", {});
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get("retry-after"));
    await c.request("/api/health");
    assert.equal((await c.request("/api/health")).status, 429);
});
test("static files expose only public and protect every dashboard URL spelling", async (t) => {
    const { base } = await fixture(t);
    const c = client(base);
    for (const url of [
        "/dashboard.html",
        "/DASHBOARD.html",
        "/%64ashboard.html",
        "/dashboard.html/",
    ]) {
        const r = await c.request(url);
        assert.equal(r.status, 302, url);
        assert.equal(r.headers.get("location"), "/login.html");
    }
    for (const url of [
        "/backend/server.cjs",
        "/docs/guide.pdf",
        "/package.json",
        "/.env",
    ])
        assert.equal((await c.request(url)).status, 404);
    assert.equal((await c.request("/")).status, 200);
});
test("production sessions require Secure cookies and explicit allowed origin", async (t) => {
    const { base } = await fixture(t, {
        production: true,
        origin: "https://cybershield.example",
    });
    const c = client(base);
    const session = await c.request("/api/session");
    assert.match(session.headers.get("set-cookie"), /Secure/);
    assert.equal(
        (await c.request("/api/auth/logout", "POST", {}, { origin: base }))
            .status,
        403,
    );
    assert.equal(
        (
            await c.request(
                "/api/auth/logout",
                "POST",
                {},
                { origin: "https://cybershield.example" },
            )
        ).status,
        200,
    );
});

test("password hashes and session digests are the only secrets persisted", async (t) => {
    const { base, dir } = await fixture(t);
    const c = client(base);
    await c.request("/api/session");
    await c.request("/api/auth/register", "POST", account);
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(path.join(dir, "test.sqlite"));
    try {
        const first = db
            .prepare("SELECT password_hash FROM users")
            .get().password_hash;
        assert.match(
            first,
            /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/,
        );
        assert.ok(!first.includes(account.password));
        const rawToken = c.cookie.split("=")[1];
        assert.notEqual(
            db.prepare("SELECT token_hash FROM sessions").get().token_hash,
            rawToken,
        );
        const other = client(base);
        await other.request("/api/session");
        await other.request("/api/auth/register", "POST", {
            ...account,
            email: "second@example.com",
        });
        const hashes = db.prepare("SELECT password_hash FROM users").all();
        assert.notEqual(hashes[0].password_hash, hashes[1].password_hash);
        db.prepare("UPDATE sessions SET expires_at = 0").run();
        assert.equal((await c.request("/api/inquiries")).status, 401);
        assert.equal((await c.request("/api/session")).data.user, null);
    } finally {
        db.close();
    }
});
test("authentication bounds concurrent expensive password hashing", async (t) => {
    const { base } = await fixture(t);
    const clients = [client(base), client(base), client(base)];
    await Promise.all(clients.map((c) => c.request("/api/session")));
    const responses = await Promise.all(
        clients.map((c, index) =>
            c.request("/api/auth/register", "POST", {
                ...account,
                email: `user${index}@example.com`,
            }),
        ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 201, 429]);
});
test("strict optional field types reject null instead of silently accepting it", async (t) => {
    const { base } = await fixture(t);
    const c = client(base);
    await c.request("/api/session");
    assert.equal(
        (
            await c.request("/api/auth/register", "POST", {
                ...account,
                company: null,
            })
        ).status,
        400,
    );
});

test("factory serves the fixed health contract", async (t) => {
    let factory;
    try {
        factory = require("../app.cjs").createApp;
    } catch {}
    assert.equal(
        typeof factory,
        "function",
        "createApp factory is implemented",
    );
    const { base } = await fixture(t);
    const r = await client(base).request("/api/health");
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, {
        status: "ok",
        message: "CyberShield API is running.",
    });
});
