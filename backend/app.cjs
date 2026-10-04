"use strict";
const express = require("express");
const helmet = require("helmet");
const { rateLimiter } = require("./rate-limit.cjs");
const path = require("node:path");
const { openDatabase } = require("./database.cjs");
const { sessions } = require("./sessions.cjs");
const validate = require("./validation.cjs");
const { hashPassword, verifyPassword } = require("./passwords.cjs");
function createApp(options = {}) {
    const app = express();
    const db = openDatabase(
        options.dbPath ||
            process.env.DB_PATH ||
            path.join(__dirname, "data", "cybershield.sqlite"),
    );
    const production =
        options.production ?? process.env.NODE_ENV === "production";
    const session = sessions(
        db,
        production,
        options.origin || process.env.APP_ORIGIN,
    );
    app.disable("x-powered-by");
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'"],
                    imgSrc: ["'self'", "data:"],
                    fontSrc: ["'self'"],
                    connectSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    frameAncestors: ["'none'"],
                    formAction: ["'self'"],
                    upgradeInsecureRequests: production ? [] : null,
                },
            },
            strictTransportSecurity: production ? undefined : false,
        }),
    );
    const limits = {
        apiMax: 120,
        authMax: 10,
        windowMs: 60000,
        ...options.rateLimit,
    };
    app.use("/api", rateLimiter(limits.apiMax, limits.windowMs));
    app.use("/api/auth", rateLimiter(limits.authMax, limits.windowMs));
    app.use("/api", (req, res, next) => {
        res.set("Cache-Control", "no-store");
        next();
    });
    app.use(express.json({ limit: "16kb" }));
    app.use(session.load);
    app.use("/api", session.csrf);
    const userById = (id) =>
        id
            ? db
                  .prepare(
                      "SELECT id, name, email, company, created_at AS createdAt FROM users WHERE id = ?",
                  )
                  .get(id) || null
            : null;
    app.get("/api/session", (req, res) => {
        if (!req.session) session.issue(req, res);
        res.json({
            user: userById(req.session.user_id),
            csrfToken: req.session.csrf_token,
        });
    });
    // Each hash uses about 128 MiB; bound concurrent work across all client IPs.
    let authWork = 0;
    const boundedAuth = (handler) => async (req, res, next) => {
        if (authWork >= 2) {
            res.set("Retry-After", "1");
            return res
                .status(429)
                .json({
                    message:
                        "Authentication is busy. Please try again shortly.",
                });
        }
        authWork++;
        try {
            await handler(req, res);
        } catch (error) {
            next(error);
        } finally {
            authWork--;
        }
    };
    app.post(
        "/api/auth/register",
        boundedAuth(async (req, res) => {
            const body = validate.object(req.body),
                profile = validate.profile(body);
            const email = validate.email(body.email),
                password = validate.password(body.password);
            if (db.prepare("SELECT id FROM users WHERE email = ?").get(email))
                return res
                    .status(409)
                    .json({
                        message: "An account with this email already exists.",
                    });
            const passwordHash = await hashPassword(password);
            let result;
            try {
                result = db
                    .prepare(
                        "INSERT INTO users (name, email, company, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                    )
                    .run(
                        profile.name,
                        email,
                        profile.company,
                        passwordHash,
                        new Date().toISOString(),
                    );
            } catch (error) {
                if (
                    db
                        .prepare("SELECT id FROM users WHERE email = ?")
                        .get(email)
                )
                    return res
                        .status(409)
                        .json({
                            message:
                                "An account with this email already exists.",
                        });
                throw error;
            }
            const user = userById(Number(result.lastInsertRowid));
            session.issue(req, res, user.id);
            res.status(201).json({ user, csrfToken: req.session.csrf_token });
        }),
    );
    app.post(
        "/api/auth/login",
        boundedAuth(async (req, res) => {
            const body = validate.object(req.body),
                email = validate.email(body.email),
                password = validate.password(body.password);
            const row = db
                .prepare("SELECT * FROM users WHERE email = ?")
                .get(email);
            if (!(await verifyPassword(password, row?.password_hash)))
                return res
                    .status(401)
                    .json({ message: "Incorrect email or password." });
            session.issue(req, res, row.id);
            res.json({
                user: userById(row.id),
                csrfToken: req.session.csrf_token,
            });
        }),
    );
    app.post("/api/auth/logout", (req, res) => {
        session.logout(req, res);
        res.json({ message: "Logged out." });
    });
    const authenticated = (req, res, next) => {
        req.user = userById(req.session?.user_id);
        if (!req.user)
            return res
                .status(401)
                .json({ message: "Please log in to continue." });
        next();
    };
    app.patch("/api/profile", authenticated, (req, res) => {
        const profile = validate.profile(req.body);
        db.prepare("UPDATE users SET name = ?, company = ? WHERE id = ?").run(
            profile.name,
            profile.company,
            req.user.id,
        );
        res.json({ user: userById(req.user.id) });
    });
    app.get("/api/inquiries", authenticated, (req, res) => {
        const inquiries = db
            .prepare(
                "SELECT id, name, email, service, message, status, created_at AS createdAt FROM inquiries WHERE user_id = ? ORDER BY id DESC",
            )
            .all(req.user.id);
        res.json({ inquiries });
    });
    app.post("/api/contact", (req, res) => {
        const body = validate.object(req.body),
            name = validate.text(body.name, "Name", 2, 100),
            email = validate.email(body.email);
        const service = validate.text(body.service, "Service", 1, 20),
            message = validate.text(body.message, "Message", 10, 5000);
        if (!["firewall", "pentest", "network", "custom"].includes(service))
            validate.invalid("Select a valid service.");
        const createdAt = new Date().toISOString();
        const result = db
            .prepare(
                "INSERT INTO inquiries (user_id, name, email, service, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .run(
                req.session?.user_id ?? null,
                name,
                email,
                service,
                message,
                createdAt,
            );
        res.status(201).json({
            message: "Your request has been saved.",
            inquiry: {
                id: Number(result.lastInsertRowid),
                status: "new",
                createdAt,
            },
        });
    });
    app.get("/api/health", (req, res) =>
        res.json({ status: "ok", message: "CyberShield API is running." }),
    );
    app.use("/api", (req, res) =>
        res.status(404).json({ message: "API endpoint not found." }),
    );
    // Windows filenames are case-insensitive and may ignore trailing dots/spaces.
    // Guard the normalized path before static middleware can expose dashboard HTML.
    app.use((req, res, next) => {
        let decoded;
        try {
            decoded = decodeURIComponent(req.path).replaceAll("\\", "/");
        } catch {
            return res.status(400).json({ message: "Invalid request path." });
        }
        const normalized = decoded
            .split("/")
            .map((part) => part.replace(/[. ]+$/, "").toLowerCase())
            .filter(Boolean)
            .join("/");
        if (normalized === "dashboard.html") {
            res.set("Cache-Control", "no-store");
            if (!userById(req.session?.user_id))
                return res.redirect("/login.html");
        }
        if (
            decoded.includes(":") ||
            decoded.split("/").some((part) => part.startsWith(".")) ||
            /^(backend|docs|tests|node_modules)(\/|$)/.test(normalized) ||
            /^package(?:-lock)?\.json$/.test(normalized)
        )
            return res.status(404).json({ message: "Page not found." });
        next();
    });
    app.use(
        express.static(path.join(__dirname, "..", "public"), {
            dotfiles: "deny",
        }),
    );
    app.use((req, res) => res.status(404).json({ message: "Page not found." }));
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        const status =
            error.status === 400
                ? 400
                : error.type === "entity.too.large"
                  ? 413
                  : 500;
        res.status(status).json({
            message:
                status === 400
                    ? error.type === "entity.parse.failed"
                        ? "Invalid JSON body."
                        : error.message
                    : status === 413
                      ? "Request body is too large."
                      : "An unexpected server error occurred.",
        });
    });
    let closed = false;
    app.locals.close = () => {
        if (!closed) {
            db.close();
            closed = true;
        }
    };
    return app;
}
module.exports = { createApp };
