// routes/facilityService.js
// Implements the "intelligent routing" logic mentioned in the proposal:
// ranks facilities by proximity + service availability + real-time capacity.

const db = require("../db/database");

// Haversine distance in km between two lat/lng points
function distanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 999;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find the best facilities for a given service type, ranked by a score that
 * blends distance and available capacity (closer + more slots = better).
 * If the patient's location isn't known (plain USSD has no GPS), we fall back
 * to ranking by district/available slots only.
 */
function findFacilities({ serviceType, patientLat, patientLon, district, limit = 3 }) {
  const rows = db
    .prepare(
      `SELECT * FROM facilities WHERE services LIKE @svc AND available_slots > 0`
    )
    .all({ svc: `%${serviceType}%` });

  const ranked = rows
    .map((f) => {
      const dist =
        patientLat != null && patientLon != null
          ? distanceKm(patientLat, patientLon, f.latitude, f.longitude)
          : district && f.district === district
          ? 1 // assume close if same district and no GPS
          : 10;
      // Lower score = better. Distance matters most, slots break ties.
      const score = dist - f.available_slots * 0.05;
      return { ...f, distance_km: Math.round(dist * 10) / 10, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);

  return ranked;
}

function decrementSlot(facilityId) {
  db.prepare(
    `UPDATE facilities SET available_slots = available_slots - 1
     WHERE id = ? AND available_slots > 0`
  ).run(facilityId);
}

function generateReference() {
  return "HCON" + Math.floor(100 + Math.random() * 900) + Date.now().toString().slice(-3);
}

module.exports = { findFacilities, decrementSlot, generateReference, distanceKm };
