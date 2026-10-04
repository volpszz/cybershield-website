"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
test(
    "npm scripts and runtime wrapper start the actual configurable HTTP service",
    { timeout: 15000 },
    async (t) => {
        const pkg = require("../package.json");
        assert.equal(pkg.scripts.start, "node server.cjs");
        assert.equal(pkg.scripts.dev, "node --watch server.cjs");
        assert.equal(pkg.scripts.test, "node --test tests/*.test.cjs");
        const dir = mkdtempSync(
            path.join(
                process.env.TMPDIR || os.tmpdir(),
                "cybershield-runtime-",
            ),
        );
        const child = spawn(process.execPath, ["server.cjs"], {
            cwd: path.join(__dirname, ".."),
            env: {
                ...process.env,
                PORT: "0",
                HOST: "127.0.0.1",
                DB_PATH: path.join(dir, "runtime.sqlite"),
                NODE_ENV: "development",
                APP_ORIGIN: "",
            },
            stdio: ["ignore", "pipe", "pipe"],
        });
        t.after(async () => {
            if (child.exitCode === null) {
                const closed = new Promise((resolve) =>
                    child.once("close", resolve),
                );
                child.kill();
                await closed;
            }
            rmSync(dir, { recursive: true, force: true });
        });
        const url = await new Promise((resolve, reject) => {
            let output = "",
                errors = "";
            child.stderr.on("data", (chunk) => {
                errors += chunk;
            });
            child.stdout.on("data", (chunk) => {
                output += chunk;
                const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
                if (match) resolve(match[0]);
            });
            child.once("exit", (code) =>
                reject(new Error(`Runtime exited ${code}: ${errors}`)),
            );
        });
        const response = await fetch(url + "/api/health");
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
            status: "ok",
            message: "CyberShield API is running.",
        });
    },
);
