// db/database.js
// Central database connection + schema definition for Health Connect.
// Uses SQLite (via better-sqlite3) so the whole system runs with ZERO external
// database server needed. This matches the "offline-first / low resource"
// architecture described in the proposal (Chapter 2.5). If you later want
// PostgreSQL for a production cloud deployment, only this file needs to change.

const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "health_connect.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

// ---------- SCHEMA ----------
db.exec(`
CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level TEXT NOT NULL,             -- e.g. HC II, HC III
  district TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  services TEXT NOT NULL,          -- comma separated: general,maternal,malaria,vaccination
  total_capacity INTEGER NOT NULL DEFAULT 20,
  available_slots INTEGER NOT NULL DEFAULT 20,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT,
  language TEXT DEFAULT 'en',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE NOT NULL,
  patient_phone TEXT NOT NULL,
  facility_id INTEGER NOT NULL,
  service_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',  -- booked, cancelled, completed
  channel TEXT NOT NULL DEFAULT 'ussd',   -- ussd or app
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (facility_id) REFERENCES facilities(id)
);

CREATE TABLE IF NOT EXISTS ussd_sessions (
  session_id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'MAIN',
  data TEXT DEFAULT '{}',           -- JSON blob holding selections made so far
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

module.exports = db;
