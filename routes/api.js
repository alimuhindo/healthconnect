// routes/api.js
// REST API used by (a) the admin web dashboard and (b) a future mobile app.
// Kept intentionally simple (no auth) for a pilot/prototype stage.
// Before going live, add authentication (e.g. JWT) on the /admin routes -
// see README "Securing this before real deployment".

const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { findFacilities, decrementSlot, generateReference } = require("./facilityService");

// ---------- FACILITIES ----------

// List all facilities (used by dashboard + mobile app map view)
router.get("/facilities", (req, res) => {
  const rows = db.prepare("SELECT * FROM facilities ORDER BY name").all();
  res.json(rows);
});

// Find nearest facilities for a service (used by the mobile app "Find nearest" screen)
router.get("/facilities/nearest", (req, res) => {
  const { service, lat, lng, district } = req.query;
  if (!service) return res.status(400).json({ error: "service is required" });

  const facilities = findFacilities({
    serviceType: service,
    patientLat: lat ? parseFloat(lat) : null,
    patientLon: lng ? parseFloat(lng) : null,
    district,
    limit: 5
  });
  res.json(facilities);
});

// Admin: update a facility's available capacity (health worker dashboard action)
router.patch("/facilities/:id/capacity", (req, res) => {
  const { available_slots } = req.body;
  if (available_slots == null) return res.status(400).json({ error: "available_slots required" });

  db.prepare("UPDATE facilities SET available_slots = ? WHERE id = ?").run(
    available_slots,
    req.params.id
  );
  res.json({ success: true });
});

// Admin: add a new facility
router.post("/facilities", (req, res) => {
  const { name, level, district, latitude, longitude, services, total_capacity, phone } = req.body;
  if (!name || !services) return res.status(400).json({ error: "name and services required" });

  const info = db
    .prepare(
      `INSERT INTO facilities (name, level, district, latitude, longitude, services, total_capacity, available_slots, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, level || "", district || "", latitude || null, longitude || null, services, total_capacity || 20, total_capacity || 20, phone || "");

  res.json({ id: info.lastInsertRowid });
});

// ---------- APPOINTMENTS ----------

// Book an appointment via the mobile app (mirrors the USSD booking logic)
router.post("/appointments", (req, res) => {
  const { patient_phone, facility_id, service_type } = req.body;
  if (!patient_phone || !facility_id || !service_type) {
    return res.status(400).json({ error: "patient_phone, facility_id, service_type required" });
  }

  const facility = db.prepare("SELECT * FROM facilities WHERE id = ?").get(facility_id);
  if (!facility) return res.status(404).json({ error: "facility not found" });
  if (facility.available_slots <= 0) return res.status(409).json({ error: "no slots available" });

  db.prepare(
    `INSERT INTO patients (phone_number) VALUES (?) ON CONFLICT(phone_number) DO NOTHING`
  ).run(patient_phone);

  const reference = generateReference();
  db.prepare(
    `INSERT INTO appointments (reference, patient_phone, facility_id, service_type, channel)
     VALUES (?, ?, ?, ?, 'app')`
  ).run(reference, patient_phone, facility_id, service_type);

  decrementSlot(facility_id);

  res.json({ reference, facility: facility.name });
});

// Admin: list recent appointments (used by dashboard)
router.get("/appointments", (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, f.name AS facility_name
       FROM appointments a JOIN facilities f ON a.facility_id = f.id
       ORDER BY a.created_at DESC LIMIT 100`
    )
    .all();
  res.json(rows);
});

// ---------- FEEDBACK ----------
router.get("/feedback", (req, res) => {
  const rows = db.prepare("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100").all();
  res.json(rows);
});

// ---------- STATS (for dashboard summary cards) ----------
router.get("/stats", (req, res) => {
  const facilityCount = db.prepare("SELECT COUNT(*) AS c FROM facilities").get().c;
  const appointmentCount = db.prepare("SELECT COUNT(*) AS c FROM appointments").get().c;
  const totalSlots = db.prepare("SELECT SUM(total_capacity) AS s FROM facilities").get().s || 0;
  const availableSlots = db.prepare("SELECT SUM(available_slots) AS s FROM facilities").get().s || 0;
  res.json({ facilityCount, appointmentCount, totalSlots, availableSlots });
});

module.exports = router;
