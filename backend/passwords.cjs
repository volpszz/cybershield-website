"use strict";
const { scrypt, randomBytes, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const derive = promisify(scrypt);
// OWASP's scrypt baseline. Async crypto keeps expensive hashing off the event loop.
const PARAMETERS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
async function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const hash = await derive(password, salt, 64, PARAMETERS);
    return `scrypt$131072$8$1$${salt}$${hash.toString("hex")}`;
}
async function verifyPassword(password, stored) {
    // Missing accounts still perform the expensive operation to reduce timing enumeration.
    const parts = stored?.split("$");
    const salt = parts ? parts[4] : "00000000000000000000000000000000";
    const actual = await derive(password, salt, 64, PARAMETERS);
    const expected = Buffer.from(parts ? parts[5] : "00".repeat(64), "hex");
    return (
        expected.length === actual.length &&
        timingSafeEqual(actual, expected) &&
        Boolean(stored)
    );
}
module.exports = { hashPassword, verifyPassword };
