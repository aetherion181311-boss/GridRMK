// ============================================================
//  charts.js  —  Reusable chart rendering utilities
// ============================================================

// ── Bar chart (supports two series for comparison) ───────────
// containerId : id of the .chart-area div
// labels      : string[]
// values      : number[]   (primary — today / this week)
// values2     : number[]   (optional — yesterday / last week)
// colors      : string[]   (optional per-bar color override)
export function renderBarChart(containerId, labels, values, values2 = null, colors = null) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const max = Math.max(...values, ...(values2 || [0])) * 1.15 || 1;
  el.innerHTML = "";

  labels.forEach((lbl, i) => {
    const col = document.createElement("div");
    col.className = "bar-col";

    const track = document.createElement("div");
    track.className = "bar-track";

    // Secondary bar (lighter, background)
    if (values2 && values2[i] != null) {
      const b2 = document.createElement("div");
      b2.className = "bar bar-secondary";
      b2.style.height = ((values2[i] / max) * 100).toFixed(1) + "%";
      b2.title = `Prev: ${values2[i]}`;
      track.appendChild(b2);
    }

    // Primary bar
    const b = document.createElement("div");
    b.className = "bar bar-primary";
    b.style.background = colors ? colors[i] : "var(--accent)";
    b.style.height = ((values[i] / max) * 100).toFixed(1) + "%";
    b.title = `${lbl}: ${values[i]}`;
    track.appendChild(b);

    const l = document.createElement("div");
    l.className = "bar-lbl";
    l.textContent = lbl;

    col.appendChild(track);
    col.appendChild(l);
    el.appendChild(col);
  });
}

// ── Sparkline (mini 7-bar trend) ─────────────────────────────
// containerId : id of .spark div
// values      : number[] (7 values, last is highlighted)
export function renderSparkline(containerId, values) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const max = Math.max(...values) || 1;
  el.innerHTML = values
    .map((v, i) =>
      `<div class="spark-bar ${i === values.length - 1 ? "hi" : ""}"
            style="height:${((v / max) * 100).toFixed(0)}%"></div>`
    )
    .join("");
}

// ── SVG line chart (monthly trend) ───────────────────────────
// wrapperId : id of the container div (not svg)
// labels    : string[]
// values    : number[]
export function renderLineTrend(wrapperId, labels, values) {
  const wrap = document.getElementById(wrapperId);
  if (!wrap) return;

  const W = wrap.clientWidth || 680;
  const H = 80;
  const max = Math.max(...values) * 1.12 || 1;
  const n = values.length;

  const xs = values.map((_, i) => 20 + i * ((W - 40) / (n - 1)));
  const ys = values.map(v => H - (v / max) * (H - 10) - 4);
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const area =
    `M${xs[0]},${H} ` +
    xs.map((x, i) => `L${x},${ys[i]}`).join(" ") +
    ` L${xs[n - 1]},${H} Z`;

  wrap.innerHTML = `
    <svg width="100%" height="${H + 28}" viewBox="0 0 ${W} ${H + 28}">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="var(--accent)" stop-opacity=".25"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#lineGrad)"/>
      <polyline points="${pts}" fill="none" stroke="var(--accent)"
        stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${xs.map((x, i) => `
        <circle cx="${x}" cy="${ys[i]}" r="4"
          fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/>
        <text x="${x}" y="${H + 20}" text-anchor="middle"
          fill="var(--muted)" font-size="10"
          font-family="JetBrains Mono,monospace">${labels[i]}</text>
      `).join("")}
    </svg>`;
}

// ── Donut / Ring chart ────────────────────────────────────────
// containerId : id of .ring-outer div
// pct         : 0–100
// label       : string shown inside ring
// sublabel    : string shown below percentage
export function renderRing(containerId, pct, label, sublabel) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const r = 54, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  el.innerHTML = `
    <svg width="130" height="130" viewBox="0 0 130 130"
         style="transform:rotate(-90deg)">
      <circle cx="65" cy="65" r="${r}" fill="none"
        stroke="var(--border)" stroke-width="10"/>
      <circle cx="65" cy="65" r="${r}" fill="none"
        stroke="var(--accent)" stroke-width="10"
        stroke-dasharray="${circ.toFixed(1)}"
        stroke-dashoffset="${offset.toFixed(1)}"
        stroke-linecap="round"
        style="transition:stroke-dashoffset 1.2s ease"/>
    </svg>
    <div class="ring-label">
      <div class="ring-pct" style="color:var(--accent)">${label}</div>
      <div class="ring-sub">${sublabel}</div>
    </div>`;
}
