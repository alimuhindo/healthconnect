// server.js
// Entry point for the Health Connect backend.
// Wires together: the USSD webhook (/ussd), the REST API (/api/*),
// and the static admin dashboard (public/).

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const ussdRoutes = require("./routes/ussd");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })); // Africa's Talking posts form-encoded data
app.use(bodyParser.json());

// Serve the admin dashboard as static files
app.use(express.static(path.join(__dirname, "public")));

// USSD webhook - point your Africa's Talking shortcode callback URL here, e.g.
//   https://your-app.onrender.com/ussd
app.use("/ussd", ussdRoutes);

// REST API for the mobile app + admin dashboard
app.use("/api", apiRoutes);

// Simple health check (useful for hosting platforms + uptime monitors)
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Health Connect server running on port ${PORT}`);
  console.log(`- Dashboard:  http://localhost:${PORT}/`);
  console.log(`- USSD hook:  http://localhost:${PORT}/ussd`);
  console.log(`- API base:   http://localhost:${PORT}/api`);
});
