// db/seed.js
// Run with: npm run seed
// Populates a few sample facilities so you can test the USSD flow and dashboard
// immediately without manually typing data in. Matches the example facilities
// used in the proposal's USSD Menu Flow (Bushenyi HC II, Kabwohe Clinic, etc).

const db = require("./database");

const facilities = [
  {
    name: "Bushenyi HC II",
    level: "HC II",
    district: "Bushenyi",
    latitude: -0.5906,
    longitude: 30.1963,
    services: "general,maternal,malaria,vaccination",
    total_capacity: 20,
    available_slots: 8,
    phone: "0700000001"
  },
  {
    name: "Kabwohe Clinic",
    level: "HC III",
    district: "Bushenyi",
    latitude: -0.6132,
    longitude: 30.1105,
    services: "general,maternal,malaria",
    total_capacity: 15,
    available_slots: 3,
    phone: "0700000002"
  },
  {
    name: "Bumbaire HC III",
    level: "HC III",
    district: "Bushenyi",
    latitude: -0.5721,
    longitude: 30.2287,
    services: "general,maternal,malaria,vaccination",
    total_capacity: 30,
    available_slots: 12,
    phone: "0700000003"
  },
  {
    name: "Wakiso HC IV",
    level: "HC IV",
    district: "Wakiso",
    latitude: 0.4044,
    longitude: 32.4594,
    services: "general,maternal,malaria,vaccination",
    total_capacity: 40,
    available_slots: 25,
    phone: "0700000004"
  }
];

const insert = db.prepare(`
  INSERT INTO facilities (name, level, district, latitude, longitude, services, total_capacity, available_slots, phone)
  VALUES (@name, @level, @district, @latitude, @longitude, @services, @total_capacity, @available_slots, @phone)
`);

const existing = db.prepare("SELECT COUNT(*) AS c FROM facilities").get();
if (existing.c === 0) {
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(facilities);
  console.log(`Seeded ${facilities.length} facilities.`);
} else {
  console.log("Facilities already exist, skipping seed. Delete db/health_connect.db to reseed.");
}
