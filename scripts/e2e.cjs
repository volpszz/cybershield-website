// Full browser integration tests. Synthetic credentials; no real user account is touched.
// Run: node scripts/e2e.cjs (install browser first: npx playwright install chromium).
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createApp } = require("../backend/app.cjs");

(async () => {
    const scratch =
        process.env.HERMES_SCRATCH ||
        (process.env.LOCALAPPDATA
            ? path.join(process.env.LOCALAPPDATA, "hermes", "cache", "scratch")
            : path.join(os.homedir(), ".cache", "hermes", "scratch"));
    fs.mkdirSync(scratch, { recursive: true });
    const temp = fs.mkdtempSync(path.join(scratch, "cybershield-e2e-"));
    const app = createApp({
        dbPath: path.join(temp, "test.sqlite"),
        rateLimit: { apiMax: 500, authMax: 100 },
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true });
    const checks = [];
    const verify = (name, condition) => {
        assert.ok(condition, name);
        checks.push(name);
        console.log("PASS:", name);
    };
    const reportDir = path.resolve("docs/screenshots");
    fs.mkdirSync(reportDir, { recursive: true });
    try {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 1000 },
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(origin + "/");
        await page.locator("#contact-form").waitFor();
        await page.screenshot({
            path: path.join(reportDir, "home-desktop.png"),
            fullPage: true,
        });
        verify(
            "Home image and CSS load",
            await page
                .locator(".hero-visual img")
                .evaluate((el) => el.complete && el.naturalWidth > 0),
        );
        await page.goto(origin + "/dashboard.html");
        await page.waitForURL("**/login.html");
        verify(
            "Dashboard rejects anonymous visitors",
            page.url().endsWith("/login.html"),
        );
        await page.goto(origin + "/register.html");
        await page.locator("#register-form [type=submit]").click();
        verify(
            "Required fields block registration",
            await page
                .locator("#name")
                .evaluate((el) => el.validity.valueMissing),
        );
        await page.locator("#name").fill("Browser Learner");
        await page.locator("#email").fill("browser@example.test");
        await page.locator("#company").fill("Learning Lab");
        await page.locator("#password").fill("Synthetic test password 2026!");
        await page
            .locator("#confirm-password")
            .fill("Different synthetic password!");
        verify(
            "Confirmation mismatch blocks registration",
            await page
                .locator("#confirm-password")
                .evaluate((el) => el.validity.customError),
        );
        await page
            .locator("#confirm-password")
            .fill("Synthetic test password 2026!");
        await page.locator('[aria-controls="password"]').click();
        verify(
            "Password reveal works",
            (await page.locator("#password").getAttribute("type")) === "text",
        );
        await page.locator("#confirm-password").press("Enter");
        await page.waitForURL("**/dashboard.html");
        await page.locator("#account-content").waitFor({ state: "visible" });
        verify(
            "Registration starts authenticated session",
            (await page.locator("#welcome").textContent()).includes(
                "Browser Learner",
            ),
        );
        verify(
            "New account has real empty state",
            (await page.locator("#inquiries-list").textContent()).includes(
                "no saved requests",
            ),
        );
        const cookie = (await context.cookies()).find(
            (c) => c.name === "cybershield_session",
        );
        verify(
            "Session cookie HttpOnly SameSite=Lax",
            cookie && cookie.httpOnly && cookie.sameSite === "Lax",
        );
        await page.locator("#name").fill("Updated Learner");
        await page.locator("#company").fill("Updated Company");
        await page.locator("#profile-form [type=submit]").click();
        await page.waitForFunction(() =>
            document
                .querySelector("#profile-status")
                .textContent.includes("saved"),
        );
        await page.reload();
        await page.locator("#account-content").waitFor({ state: "visible" });
        verify(
            "Profile persists after reload",
            (await page.locator("#name").inputValue()) === "Updated Learner",
        );
        await page.goto(origin + "/#contact");
        await page.waitForFunction(
            () =>
                document.querySelector("#contact-form [name=name]").value ===
                "Updated Learner",
        );
        await page
            .locator("#contact-form [name=service]")
            .selectOption("pentest");
        await page
            .locator("#contact-form [name=message]")
            .fill(
                "Please assess our business systems. <img src=x onerror=alert(1)>",
            );
        await page.locator("#contact-form [type=submit]").click();
        await page.waitForFunction(() =>
            document
                .querySelector("#contact-status")
                .textContent.includes("saved"),
        );
        verify(
            "Contact honestly reports local persistence",
            (await page.locator("#contact-status").textContent()).includes(
                "not sent by email",
            ),
        );
        await page.goto(origin + "/dashboard.html");
        await page.locator(".inquiry").waitFor();
        verify(
            "Saved inquiry appears for owner",
            (await page.locator(".inquiry-message").textContent()).includes(
                "<img src=x",
            ),
        );
        verify(
            "Untrusted inquiry text is not interpreted as HTML",
            (await page.locator(".inquiry-message img").count()) === 0,
        );
        await page.screenshot({
            path: path.join(reportDir, "dashboard-desktop.png"),
            fullPage: true,
        });
        await page.locator("#logout").click();
        await page.waitForURL("**/login.html");
        await page.goto(origin + "/dashboard.html");
        await page.waitForURL("**/login.html");
        verify("Logout revokes access", page.url().endsWith("/login.html"));
        await page.locator("#email").fill("browser@example.test");
        await page.locator("#password").fill("Wrong synthetic password!");
        await page.locator("#login-form [type=submit]").click();
        await page.waitForFunction(() =>
            document
                .querySelector("#login-status")
                .textContent.includes("Incorrect"),
        );
        verify(
            "Incorrect login shows backend error",
            (await page.locator("#login-status").textContent()).includes(
                "Incorrect email or password",
            ),
        );
        await page.locator("#password").fill("Synthetic test password 2026!");
        await page.locator("#password").press("Enter");
        await page.waitForURL("**/dashboard.html");
        await page.locator(".inquiry").waitFor();
        verify(
            "Login recovers saved profile and inquiry",
            (await page.locator("#welcome").textContent()).includes(
                "Updated Learner",
            ),
        );
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            for (const route of [
                "/",
                "/login.html",
                "/register.html",
                "/dashboard.html",
            ]) {
                await page.goto(origin + route);
                if (route === "/dashboard.html")
                    await page
                        .locator("#account-content")
                        .waitFor({ state: "visible" });
                verify(
                    `No horizontal overflow ${width}px ${route}`,
                    await page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <=
                            innerWidth + 1,
                    ),
                );
            }
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(origin + "/");
        await page.locator("[data-menu-toggle]").click();
        verify(
            "Mobile navigation opens",
            (await page
                .locator("[data-menu-toggle]")
                .getAttribute("aria-expanded")) === "true",
        );
        await page.keyboard.press("Escape");
        verify(
            "Escape closes mobile navigation",
            (await page
                .locator("[data-menu-toggle]")
                .getAttribute("aria-expanded")) === "false",
        );
        await page.screenshot({
            path: path.join(reportDir, "home-mobile.png"),
            fullPage: true,
        });
        await page.goto(origin + "/register.html");
        await page.screenshot({
            path: path.join(reportDir, "register-mobile.png"),
            fullPage: true,
        });
        verify("No uncaught JavaScript errors", errors.length === 0);
        fs.writeFileSync(
            path.resolve("docs/e2e-results.json"),
            JSON.stringify(
                { checks: checks.length, passed: true, results: checks },
                null,
                2,
            ),
        );
        console.log(`ALL ${checks.length} BROWSER CHECKS PASSED`);
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
        app.locals.close();
        fs.rmSync(temp, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
