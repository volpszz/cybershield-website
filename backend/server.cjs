"use strict";
const { existsSync } = require("node:fs");
const path = require("node:path");
// Native .env loading preserves inherited environment variables.
const envFile = path.join(__dirname, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { createApp } = require("./app.cjs");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error("PORT must be an integer from 0 to 65535.");
    process.exit(1);
}
const app = createApp();
const server = app.listen(port, host, () => {
    const displayHost = host.includes(":") ? `[${host}]` : host;
    console.log(
        `Server running at http://${displayHost}:${server.address().port}`,
    );
});
server.on("error", (error) => {
    console.error(
        error.code === "EADDRINUSE"
            ? "The configured port is already in use."
            : "Unable to start the HTTP server.",
    );
    app.locals.close();
    process.exitCode = 1;
});
let stopping = false;
function shutdown() {
    if (stopping) return;
    stopping = true;
    server.close(() => {
        app.locals.close();
    });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
