"use strict";
const { randomBytes, createHash, timingSafeEqual } = require("node:crypto");
const COOKIE = "cybershield_session";
const SESSION_MS = 24 * 60 * 60 * 1000;
const digest = (value) => createHash("sha256").update(value).digest("hex");
function equal(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const left = Buffer.from(a),
        right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
}
function sessions(db, production, origin) {
    const cookieOptions = {
        httpOnly: true,
        sameSite: "lax",
        secure: production,
        path: "/",
    };
    const revoke = (req) => {
        if (req.session)
            db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
                req.session.token_hash,
            );
        req.session = null;
    };
    return {
        load(req, res, next) {
            const token = (req.headers.cookie || "")
                .split(";")
                .map((v) => v.trim())
                .find((v) => v.startsWith(`${COOKIE}=`))
                ?.slice(COOKIE.length + 1);
            req.session =
                token && /^[a-f0-9]{64}$/.test(token)
                    ? db
                          .prepare(
                              "SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?",
                          )
                          .get(digest(token), Date.now())
                    : null;
            next();
        },
        issue(req, res, userId = null) {
            revoke(req);
            db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(
                Date.now(),
            );
            const token = randomBytes(32).toString("hex");
            req.session = {
                token_hash: digest(token),
                user_id: userId,
                csrf_token: randomBytes(32).toString("hex"),
                expires_at: Date.now() + SESSION_MS,
            };
            db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)").run(
                req.session.token_hash,
                userId,
                req.session.csrf_token,
                req.session.expires_at,
            );
            res.cookie(COOKIE, token, { ...cookieOptions, maxAge: SESSION_MS });
            return req.session;
        },
        csrf(req, res, next) {
            if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
            const expectedOrigin =
                origin || `${req.protocol}://${req.get("host")}`;
            if (
                (req.get("origin") && req.get("origin") !== expectedOrigin) ||
                req.get("sec-fetch-site") === "cross-site" ||
                !req.session ||
                !equal(req.get("x-csrf-token"), req.session.csrf_token)
            ) {
                return res
                    .status(403)
                    .json({
                        message:
                            "Invalid security token or origin. Refresh the page and try again.",
                    });
            }
            next();
        },
        logout(req, res) {
            revoke(req);
            res.clearCookie(COOKIE, cookieOptions);
        },
    };
}
module.exports = { sessions };
