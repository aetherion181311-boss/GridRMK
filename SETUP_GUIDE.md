# 🚀 SETUP GUIDE — Smart Campus Energy Monitor

Follow these steps in order. It takes about 20–30 minutes total.

---

## STEP 1 — Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Name it: `campus-energy-monitor` (or anything you like)
4. Disable Google Analytics (not needed) → **Create project**
5. Wait for it to finish, then click **Continue**

---

## STEP 2 — Enable Authentication

1. In the Firebase Console sidebar → **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, click **Email/Password**
4. Toggle **Enable** → **Save**

---

## STEP 3 — Create the Realtime Database

1. Sidebar → **Build → Realtime Database**
2. Click **"Create Database"**
3. Choose your server location (e.g. `asia-south1` for India)
4. Select **"Start in test mode"** for now (you'll apply real rules in Step 6)
5. Click **Enable**

---

## STEP 4 — Get Your Firebase Config

1. Sidebar → **Project Overview** (the gear ⚙️ icon) → **Project settings**
2. Scroll down to **"Your apps"** → click the **</>** (Web) icon
3. Register app name: `campus-energy-web` → **Register app**
4. Copy the `firebaseConfig` object shown — it looks like:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "campus-energy-monitor.firebaseapp.com",
  databaseURL:       "https://campus-energy-monitor-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "campus-energy-monitor",
  storageBucket:     "campus-energy-monitor.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

5. Open `js/firebase-config.js` in your project folder
6. Replace the placeholder values with your actual values
7. **Save the file**

> ℹ️ These values are safe to include in client-side code.
> Real security comes from the Firebase Security Rules (Step 6).

---

## STEP 5 — Set Up Your Database Structure

In the Firebase Console → **Realtime Database**, click the **"+" icon** to add data manually for testing, or use this JSON import:

1. Click the **⋮ (three dots)** menu → **Import JSON**
2. Paste this sample data and import:

```json
{
  "sensors": {
    "CSE-Y1R1": {
      "room_id": "CSE-Y1R1",
      "dept": "CSE",
      "year": 1,
      "sensor_id": "SENSOR_001",
      "current_kw": 3.24,
      "current_a": 14.7,
      "voltage": 220,
      "cumulative_kwh": 18.5,
      "status": "active",
      "last_updated": 1708345200000
    },
    "ECE-Y2R1": {
      "room_id": "ECE-Y2R1",
      "dept": "ECE",
      "year": 2,
      "sensor_id": "SENSOR_002",
      "current_kw": 2.10,
      "current_a": 9.5,
      "voltage": 220,
      "cumulative_kwh": 12.3,
      "status": "active",
      "last_updated": 1708345200000
    }
  },
  "alerts": {
    "alert001": {
      "title": "CSE Lab 3 — Idle Wastage",
      "body": "AC + projector running. No occupancy detected for 45 min.",
      "type": "warning",
      "timestamp": 1708345200000
    }
  },
  "history": {
    "monthly": {
      "2025-08": 48200,
      "2025-09": 51000,
      "2025-10": 49500,
      "2025-11": 52100,
      "2025-12": 47800,
      "2026-01": 50300,
      "2026-02": 35000
    }
  }
}
```

---

## STEP 6 — Apply Security Rules

1. In Firebase Console → **Realtime Database → Rules tab**
2. Delete everything in the editor
3. Copy the entire contents of `database.rules.json` from your project folder
4. Paste it in → **Publish**

These rules ensure:
- ✅ Any logged-in user can **read** sensor data, alerts, history
- 🔒 Only **admins** can write/modify sensor data, alerts, history
- 🔒 Students cannot change their own **role** field
- 🔒 Users can only read their own profile (admins can read all)

---

## STEP 7 — Make the First Admin

When you sign up through the app, your role defaults to `"student"`.
To make yourself or someone an admin:

1. Firebase Console → **Realtime Database**
2. Navigate to: `users → {your-uid} → role`
3. Click the pencil ✏️ to edit → change value to `"admin"` → **Confirm**

That user now has full admin access in the dashboard.

---

## STEP 8 — Connect Your Clamp Sensors

Your ESP32 / Arduino sends data to Firebase using its REST API or the Firebase Arduino library.

### Option A — REST API (simplest, works with any microcontroller)

```cpp
// ESP32 example — send sensor data via HTTP PATCH
#include <WiFi.h>
#include <HTTPClient.h>

const String FIREBASE_URL = "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com";
const String AUTH_TOKEN   = "YOUR_DATABASE_SECRET"; // Firebase Console → Project Settings → Service Accounts → Database secrets

void sendSensorData(float current_kw, float current_a, float cumulative_kwh) {
  HTTPClient http;
  String url = FIREBASE_URL + "/sensors/CSE-Y1R1.json?auth=" + AUTH_TOKEN;

  String payload = "{";
  payload += "\"current_kw\":"     + String(current_kw, 2)  + ",";
  payload += "\"current_a\":"      + String(current_a, 1)   + ",";
  payload += "\"cumulative_kwh\":" + String(cumulative_kwh, 1) + ",";
  payload += "\"voltage\":220,";
  payload += "\"status\":\"active\",";
  payload += "\"last_updated\":"   + String(millis());
  payload += "}";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int code = http.PATCH(payload);
  http.end();
}
```

### Option B — Firebase Arduino Library

Install: `Arduino IDE → Library Manager → "Firebase ESP32 Client"` by Mobizt

```cpp
#include <Firebase_ESP_Client.h>

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

config.database_url = "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com";
config.signer.tokens.legacy_token = "YOUR_DATABASE_SECRET";
Firebase.begin(&config, &auth);

// In loop():
Firebase.RTDB.setFloat(&fbdo, "/sensors/CSE-Y1R1/current_kw", computed_kw);
Firebase.RTDB.setFloat(&fbdo, "/sensors/CSE-Y1R1/cumulative_kwh", total_kwh);
Firebase.RTDB.setString(&fbdo, "/sensors/CSE-Y1R1/status", "active");
Firebase.RTDB.setInt(&fbdo, "/sensors/CSE-Y1R1/last_updated", millis());
```

### Computing kW from clamp sensor reading:

```cpp
// SCT-013 clamp sensor connected to ESP32 ADC pin
float readCurrentKW(int adcPin, float voltageSupply = 220.0) {
  float sum = 0;
  for (int i = 0; i < 1000; i++) {
    float v = analogRead(adcPin) * (3.3 / 4095.0);  // ESP32 ADC
    sum += v * v;
  }
  float rmsVoltage = sqrt(sum / 1000);
  float current_a  = (rmsVoltage / 0.04);            // adjust for your burden resistor
  float current_kw = (current_a * voltageSupply) / 1000.0;
  return current_kw;
}
```

---

## STEP 9 — Deploy to Firebase Hosting

### Install Firebase CLI (one time)

```bash
# Make sure Node.js is installed: https://nodejs.org
npm install -g firebase-tools
```

### Login and deploy

```bash
# From inside your project folder (campus-energy/)
firebase login

firebase init
# Select: Hosting + Database (use arrow keys + space)
# Public directory: .    (just a dot)
# Single-page app: Yes
# Overwrite index.html: No

firebase deploy
```

Your app will be live at:
`https://YOUR_PROJECT_ID.web.app`

### Future updates — just run:
```bash
firebase deploy
```

---

## STEP 10 — Verify Everything Works

| Test | Expected result |
|------|----------------|
| Visit `your-project.web.app` | Login page loads |
| Sign up with any email | Redirected to dashboard |
| Dashboard opens | Shows "Waiting for sensor data…" until DB has data |
| Import sample JSON (Step 5) | Charts and dept breakdown populate |
| Try changing your role in the app | Not possible (rules block it) |
| Admin (set in Console) | Sees Admin Panel nav item, can manage users |

---

## 🔒 Security Summary

| What | How it's protected |
|------|--------------------|
| Login required | `requireAuth()` redirects unauthenticated users |
| Role enforcement | Checked against `/users/{uid}/role` in DB on every page |
| Students can't elevate role | Database rule: only admins can write `role` field |
| Sensor data | Read: any logged-in user · Write: admin only |
| Firebase config in JS | Safe — access controlled by Security Rules, not secrecy |

---

## File Structure

```
campus-energy/
├── index.html          ← Login page
├── signup.html         ← Sign up page
├── dashboard.html      ← Main app
├── css/
│   ├── auth.css        ← Login/signup styles
│   └── dashboard.css   ← Dashboard styles
├── js/
│   ├── firebase-config.js  ← ⚠️ Fill in your credentials here
│   ├── auth.js             ← Login, signup, role checking
│   ├── charts.js           ← Reusable chart renderers
│   └── dashboard.js        ← Main logic + Firebase listeners
├── database.rules.json ← Firebase Security Rules
├── firebase.json       ← Hosting config
└── SETUP_GUIDE.md      ← This file
```
