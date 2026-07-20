# Health Connect — Working Prototype

This is a runnable prototype of the platform described in your proposal:

- **USSD flow** (`routes/ussd.js`) — implements the exact `*123#` menu from section 3.6
  (find nearest facility, book appointment, health tips, feedback).
- **REST API** (`routes/api.js`) — the same backend a future **mobile app** would call
  (list facilities, book appointments, update capacity).
- **Admin web dashboard** (`public/index.html`) — what a health worker/facility
  in-charge uses to update available slots and see bookings, matching the "Daily:
  08:00 health worker updates capacity" protocol in section 3.7.2.
- **Database** (`db/database.js`) — SQLite, offline-first friendly, matching the
  architecture in section 2.5. One file (`health_connect.db`), zero server setup.

Everything already works together — it's one Node.js app. You do not need to
"combine" separate pieces; you just need to (1) run it, and (2) connect a real
phone number/shortcode to it. Steps below.

---

## 1. Run it locally

Requirements: [Node.js](https://nodejs.org) v18+ installed on your computer.

```bash
cd health-connect
npm install        # installs Express, SQLite driver, etc.
npm run seed       # loads 4 sample facilities so you have data to test with
npm start          # starts the server
```

You'll see:
```
Health Connect server running on port 3000
- Dashboard:  http://localhost:3000/
- USSD hook:  http://localhost:3000/ussd
- API base:   http://localhost:3000/api
```

Open **http://localhost:3000** in your browser — that's your admin dashboard,
already showing the 4 seeded facilities.

### Test the USSD flow without a phone

USSD needs a telecom gateway to actually dial *123#, but you can simulate the
exact same requests a phone would send, using curl (or Postman):

```bash
# Step 1: dial *123#
curl -X POST http://localhost:3000/ussd -d "sessionId=s1&phoneNumber=0771234567&text="

# Step 2: choose "1" (Find nearest health center)
curl -X POST http://localhost:3000/ussd -d "sessionId=s1&phoneNumber=0771234567&text=1"

# Step 3: choose "2" (Maternal/child services)
curl -X POST http://localhost:3000/ussd -d "sessionId=s1&phoneNumber=0771234567&text=1*2"

# Step 4: choose facility "1"
curl -X POST http://localhost:3000/ussd -d "sessionId=s1&phoneNumber=0771234567&text=1*2*1"

# Step 5: confirm booking
curl -X POST http://localhost:3000/ussd -d "sessionId=s1&phoneNumber=0771234567&text=1*2*1*1"
```

Each response mirrors the exact menu text in your proposal's section 3.6, and
the final step creates a real row in the `appointments` table and decreases
the facility's `available_slots` — refresh the dashboard to see it update.

---

## 2. Connect a real USSD short code (so people can actually dial it)

Uganda's telecoms don't let individual developers register a shortcode
directly — you go through a **USSD aggregator**. The proposal itself cites
Africa's Talking (reference #12), which is the standard, most beginner-friendly
option and has a free sandbox for testing.

**Steps:**

1. Create a free account at **https://africastalking.com**.
2. In the sandbox, go to **USSD → Create Channel** and register a test
   shortcode (sandbox gives you something like `*384*1234#` for testing;
   getting a live `*123#`-style code for Uganda requires a paid production
   account and a short application process with the aggregator, since real
   shortcodes are a shared national resource).
3. Set the **Callback URL** to your deployed server's `/ussd` endpoint
   (see deployment step 3 below), e.g.:
   `https://health-connect.onrender.com/ussd`
4. Use the **Africa's Talking USSD simulator** (in their dashboard) to dial
   your sandbox code and walk through the exact same menu you tested with curl.
5. This code already sends responses in the exact `CON ...` / `END ...` format
   Africa's Talking (and virtually every other USSD aggregator) requires, so
   no changes are needed — just point the callback URL at your server.

---

## 3. Deploy so it's reachable from the internet (not just your laptop)

USSD aggregators need a public HTTPS URL to send requests to — `localhost`
won't work. Two good free/cheap options:

### Option A — Render.com (recommended, free tier, simplest)

1. Push this folder to a GitHub repository.
2. Go to **https://render.com** → New → Web Service → connect your GitHub repo.
3. Settings:
   - Build command: `npm install`
   - Start command: `npm start`
4. Deploy. Render gives you a URL like `https://health-connect.onrender.com`.
5. Run the seed once via Render's **Shell** tab: `npm run seed`.
6. Use that URL + `/ussd` as your Africa's Talking callback, and the base URL
   itself as your dashboard link.

> Note: SQLite files on Render's free tier reset on redeploy (ephemeral disk).
> For a real pilot deployment, either upgrade to a paid instance with a
> persistent disk, or swap SQLite for a hosted Postgres database (Render has a
> free Postgres tier) — ask me and I can convert the schema for you.

### Option B — Railway.app (also simple, similar flow)

1. https://railway.app → New Project → Deploy from GitHub repo.
2. Railway auto-detects `npm start`. Add a **Volume** mounted at `/app/db` so
   your SQLite file persists across deploys.
3. Same callback URL setup as above once deployed.

### Quick local testing without deploying yet (ngrok)

While developing, you can expose your laptop temporarily:
```bash
npm install -g ngrok      # or download from ngrok.com
ngrok http 3000
```
This gives a temporary public URL (`https://xxxx.ngrok-free.app`) — use
`https://xxxx.ngrok-free.app/ussd` as the Africa's Talking callback for live
testing before you deploy permanently.

---

## 4. Sending real SMS confirmations

Right now, the USSD flow's final message says "An SMS confirmation has been
sent" but doesn't actually send one — that needs the Africa's Talking **SMS
API** (separate from USSD, same account). To wire it up:

1. In Africa's Talking dashboard, note your **API key** and **username**.
2. Install their SDK: `npm install africastalking`
3. In `routes/ussd.js`, where the comment says
   `// NOTE: to actually SEND the SMS...`, add:
   ```js
   const AfricasTalking = require("africastalking")({
     apiKey: process.env.AT_API_KEY,
     username: process.env.AT_USERNAME
   });
   const sms = AfricasTalking.SMS;
   await sms.send({
     to: [phoneNumber],
     message: `Your appointment at ${facility.name} is confirmed. Ref: ${reference}`
   });
   ```
4. Add `AT_API_KEY` and `AT_USERNAME` to a `.env` file (copy `.env.example`).

---

## 5. Where the mobile app and web dashboard fit in

- The **admin dashboard** (`public/index.html`) is already live at your
  server's root URL — no separate hosting needed, it's served by the same
  Express app.
- A **mobile app** (per your objective 2: "a simple mobile application") would
  be a separate project (e.g. built in Flutter or React Native) that calls the
  same `/api/facilities`, `/api/facilities/nearest`, and `/api/appointments`
  endpoints already built here. I can scaffold that next if you'd like —
  just say the word and tell me if you want Flutter, React Native, or a
  simple installable web-app (PWA) version instead, since that's the fastest
  to build and test on a real phone without app-store publishing.

---

## 6. Securing this before a real pilot

This prototype has **no authentication** on the admin API, which is fine for
local testing but not for a real pilot with real patient data. Before your
pilot (section 3.7), add:
- A login step for the dashboard and `/api/facilities/:id/capacity` (e.g. a
  simple username/password per facility, or JWT-based auth).
- HTTPS only (Render/Railway give you this automatically).
- Field-level encryption or access restrictions on `patients.phone_number`,
  consistent with Uganda's Data Protection and Privacy Act referenced in your
  literature review (section 2.4).

---

## Project structure

```
health-connect/
├── server.js              # Express app entry point
├── db/
│   ├── database.js        # SQLite schema (facilities, patients, appointments, feedback)
│   └── seed.js            # loads sample facility data
├── routes/
│   ├── ussd.js             # USSD menu flow (Africa's Talking compatible)
│   ├── api.js              # REST API for dashboard + future mobile app
│   └── facilityService.js  # distance calculation + intelligent facility ranking
├── public/
│   └── index.html          # admin dashboard (facility capacity, appointments, feedback)
├── package.json
└── .env.example
```
