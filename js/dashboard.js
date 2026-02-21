// ============================================================
//  dashboard.js  —  Dashboard logic, Firebase real-time listeners
// ============================================================

import { db }                          from "./firebase-config.js";
import { requireAuth, signOutUser, getUserProfile } from "./auth.js";
import { renderBarChart, renderSparkline, renderLineTrend, renderRing }
  from "./charts.js";
import {
  ref, onValue, set, push, remove, get, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── State ────────────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let allRooms       = {};   // latest snapshot from /sensors
let allUsers       = {};   // for admin user management
let currentView    = "dashboard";
let lbMode         = "dept";

// ── Boot ─────────────────────────────────────────────────────
requireAuth((user, profile) => {
  currentUser    = user;
  currentProfile = profile;
  initUI();
  startListeners();
});

// ── Init UI ──────────────────────────────────────────────────
function initUI() {
  // Clock
  setInterval(tickClock, 1000); tickClock();

  // Show/hide admin nav items
  if (currentProfile?.role === "admin") {
    document.querySelectorAll(".admin-only").forEach(el => el.style.display = "flex");
    document.getElementById("role-badge").textContent = "ADMIN";
    document.getElementById("role-badge").style.color = "var(--accent2)";
  } else {
    document.getElementById("role-badge").textContent = "STUDENT";
  }

  document.getElementById("user-name").textContent =
    currentProfile?.name || currentUser.email;

  // Sign out button
  document.getElementById("btn-signout").addEventListener("click", signOutUser);
}

// ── Clock ─────────────────────────────────────────────────────
function tickClock() {
  const n = new Date();
  const p = x => String(x).padStart(2, "0");
  const el = document.getElementById("clock");
  if (el) el.textContent = `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
}

// ── Firebase Real-time Listeners ─────────────────────────────

function startListeners() {
  // 1. Sensor data (from clamp sensors → /sensors/{roomId})
  onValue(ref(db, "sensors"), (snap) => {
    allRooms = snap.val() || {};
    updateDashboard();
    updateRoomsView();
    updateAnalytics();
    updateLeaderboard();
  });

  // 2. Alerts (written by sensors or admin → /alerts)
  onValue(ref(db, "alerts"), (snap) => {
    updateAlerts(snap.val() || {});
  });

  // 3. Monthly history (written by a server function → /history/monthly)
  onValue(ref(db, "history/monthly"), (snap) => {
    updateMonthlyTrend(snap.val() || {});
  });

  // 4. Users — admin only
  if (currentProfile?.role === "admin") {
    onValue(ref(db, "users"), (snap) => {
      allUsers = snap.val() || {};
      renderUserManagement();
    });
  }
}

// ── Compute campus-wide totals from sensor snapshot ──────────
function computeTotals(rooms) {
  let totalKw = 0, totalKwh = 0, idleCount = 0;
  const deptKwh = {}, deptKw = {};
  const yearKwh = { 1:0, 2:0, 3:0, 4:0 };

  Object.values(rooms).forEach(r => {
    const kw  = r.current_kw   || 0;
    const kwh = r.cumulative_kwh || 0;
    totalKw  += kw;
    totalKwh += kwh;
    if (r.status === "idle") idleCount++;

    const d = r.dept || "?";
    deptKwh[d] = (deptKwh[d] || 0) + kwh;
    deptKw[d]  = (deptKw[d]  || 0) + kw;

    const y = parseInt(r.year);
    if (y >= 1 && y <= 4) yearKwh[y] += kwh;
  });

  return { totalKw, totalKwh, idleCount, deptKwh, deptKw, yearKwh };
}

// ── Dashboard View ───────────────────────────────────────────
function updateDashboard() {
  const { totalKw, totalKwh, idleCount, deptKwh, deptKw } = computeTotals(allRooms);

  setText("kpi-live",  totalKw.toFixed(1));
  setText("kpi-kwh",   totalKwh.toFixed(0));
  setText("kpi-idle",  idleCount);

  // Budget ring (example: monthly budget 2,96,000 ₹, rate ₹6/kWh)
  const budget = 49334; // kWh budget for the month
  const pct    = Math.min(Math.round((totalKwh / budget) * 100), 100);
  renderRing("ring-target", pct, pct + "%", "budget used");
  setText("stat-budget-pct", pct + "%");
  setText("stat-kwh-left", (budget - totalKwh).toFixed(0) + " kWh");

  // Department list
  const deptEl = document.getElementById("dept-list");
  if (deptEl) {
    const entries = Object.entries(deptKwh).sort((a, b) => b[1] - a[1]);
    const maxKwh  = Math.max(...entries.map(e => e[1]), 1);
    const ICONS   = { CSE:"💻", ECE:"📡", MECH:"⚙️", CIVIL:"🏗️", IT:"🖥️", EEE:"⚡" };
    deptEl.innerHTML = entries.map(([d, kwh]) => {
      const pct = ((kwh / maxKwh) * 100).toFixed(0);
      const lvl = kwh > maxKwh * 0.75 ? "warn" : "green";
      return `<div class="dept-row">
        <div class="dept-icon">${ICONS[d] || "🏢"}</div>
        <div class="dept-name">${d}</div>
        <div class="dept-track">
          <div class="dept-fill" style="width:${pct}%;background:${
            lvl === "warn" ? "var(--warn)" : "var(--accent)"}"></div>
        </div>
        <div class="dept-kwh">${kwh.toFixed(1)} kWh</div>
        <span class="bdg bdg-${lvl}">${lvl === "warn" ? "HIGH" : "OK"}</span>
      </div>`;
    }).join("");
  }
}

// ── Analytics View ───────────────────────────────────────────
function updateAnalytics() {
  const { deptKwh, yearKwh } = computeTotals(allRooms);

  const depts  = Object.keys(deptKwh);
  const dVals  = depts.map(d => +(deptKwh[d] || 0).toFixed(1));
  const yLabels = ["Year 1","Year 2","Year 3","Year 4"];
  const yVals   = [yearKwh[1], yearKwh[2], yearKwh[3], yearKwh[4]];

  const COLORS = ["var(--accent2)","var(--accent3)","var(--warn)",
                  "var(--accent)","var(--accent3)","var(--accent)"];

  renderBarChart("dept-chart",  depts,   dVals, null, COLORS.slice(0, depts.length));
  renderBarChart("year-chart",  yLabels, yVals, null,
    ["var(--accent)","var(--accent3)","var(--warn)","var(--accent2)"]);
}

function updateMonthlyTrend(monthlyData) {
  // monthlyData: { "2025-08": 48200, "2025-09": 51000, ... }
  const entries = Object.entries(monthlyData).sort((a, b) => a[0] > b[0] ? 1 : -1);
  const labels  = entries.map(([k]) => {
    const [, m] = k.split("-");
    return ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m];
  });
  const values = entries.map(([, v]) => v);
  renderLineTrend("monthly-svg", labels, values);
}

// ── Classrooms View ──────────────────────────────────────────
function updateRoomsView() {
  const deptFilter = document.getElementById("rm-dept")?.value || "";
  const yearFilter = document.getElementById("rm-year")?.value || "";
  const sortMode   = document.getElementById("rm-sort")?.value || "high";

  let rooms = Object.values(allRooms);
  if (deptFilter) rooms = rooms.filter(r => r.dept === deptFilter);
  if (yearFilter) rooms = rooms.filter(r => String(r.year) === yearFilter.replace("Year ",""));

  if (sortMode === "high") rooms.sort((a, b) => b.cumulative_kwh - a.cumulative_kwh);
  else if (sortMode === "low") rooms.sort((a, b) => a.cumulative_kwh - b.cumulative_kwh);
  else rooms.sort((a, b) => (a.room_id || "").localeCompare(b.room_id || ""));

  const el = document.getElementById("room-grid");
  if (!el) return;

  setText("room-count", `${rooms.length} rooms`);

  el.innerHTML = rooms.map(r => {
    const kwh   = (r.cumulative_kwh || 0).toFixed(1);
    const kw    = (r.current_kw    || 0).toFixed(2);
    const status= r.status || "normal";
    const color = status === "idle" ? "var(--warn)"
                : (r.current_kw || 0) > 5 ? "var(--accent2)" : "var(--accent)";
    const badgeCls = status === "idle" ? "bdg-w"
                   : (r.current_kw || 0) > 5 ? "bdg-r" : "bdg-g";
    return `<div class="room-card" style="--r-color:${color}"
                 onclick="showRoomDetail('${r.room_id}')">
      <div class="room-id">${r.room_id || "—"}</div>
      <div class="room-val">${kwh}</div>
      <div class="room-unit">kWh today</div>
      <div style="font-size:.6rem;color:var(--muted);margin-bottom:6px">${kw} kW live</div>
      <span class="bdg ${badgeCls}">${status.toUpperCase()}</span>
    </div>`;
  }).join("");
}

window.showRoomDetail = function(roomId) {
  const r = allRooms[roomId]; if (!r) return;
  const history = r.history || {};
  const histVals = Object.values(history).slice(-7).map(h => h.kwh || 0);
  const sparkId  = "spark-" + roomId.replace(/[^a-z0-9]/gi, "_");
  const adminEdit = currentProfile?.role === "admin"
    ? `<button class="btn-admin" onclick="editRoom('${roomId}')">✏️ Edit Room</button>` : "";

  document.getElementById("room-detail").innerHTML = `
    <div class="card fade-in">
      <div class="card-title">📋 ${roomId}
        <span class="hint" style="cursor:pointer"
          onclick="document.getElementById('room-detail').innerHTML=''">✕ Close</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
        <div>
          <div class="stat-row"><span class="stat-key">Department</span><span class="stat-val">${r.dept||"—"}</span></div>
          <div class="stat-row"><span class="stat-key">Year</span><span class="stat-val">${r.year||"—"}</span></div>
          <div class="stat-row"><span class="stat-key">Live Draw</span><span class="stat-val" style="color:var(--accent)">${(r.current_kw||0).toFixed(2)} kW</span></div>
          <div class="stat-row"><span class="stat-key">Today kWh</span><span class="stat-val">${(r.cumulative_kwh||0).toFixed(1)}</span></div>
          <div class="stat-row"><span class="stat-key">Status</span><span class="stat-val">${r.status||"—"}</span></div>
          ${adminEdit}
        </div>
        <div>
          <div class="stat-row"><span class="stat-key">Sensor ID</span><span class="stat-val">${r.sensor_id||"—"}</span></div>
          <div class="stat-row"><span class="stat-key">Last Updated</span>
            <span class="stat-val">${r.last_updated ? new Date(r.last_updated).toLocaleTimeString() : "—"}</span></div>
          <div class="stat-row"><span class="stat-key">Voltage</span><span class="stat-val">${r.voltage||"—"} V</span></div>
          <div class="stat-row"><span class="stat-key">Current</span><span class="stat-val">${r.current_a||"—"} A</span></div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:14px">
          <div style="font-size:.6rem;color:var(--muted);margin-bottom:8px">7-DAY HISTORY</div>
          <div class="spark" id="${sparkId}"></div>
        </div>
      </div>
    </div>`;

  if (histVals.length) renderSparkline(sparkId, histVals);
};

// ── Leaderboard View ─────────────────────────────────────────
function updateLeaderboard() {
  renderLb(lbMode);
}

window.setLbTab = function(el, mode) {
  lbMode = mode;
  document.querySelectorAll("#view-leaderboard .tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  renderLb(mode);
};

function computeEcoScore(rooms) {
  // Score = 100 - (avg kWh / expected_kWh) * 50 - idlePenalty
  // Simpler approach: lower kWh relative to others = higher score
  const totals = {};
  const counts = {};
  Object.values(rooms).forEach(r => {
    const key = r[lbMode === "dept" ? "dept" : lbMode === "year" ? "year" : "room_id"] || "?";
    totals[key] = (totals[key] || 0) + (r.cumulative_kwh || 0);
    counts[key] = (counts[key] || 0) + 1;
  });
  const entries = Object.entries(totals).map(([k, v]) => ({
    name: k === String(parseInt(k)) ? `Year ${k}` : k,
    kwh:  +(v / counts[k]).toFixed(1),
    raw:  v
  }));
  const max = Math.max(...entries.map(e => e.kwh), 1);
  return entries.map(e => ({ ...e, score: Math.round((1 - e.kwh / max) * 80 + 20) }))
                .sort((a, b) => b.score - a.score);
}

function renderLb(mode) {
  lbMode = mode;
  const data = computeEcoScore(allRooms);
  const MK = ["🥇","🥈","🥉"];
  const GC = ["var(--gold)","var(--silver)","var(--bronze)"];

  const medalEl = document.getElementById("medal-row");
  if (medalEl) {
    medalEl.innerHTML = data.slice(0, 3).map((d, i) => `
      <div class="medal">
        <div class="medal-e">${MK[i]}</div>
        <div class="medal-n">${d.name}</div>
        <div class="medal-s" style="color:${GC[i]}">${d.score}</div>
      </div>`).join("");
  }

  const lbEl = document.getElementById("lb-list");
  if (lbEl) {
    lbEl.innerHTML = data.map((d, i) => `
      <div class="lb-row">
        <div class="lb-rank" style="color:${i < 3 ? GC[i] : "var(--muted)"}">${i + 1}</div>
        <div style="font-size:.9rem;min-width:22px">${i < 3 ? MK[i] : ""}</div>
        <div class="lb-name">${d.name}</div>
        <div>
          <div class="lb-score">${d.score}</div>
          <div class="lb-pts">${d.kwh} kWh avg</div>
          <div class="lb-bar"><div class="lb-bar-fill" style="width:${d.score}%"></div></div>
        </div>
      </div>`).join("");
  }

  renderBarChart("lb-chart", data.map(d => d.name), data.map(d => d.score), null,
    data.map((_, i) => i === 0 ? "var(--gold)" : i === 1 ? "var(--silver)" : i === 2 ? "var(--bronze)" : "var(--accent3)"));
}

// ── Alerts View ──────────────────────────────────────────────
function updateAlerts(alertsData) {
  const all  = Object.entries(alertsData).sort((a, b) => b[1].timestamp - a[1].timestamp);
  const mini = document.getElementById("alerts-mini");
  const full = document.getElementById("all-alerts");

  const makeAlert = ([id, a], withActions = false) => {
    const cls  = a.type === "critical" ? "a-crit" : a.type === "ok" ? "a-ok" : "a-warn";
    const icon = a.type === "critical" ? "🔴" : a.type === "ok" ? "✅" : "🟡";
    const adminBtns = withActions && currentProfile?.role === "admin"
      ? `<button class="btn-admin btn-sm" onclick="resolveAlert('${id}')">Resolve</button>` : "";
    return `<div class="alert ${cls}">
      <div class="alert-icon">${icon}</div>
      <div style="flex:1">
        <div class="alert-title">${a.title || "Alert"}</div>
        <div class="alert-body">${a.body || ""}</div>
        ${adminBtns}
      </div>
      <div style="font-size:.6rem;color:var(--muted);white-space:nowrap;align-self:center">
        ${a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : ""}
      </div>
    </div>`;
  };

  if (mini) mini.innerHTML = all.slice(0, 3).map(a => makeAlert(a)).join("");
  if (full) full.innerHTML = all.length ? all.map(a => makeAlert(a, true)).join("")
    : `<div style="color:var(--muted);font-size:.72rem;padding:12px">No active alerts.</div>`;

  // KPI counts
  setText("kpi-crit",  all.filter(([,a]) => a.type === "critical").length);
  setText("kpi-warns", all.filter(([,a]) => a.type === "warning").length);
}

// ── Admin: resolve alert ─────────────────────────────────────
window.resolveAlert = async function(alertId) {
  if (currentProfile?.role !== "admin") return;
  await remove(ref(db, `alerts/${alertId}`));
};

// ── Admin: edit room metadata ─────────────────────────────────
window.editRoom = function(roomId) {
  if (currentProfile?.role !== "admin") return;
  const r = allRooms[roomId]; if (!r) return;
  const newDept = prompt("Department (CSE/ECE/MECH/CIVIL/IT/EEE):", r.dept || "");
  const newYear = prompt("Year (1–4):", r.year || "");
  if (newDept || newYear) {
    const updates = {};
    if (newDept) updates.dept = newDept.toUpperCase();
    if (newYear) updates.year = parseInt(newYear);
    set(ref(db, `sensors/${roomId}/dept`), updates.dept || r.dept);
    set(ref(db, `sensors/${roomId}/year`), updates.year || r.year);
  }
};

// ── Admin: add alert manually ─────────────────────────────────
window.addManualAlert = async function() {
  if (currentProfile?.role !== "admin") return;
  const title = document.getElementById("alert-title-input")?.value?.trim();
  const body  = document.getElementById("alert-body-input")?.value?.trim();
  const type  = document.getElementById("alert-type-select")?.value || "warning";
  if (!title) return;
  await push(ref(db, "alerts"), { title, body, type, timestamp: Date.now(), by: currentUser.uid });
  document.getElementById("alert-title-input").value = "";
  document.getElementById("alert-body-input").value  = "";
};

// ── Admin: user management ────────────────────────────────────
function renderUserManagement() {
  const el = document.getElementById("user-table-body");
  if (!el) return;
  el.innerHTML = Object.entries(allUsers).map(([uid, u]) => `
    <tr>
      <td>${u.name || "—"}</td>
      <td>${u.email || "—"}</td>
      <td>${u.dept  || "—"}</td>
      <td>
        <span class="bdg ${u.role === "admin" ? "bdg-r" : "bdg-g"}">${u.role || "student"}</span>
      </td>
      <td>
        ${currentProfile?.role === "admin" && uid !== currentUser.uid
          ? `<button class="btn-admin btn-sm" onclick="toggleRole('${uid}','${u.role}')">
               ${u.role === "admin" ? "Demote" : "Promote"}</button>
             <button class="btn-admin btn-sm btn-danger" onclick="deleteUser('${uid}')">Remove</button>`
          : "<span style='color:var(--muted)'>You</span>"}
      </td>
    </tr>`).join("");
}

window.toggleRole = async function(uid, currentRole) {
  if (currentProfile?.role !== "admin") return;
  const newRole = currentRole === "admin" ? "student" : "admin";
  await set(ref(db, `users/${uid}/role`), newRole);
};

window.deleteUser = async function(uid) {
  if (currentProfile?.role !== "admin") return;
  if (!confirm("Remove this user's profile? (Firebase Auth account stays — delete that separately in Console)")) return;
  await remove(ref(db, `users/${uid}`));
};

// ── Nav ──────────────────────────────────────────────────────
window.showView = function(id, el) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("view-" + id)?.classList.add("active");
  if (el) el.classList.add("active");
  currentView = id;
  if (id === "analytics")  { updateAnalytics(); setTimeout(() => renderLineTrend("monthly-svg", [], []), 100); }
  if (id === "classrooms") updateRoomsView();
  if (id === "leaderboard") renderLb(lbMode);
};

// ── Filters (rooms) ──────────────────────────────────────────
window.onRoomFilterChange = updateRoomsView;

// ── Year pills (analytics) ───────────────────────────────────
window.setYear = function(el) {
  document.querySelectorAll(".year-pill").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  updateAnalytics();
};

// ── Util ─────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

window.addEventListener("resize", () => {
  const monthlyEl = document.getElementById("monthly-svg");
  if (monthlyEl && monthlyEl.children.length) {
    onValue(ref(db, "history/monthly"), snap => updateMonthlyTrend(snap.val() || {}), { onlyOnce: true });
  }
});
