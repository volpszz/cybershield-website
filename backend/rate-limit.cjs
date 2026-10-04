"use strict";
// In-memory limits are suitable for one local process, not a distributed deployment.
function rateLimiter(max, windowMs) {
    const entries = new Map();
    let nextSweep = 0;
    return (req, res, next) => {
        const now = Date.now();
        if (now >= nextSweep) {
            for (const [key, value] of entries)
                if (value.reset <= now) entries.delete(key);
            nextSweep = now + windowMs;
        }
        const ip = req.ip;
        let entry = entries.get(ip);
        if (!entry || entry.reset <= now) {
            if (entries.size >= 10000 && !entries.has(ip))
                return res
                    .status(429)
                    .json({
                        message: "Too many requests. Please try again later.",
                    });
            entry = { count: 0, reset: now + windowMs };
            entries.set(ip, entry);
        }
        entry.count++;
        if (entry.count > max) {
            res.set(
                "Retry-After",
                String(Math.ceil((entry.reset - now) / 1000)),
            );
            return res
                .status(429)
                .json({
                    message: "Too many requests. Please try again later.",
                });
        }
        next();
    };
}
module.exports = { rateLimiter };
