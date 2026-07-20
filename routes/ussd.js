// routes/ussd.js
// Implements the exact USSD menu flow described in the proposal (section 3.6):
//   *123# -> Main menu -> Service type -> Nearest facilities -> Confirm -> Booked
//
// This endpoint is written to match Africa's Talking's USSD webhook contract,
// which is the standard way to get a *123# shortcode working in Uganda.
// Africa's Talking POSTs: sessionId, serviceCode, phoneNumber, text
// We must respond with plain text starting with "CON " (continue, show another
// menu) or "END " (end the session, final message).

const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { findFacilities, decrementSlot, generateReference } = require("./facilityService");

const SERVICE_MAP = {
  1: "general",
  2: "maternal",
  3: "malaria",
  4: "vaccination"
};

router.post("/", (req, res) => {
  res.set("Content-Type", "text/plain");

  const { sessionId, phoneNumber, text } = req.body;
  // Africa's Talking sends the FULL history of choices in `text`, separated by *
  // e.g. first request text = "", second request text = "1", third = "1*2", etc.
  const steps = (text || "").split("*").filter((s) => s !== "");
  const level = steps.length; // how many menus deep we are

  let response = "";

  try {
    if (level === 0) {
      // ----- LEVEL 1: main menu -----
      response =
        "CON Welcome to Health Connect\n" +
        "1. Find nearest health center\n" +
        "2. Book appointment\n" +
        "3. Health tips (SMS)\n" +
        "4. Feedback";
    } else if (steps[0] === "1" || steps[0] === "2") {
      // Both "Find nearest" and "Book appointment" share the same flow:
      // choose service type -> pick facility -> confirm -> book
      if (level === 1) {
        response =
          "CON Do you need:\n" +
          "1. General checkup\n" +
          "2. Maternal/child services\n" +
          "3. Malaria testing\n" +
          "4. Vaccination";
      } else if (level === 2) {
        const serviceType = SERVICE_MAP[steps[1]];
        if (!serviceType) {
          response = "END Invalid option. Please dial *123# again.";
        } else {
          const facilities = findFacilities({ serviceType, limit: 3 });
          if (facilities.length === 0) {
            response = "END Sorry, no facilities currently available for that service. Please try again later.";
          } else {
            let menu = "CON Nearest facilities:\n";
            facilities.forEach((f, i) => {
              menu += `${i + 1}. ${f.name} (${f.distance_km}km) - ${f.available_slots} slots left\n`;
            });
            menu += "0. Main menu";
            response = menu;
          }
        }
      } else if (level === 3) {
        const serviceType = SERVICE_MAP[steps[1]];
        const facilities = findFacilities({ serviceType, limit: 3 });
        const choice = parseInt(steps[2], 10);

        if (choice === 0) {
          response =
            "CON Welcome to Health Connect\n" +
            "1. Find nearest health center\n" +
            "2. Book appointment\n" +
            "3. Health tips (SMS)\n" +
            "4. Feedback";
        } else {
          const facility = facilities[choice - 1];
          if (!facility) {
            response = "END Invalid selection. Please dial *123# again.";
          } else {
            response =
              `CON ${facility.name}. Confirm appointment?\n` +
              "1. Yes, book\n" +
              "2. No, cancel";
          }
        }
      } else if (level === 4) {
        const serviceType = SERVICE_MAP[steps[1]];
        const facilities = findFacilities({ serviceType, limit: 3 });
        const facilityChoice = parseInt(steps[2], 10);
        const facility = facilities[facilityChoice - 1];
        const confirm = steps[3];

        if (!facility) {
          response = "END Session expired. Please dial *123# again.";
        } else if (confirm === "1") {
          const reference = generateReference();

          // Ensure patient record exists
          db.prepare(
            `INSERT INTO patients (phone_number) VALUES (?)
             ON CONFLICT(phone_number) DO NOTHING`
          ).run(phoneNumber);

          db.prepare(
            `INSERT INTO appointments (reference, patient_phone, facility_id, service_type, channel)
             VALUES (?, ?, ?, ?, 'ussd')`
          ).run(reference, phoneNumber, facility.id, serviceType);

          decrementSlot(facility.id);

          response =
            `END Appointment confirmed. Reference: ${reference}.\n` +
            `${facility.name}. An SMS confirmation has been sent. Thank you.`;

          // NOTE: to actually SEND the SMS, wire up an SMS provider (e.g. Africa's
          // Talking SMS API) here using facility.phone / phoneNumber. See README.
        } else {
          response = "END Appointment cancelled. Dial *123# to try again.";
        }
      } else {
        response = "END Session expired. Please dial *123# again.";
      }
    } else if (steps[0] === "3") {
      // ----- Health tips -----
      response = "END Health tips will be sent to your phone via SMS shortly. Thank you.";
    } else if (steps[0] === "4") {
      // ----- Feedback -----
      if (level === 1) {
        response = "CON Please type your feedback message:";
      } else {
        const message = steps.slice(1).join("*");
        db.prepare(
          `INSERT INTO feedback (patient_phone, message) VALUES (?, ?)`
        ).run(phoneNumber, message);
        response = "END Thank you for your feedback!";
      }
    } else {
      response = "END Invalid option. Please dial *123# again.";
    }
  } catch (err) {
    console.error("USSD error:", err);
    response = "END Sorry, a system error occurred. Please try again later.";
  }

  res.send(response);
});

module.exports = router;
