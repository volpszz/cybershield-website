import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = (path) =>
    readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("all pages provide semantic English offline CSP-compatible layouts", () => {
    for (const page of ["index", "login", "register", "dashboard"]) {
        assert.ok(
            existsSync(new URL("../" + page + ".html", import.meta.url)),
            `${page} page missing`,
        );
        const html = read(page + ".html");
        assert.match(html, /lang="en"/);
        assert.match(html, /class="skip-link"/);
        assert.match(html, /<main[^>]*id="main"/);
        assert.match(
            html,
            new RegExp(
                `type="module" src="/js/${page === "index" ? "main" : page}\\.js"`,
            ),
        );
        assert.doesNotMatch(html, /<style|style=|onclick=|https:\/\//);
        assert.match(html, /Learning project/);
    }
});
test("registration and contact forms expose constraints and honest saved-request language", () => {
    const register = read("register.html");
    assert.match(
        register,
        /<input\b(?=[^>]*id="password")(?=[^>]*minlength="15")(?=[^>]*maxlength="128")[^>]*>/,
    );
    assert.match(register, /id="confirm-password"/);
    const home = read("index.html");
    for (const service of ["firewall", "pentest", "network", "custom"])
        assert.match(home, new RegExp(`value="${service}"`));
    assert.match(home, /not sent by email/);
    for (const page of ["index", "login", "register", "dashboard"])
        assert.match(read(page + ".html"), /role="status"/);
});
