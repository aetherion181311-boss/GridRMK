// ============================================================
//  firebase-config.js
//  Replace ALL placeholder values below with your actual
//  Firebase project credentials (see SETUP_GUIDE.md Step 3)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ⚠️  REPLACE these values with your Firebase project config
//     Firebase Console → Project Settings → Your Apps → Config
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// NOTE: It is safe to expose these keys in client-side code.
// Real security is enforced by Firebase Security Rules (see database.rules.json).

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getDatabase(app);
