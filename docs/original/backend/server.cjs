const express = require("express");

const app = express();
const port = 3000;

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "CyberShield API is running."
    });
});

app.listen(port, "127.0.0.1", () => {
    console.log(`Server running at http://127.0.0.1:${port}`);
});