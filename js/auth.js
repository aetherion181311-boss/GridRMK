// ============================================================
//  auth.js  —  Authentication & role management
// ============================================================

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  ref, set, get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── Helpers ─────────────────────────────────────────────────

export function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 5000);
}

export function showSuccess(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  el.style.color = "var(--accent)";
}

// ── Get role for a UID from /users/{uid}/role ────────────────
export async function getUserRole(uid) {
  const snap = await get(ref(db, `users/${uid}/role`));
  return snap.exists() ? snap.val() : null;
}

// ── Get full user profile ────────────────────────────────────
export async function getUserProfile(uid) {
  const snap = await get(ref(db, `users/${uid}`));
  return snap.exists() ? snap.val() : null;
}

// ── Sign Up ──────────────────────────────────────────────────
//   role is always "student" on self-registration.
//   Admins are promoted manually in Firebase Console or by another admin.
export async function signUpUser({ name, email, password, dept, year }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid  = cred.user.uid;

  // Write profile to Realtime DB
  await set(ref(db, `users/${uid}`), {
    uid,
    name,
    email,
    dept:  dept  || "",
    year:  year  || "",
    role:  "student",       // default role — admin promotes manually
    createdAt: Date.now()
  });

  return cred.user;
}

// ── Sign In ──────────────────────────────────────────────────
export async function signInUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Sign Out ─────────────────────────────────────────────────
export async function signOutUser() {
  await signOut(auth);
  window.location.href = "index.html";
}

// ── Route guard — call on every protected page ───────────────
//   Redirects to login if not authenticated.
//   Calls callback(user, profile) once verified.
export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    const profile = await getUserProfile(user.uid);
    callback(user, profile);
  });
}

// ── Admin guard — redirects students away from admin-only pages
export function requireAdmin(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    const profile = await getUserProfile(user.uid);
    if (!profile || profile.role !== "admin") {
      window.location.href = "dashboard.html";
      return;
    }
    callback(user, profile);
  });
}
