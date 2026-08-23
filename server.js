const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// Serve all website files
app.use(express.static(path.join(__dirname)));

// Homepage
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Spotify callback
app.get("/callback", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bollywood Safar running on port ${PORT}`);
});
