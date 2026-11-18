// Lightweight hand-rolled SVG charts (no dependencies).
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export { MONTHS };

const tip = () => document.getElementById("tooltip");
export function showTip(html, x, y) {
  const t = tip(); t.innerHTML = html; t.classList.remove("hidden");
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + "px";
  t.style.top = Math.max(8, y - h - 10) + "px";
}
export function hideTip() { tip().classList.add("hidden"); }

/** Weekly-sampled cumulative series -> [{day, v}] (last point may be off the 7-day grid). */
export function toDays(points, totalDays) {
  if (!points) return [];
  return points.map((v, i) => ({ day: i === points.length - 1 ? totalDays - 1 : i * 7, v }));
}
export function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
export function addDays(iso, n) { const d = new Date(iso); d.setUTCDate(d.getUTCDate() + n); return d; }
const fmtDate = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;

function niceMax(v) {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
const path = (pts, x, y) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.v).toFixed(1)}`).join("");

function monthTicks(seasonStart, totalDays, x) {
  let out = "", prev = -1;
  for (let d = 0; d < totalDays; d++) {
    const dt = addDays(seasonStart, d);
    if (dt.getUTCDate() === 1 && dt.getUTCMonth() !== prev) {
      prev = dt.getUTCMonth();
      out += `<line class="grid" x1="${x(d)}" x2="${x(d)}" y1="0" y2="100%" stroke-dasharray="2 3"/>`;
      out += `<text x="${x(d) + 3}" y="__H__">${MONTHS[prev]}</text>`;
    }
  }
  return out;
}

/** Detail-panel chart: this season vs normal (mean) and range of past seasons. */
export function seasonChart(container, s, color = "#2a78d6") {
  if (!s || !s.normalCurve) { container.innerHTML = `<p class="note">Normal not available yet: past seasons are still being fetched.</p>`; return; }
  const W = 360, H = 170, m = { l: 34, r: 8, t: 8, b: 20 };
  const total = daysBetween(s.seasonStart, s.seasonEnd) + 1;
  const cur = toDays(s.curve, s.dayOfSeason), nor = toDays(s.normalCurve, total), lo = toDays(s.minCurve, total), hi = toDays(s.maxCurve, total);
  const yMax = niceMax(Math.max(...hi.map(p => p.v), ...cur.map(p => p.v)));
  const x = (d) => m.l + (d / (total - 1)) * (W - m.l - m.r);
  const y = (v) => H - m.b - (v / yMax) * (H - m.t - m.b);
  const band = path(hi, x, y) + lo.slice().reverse().map(p => `L${x(p.day).toFixed(1)},${y(p.v).toFixed(1)}`).join("") + "Z";
  const yt = [0, yMax / 2, yMax].map(v => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 4}" y="${y(v) + 3}" text-anchor="end">${Math.round(v)}</text>`).join("");
  const last = cur[cur.length - 1];
  container.innerHTML = `
    <div class="chart-legend">
      <span><i style="background:${color}"></i>This season</span>
      <span><i style="background:#8a8984"></i>Normal</span>
      <span><i style="background:#e3e2de;height:8px"></i>Range, past ${s.nSeasons} seasons</span>
    </div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative snowfall this season versus normal">
      ${yt}
      ${monthTicks(s.seasonStart, total, x).replaceAll("__H__", H - 6)}
      <path d="${band}" fill="#e3e2de" opacity=".7"/>
      <path d="${path(nor, x, y)}" fill="none" stroke="#8a8984" stroke-width="1.5" stroke-dasharray="4 3"/>
      ${cur.length ? `<path d="${path(cur, x, y)}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${x(last.day)}" cy="${y(last.v)}" r="4" fill="${color}" stroke="#fcfcfb" stroke-width="2"/>` : ""}
      <line class="xh" y1="${m.t}" y2="${H - m.b}" stroke="#52514e" stroke-width="1" visibility="hidden"/>
      <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" class="hit"/>
      <text x="${m.l}" y="${m.t + 2}" dy="-2" style="fill:#8a8984">cm</text>
    </svg>`;
  const svg = container.querySelector("svg"), xh = svg.querySelector(".xh");
  svg.querySelector(".hit").addEventListener("mousemove", (ev) => {
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * (W / r.width);
    const day = Math.max(0, Math.min(total - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (total - 1))));
    const near = (arr) => arr.reduce((a, b) => Math.abs(b.day - day) < Math.abs(a.day - day) ? b : a, arr[0]);
    const n = near(nor), c = cur.length && day <= last.day + 3 ? near(cur) : null;
    xh.setAttribute("x1", x(n.day)); xh.setAttribute("x2", x(n.day)); xh.setAttribute("visibility", "visible");
    showTip(`<b>${fmtDate(addDays(s.seasonStart, n.day))}</b><br>${c ? `This season: ${Math.round(c.v)} cm<br>` : ""}Normal: ${Math.round(n.v)} cm<br>Range: ${Math.round(near(lo).v)}–${Math.round(near(hi).v)} cm`, ev.clientX, ev.clientY);
  });
  svg.querySelector(".hit").addEventListener("mouseleave", () => { xh.setAttribute("visibility", "hidden"); hideTip(); });
}

/** Monthly climate bars (avg modelled snowfall per month) in season order. */
export function monthBars(container, climate, opts = {}) {
  if (!climate) { container.innerHTML = ""; return; }
  const keys = Object.keys(climate).map(Number);
  // order months in season order (wrap around year)
  const order = keys.sort((a, b) => a - b);
  const gapIdx = order.findIndex((m, i) => i > 0 && m - order[i - 1] > 1);
  const months = gapIdx > 0 ? [...order.slice(gapIdx), ...order.slice(0, gapIdx)] : order;
  const W = opts.width || 360, H = opts.height || 110, m = { l: 4, r: 4, t: 14, b: 30 };
  const yMax = opts.yMax || niceMax(Math.max(...months.map(k => climate[k].snow)));
  const bw = (W - m.l - m.r) / months.length;
  const bars = months.map((k, i) => {
    const c = climate[k], h = (c.snow / yMax) * (H - m.t - m.b), x0 = m.l + i * bw + 2;
    const sel = (opts.months || []).includes(k), best = (opts.best || []).includes(k);
    const fill = opts.color || (best ? "#2a78d6" : "#86b6ef");
    const yb = H - m.b;
    // rounded data-end, flat baseline
    const r = Math.min(4, h, (bw - 4) / 2);
    const d = h > 0 ? `M${x0},${yb}V${yb - h + r}Q${x0},${yb - h} ${x0 + r},${yb - h}H${x0 + bw - 4 - r}Q${x0 + bw - 4},${yb - h} ${x0 + bw - 4},${yb - h + r}V${yb}Z` : "";
    return `<g data-m="${k}">
      ${sel ? `<rect x="${x0 - 2}" y="${m.t - 12}" width="${bw}" height="${H - m.t - m.b + 12}" fill="#f0efec" rx="4"/>` : ""}
      <path d="${d}" fill="${fill}"/>
      ${opts.compact ? "" : `<text x="${x0 + (bw - 4) / 2}" y="${yb - h - 3}" text-anchor="middle">${c.snow}</text>`}
      <text x="${x0 + (bw - 4) / 2}" y="${H - m.b + 12}" text-anchor="middle" style="fill:${sel ? "#0b0b0b" : ""}">${MONTHS[k - 1][0]}${opts.compact ? "" : MONTHS[k - 1].slice(1)}</text>
      ${opts.compact ? "" : `<text x="${x0 + (bw - 4) / 2}" y="${H - m.b + 24}" text-anchor="middle">${c.temp ?? ""}°</text>`}
      <rect x="${x0 - 2}" y="0" width="${bw}" height="${H}" fill="transparent" class="hit"/>
    </g>`;
  }).join("");
  container.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Typical monthly snowfall">${bars}</svg>`;
  container.querySelectorAll("g[data-m]").forEach(g => {
    const k = +g.dataset.m, c = climate[k];
    g.addEventListener("mousemove", (ev) => showTip(`<b>${MONTHS[k - 1]}</b> (typical)<br>Snowfall: ${c.snow} cm${c.snowCV != null ? ` (±${Math.round(c.snowCV * 100)}% year to year)` : ""}<br>Days with ≥5 cm: ${c.snowDays}<br>Mean temp: ${c.temp}°C<br>Sunshine: ${c.sun} h/day<br>Max wind (avg): ${c.wind} km/h`, ev.clientX, ev.clientY));
    g.addEventListener("mouseleave", hideTip);
  });
}

/** Normal (mean of past seasons) cumulative snowfall on a given day, interpolated from the weekly samples. */
function normalOn(snow, day) {
  const nor = toDays(snow.normalCurve, daysBetween(snow.seasonStart, snow.seasonEnd) + 1);
  const i = nor.findIndex(p => p.day >= day);
  if (i <= 0) return nor[Math.max(0, i)]?.v ?? null;
  const a = nor[i - 1], b = nor[i];
  return a.v + (b.v - a.v) * (day - a.day) / (b.day - a.day);
}
const MIN_NORMAL = 10; // cm: below this the % swings wildly on one storm, so the line starts once the normal reaches it

/** Compare: one line per destination; x = days since its season start.
 *  mode "pct" = % of normal to date (same measure as the detail panel); "cm" = cumulative snowfall. */
export function compareLines(container, series, mode) {
  const W = 560, H = 260, m = { l: 40, r: 10, t: 10, b: 24 };
  const ser = series.filter(s => s.snow && s.snow.curve && s.snow.curve.length).map(s => {
    const pts = toDays(s.snow.curve, s.snow.dayOfSeason);
    if (mode !== "pct") return { ...s, pts };
    if (!s.snow.normalCurve) return { ...s, pts: [] };
    return { ...s, pts: pts.map(p => { const nv = normalOn(s.snow, p.day); return nv != null && nv >= MIN_NORMAL ? { day: p.day, v: 100 * p.v / nv } : null; }).filter(Boolean) };
  });
  const xMax = Math.max(60, ...ser.map(s => s.pts.length ? s.pts[s.pts.length - 1].day : 0));
  const top = Math.max(mode === "pct" ? 120 : 1, ...ser.flatMap(s => s.pts.map(p => p.v)));
  // % axis in round steps (0, 50, 100, 150…) so the 100% "normal" line sits on a gridline
  const pStep = top > 300 ? 100 : 50, yMax = mode === "pct" ? Math.ceil(top / pStep) * pStep : niceMax(top);
  const x = (d) => m.l + (d / xMax) * (W - m.l - m.r);
  const y = (v) => H - m.b - (v / yMax) * (H - m.t - m.b);
  const ticks = mode === "pct" ? Array.from({ length: yMax / pStep + 1 }, (_, i) => i * pStep) : [0, .25, .5, .75, 1].map(f => f * yMax);
  const yt = ticks.map(v => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 4}" y="${y(v) + 3}" text-anchor="end">${Math.round(v)}${mode === "pct" ? "%" : ""}</text>`).join("");
  const xt = [];
  for (let d = 0; d <= xMax; d += 30) xt.push(`<text x="${x(d)}" y="${H - 6}" text-anchor="middle">${d === 0 ? "start" : `day ${d}`}</text>`);
  const lines = ser.map(s => s.pts.length ? `<path d="${path(s.pts, x, y)}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${x(s.pts.at(-1).day)}" cy="${y(s.pts.at(-1).v)}" r="4" fill="${s.color}" stroke="#fcfcfb" stroke-width="2"/>` : "").join("");
  container.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${mode === "pct" ? "Snowfall this season as a percentage of normal to date" : "Cumulative snowfall this season"}">
      ${yt}${xt.join("")}
      ${mode === "pct" ? `<line x1="${m.l}" x2="${W - m.r}" y1="${y(100)}" y2="${y(100)}" stroke="#52514e" stroke-width="1.2" stroke-dasharray="4 3"/><text x="${W - m.r - 2}" y="${y(100) - 4}" text-anchor="end" style="fill:#52514e">normal</text>` : ""}
      ${lines}
      <line class="xh" y1="${m.t}" y2="${H - m.b}" stroke="#52514e" visibility="hidden"/>
      <rect class="hit" x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/>
    </svg>`;
  const svg = container.querySelector("svg"), xh = svg.querySelector(".xh");
  svg.querySelector(".hit").addEventListener("mousemove", (ev) => {
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * (W / r.width);
    const day = Math.max(0, Math.min(xMax, ((px - m.l) / (W - m.l - m.r)) * xMax));
    xh.setAttribute("x1", x(day)); xh.setAttribute("x2", x(day)); xh.setAttribute("visibility", "visible");
    const rows = ser.map(s => {
      const p = s.pts.filter(p => p.day <= day + 3.5).at(-1);
      return `<span style="color:${s.color}">●</span> ${s.name}: ${p ? Math.round(p.v) + (mode === "pct" ? "%" : " cm") : "–"}`;
    }).join("<br>");
    showTip(`<b>Day ${Math.round(day)} of season</b><br>${rows}`, ev.clientX, ev.clientY);
  });
  svg.querySelector(".hit").addEventListener("mouseleave", () => { xh.setAttribute("visibility", "hidden"); hideTip(); });
}
