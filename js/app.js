import { MONTHS, seasonChart, monthBars, compareLines, daysBetween, showTip, hideTip } from "./charts.js";
import { DEFS, info } from "./defs.js";
import { aboutHTML, siteLinksHTML } from "./about.js";

const CAT = {
  resort:   { label: "Resort",   color: "#9085e9", desc: "On-piste is the draw" },
  freeride: { label: "Freeride", color: "#eda100", desc: "Lift-accessed off-piste" },
  touring:  { label: "Touring",  color: "#199e70", desc: "Skin, heli, boat" },
};
const RESORT_LEVELS = { all: "All levels / family", advanced: "Known for advanced" };
const TOUR_TAGS = { daytour: "Day tours", huts: "Huts", traverse: "Traverses", heli: "Heli & cat", boat: "Boat-accessed", expedition: "Expedition" };
const SLOTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const SNOW = [
  { key: "low2", max: 60, color: "#c43c3b", label: "< 60%", word: "very poor start" },
  { key: "low1", max: 85, color: "#ee9a99", label: "60–85%", word: "poor start" },
  { key: "mid", max: 115, color: "#c9c8c3", label: "85–115%", word: "about normal" },
  { key: "high1", max: 150, color: "#86b6ef", label: "115–150%", word: "good start" },
  { key: "high2", max: Infinity, color: "#1c5cab", label: "> 150%", word: "great start" },
];
const NODATA = "#ffffff";
const AVY_LINKS = {
  "USA": ["avalanche.org", "https://avalanche.org"], "Canada": ["avalanche.ca", "https://avalanche.ca"],
  "Norway": ["varsom.no", "https://www.varsom.no/en/"], "Sweden": ["lavinprognoser.se", "https://www.lavinprognoser.se/en"],
  "Switzerland": ["SLF", "https://www.slf.ch/en/"], "France": ["Météo-France BRA", "https://meteofrance.com/meteo-montagne"],
  "Austria": ["lawinen-warnung.eu", "https://www.lawinen-warnung.eu/"], "Italy": ["AINEVA", "https://bollettini.aineva.it/"],
  "Japan": ["Japan Avalanche Network", "https://nadare.jp/"], "New Zealand": ["NZ Avalanche Advisory", "https://www.avalanche.net.nz/"],
  "Iceland": ["Veðurstofa", "https://en.vedur.is/avalanches/"], "Spain": ["ICGC / AEMET", "https://www.aemet.es/en/eltiempo/prediccion/montana"],
  "Andorra": ["Andorra Meteo", "https://www.meteo.ad/"], "France / Switzerland": ["SLF + Météo-France", "https://www.slf.ch/en/"],
  "Switzerland / Italy": ["SLF", "https://www.slf.ch/en/"], "Austria / Switzerland": ["lawinen-warnung.eu", "https://www.lawinen-warnung.eu/"],
  "Austria / Italy": ["avalanche.report", "https://avalanche.report/"],
  "Spain / France": ["Météo-France BRA", "https://meteofrance.com/meteo-montagne"], "Slovakia / Poland": ["HZS lavinky.sk", "https://www.laviny.sk/"],
};

// ---------- state ----------
const saved = JSON.parse(localStorage.getItem("skiatlas") || "{}");
const state = Object.assign({
  picks: [],          // whole categories selected (resort/freeride/touring)
  levels: [],         // resort levels selected
  tourTypes: [],      // touring types selected
                      // nothing selected anywhere = show everything; otherwise show only what's selected
  months: [],         // travel months (multi-select)
  hideOut: false,
  colorBy: "category",
  minPct: 0,
  crowdMax: 5,
  search: "",
  sort: "zone",
  compare: [],        // [{id, slot}]
}, saved, { selected: null, search: "" });
if (!Array.isArray(state.months)) state.months = state.month ? [state.month] : [];
delete state.month; delete state.tourTags; delete state.iconicOnly;
delete state.trip; delete state.tab; // trip planning removed Nov 2026 (in git history if it comes back)
// v2 (Nov 2026): new "traverse" touring type starts switched on for people who had touring on
// v3 (Nov 2026): touring chips narrow the map (none selected = all types) instead of hiding types, so start everyone at "all"
if ((state.v || 1) < 3) { state.tourTypes = []; state.v = 3; }
// v4 (Nov 2026): resort level chips work the same way (none selected = all levels)
if (state.v < 4) { state.levels = []; state.v = 4; }
// v5 (Nov 2026): one rule for the whole panel: select categories/types to show only those; start everyone at "everything"
if (state.v < 5) { state.picks = []; state.levels = []; state.tourTypes = []; state.v = 5; }
delete state.cats;
const persist = () => {
  const { selected, ...rest } = state;
  localStorage.setItem("skiatlas", JSON.stringify(rest));
};

let DEST = [], BY_ID = {}, SNOWDATA = { destinations: {} }, ZONES = {}, MACROS = {}, STORIES = {}, map, popup;
const ZONE_TIER_MAX = 4; // below this zoom, show named region pills instead of individual pins

// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const snowOf = (d) => SNOWDATA.destinations[d.id];
const inSeason = (d, m) => { const [s, e] = d.season; return s <= e ? m >= s && m <= e : m >= s || m <= e; };
const isBest = (d, m) => d.best.includes(m);
const monthsLabel = () => state.months.map(m => MONTHS[m - 1]).join(", ");
/** dim = months picked and the place is in season in none of them */
const outForMonths = (d) => state.months.length > 0 && !state.months.some(m => inSeason(d, m));
const bestForMonths = (d) => state.months.some(m => isBest(d, m));
function fitText(d) {
  const ms = state.months; if (!ms.length) return null;
  const inMs = ms.filter(m => inSeason(d, m));
  if (bestForMonths(d)) return { cls: "fit-good", text: inMs.length === ms.length ? "prime time" : "prime time (partly in season)" };
  if (inMs.length === ms.length) return { cls: "fit-ok", text: "in season" };
  if (inMs.length) return { cls: "fit-ok", text: `in season ${inMs.map(m => MONTHS[m - 1]).join(", ")} only` };
  return { cls: "fit-bad", text: "out of season" };
}
const snowClass = (pct) => pct == null ? null : SNOW.find(c => pct < c.max);
const lowConfidence = (s) => s && s.normalToDate != null && s.normalToDate < 15;
const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
const meter = (n, max = 5) => `<span class="meter">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? "f" : ""}"></i>`).join("")}</span>`;
const subLabel = (d) => d.category === "touring" ? d.tags.filter(t => TOUR_TAGS[t] || t === "cat").map(t => t === "cat" ? "Cat" : TOUR_TAGS[t]).join(", ")
  : [d.category === "resort" ? RESORT_LEVELS[d.level] : "", d.tags.includes("daytour") ? "+ backcountry" : ""].filter(Boolean).join(" ");
const fmtDay = (iso) => { const d = new Date(iso); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
/** "Nov 18, 2026": month spelled out so it reads the same in every country */
const fmtDate = (iso) => { if (!iso) return "–"; const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
/** Where a destination is in its season today.
 *  in   = operating season now                      → live numbers
 *  pre  = snow is accumulating but it hasn't opened → live numbers (base-building)
 *  over = this season's ski period has ended         → shown as final, N/A on the map
 *  off  = outside the snow year entirely             → N/A */
function status(d) {
  const s = snowOf(d);
  const now = new Date(), m = now.getMonth() + 1, iso = now.toISOString().slice(0, 10);
  if (d.tags.includes("indoor")) return { key: "indoor", live: false, label: "Indoor · snow all year" };
  if (!s) return { key: "nodata", live: false, label: "No snow data yet" };
  if (inSeason(d, m)) return { key: "in", live: true, label: "In season" };
  if (iso < s.seasonStart || iso > s.seasonEnd) return { key: "off", live: false, label: "Off-season" };
  // within the snow year: has the ski season opened yet?
  const start = new Date(s.seasonStart); let open = new Date(Date.UTC(start.getUTCFullYear(), d.season[0] - 1, 1));
  if (open < start) open = new Date(Date.UTC(start.getUTCFullYear() + 1, d.season[0] - 1, 1));
  return now < open
    ? { key: "pre", live: true, label: `Pre-season · opens ~${MONTHS[d.season[0] - 1]}` }
    : { key: "over", live: false, label: `Season over · ended ~${MONTHS[d.season[1] - 1]}` };
}
// ---- staleness: flag data that fell behind (a failed update), not the normal one-day lag ----
const daysOld = (iso) => iso ? Math.floor((Date.now() - new Date(iso + "T00:00:00Z")) / 864e5) : null;
const latestThrough = () => Object.values(SNOWDATA?.destinations || {}).map(s => s.dataThrough).filter(Boolean).sort().at(-1);
/** Text warning if this place's season data or forecast is older than the rest, else "". */
function staleNote(d) {
  const s = snowOf(d); if (!s || !status(d).live) return "";
  const lag = daysOld(s.dataThrough) - daysOld(latestThrough());
  if (lag >= 3) return `Season data stops at ${fmtDay(s.dataThrough)}, ${lag} days behind the other places: the last updates failed for this one.`;
  if (s.forecastAsOf && daysOld(s.forecastAsOf) >= 3) return `The forecast and snow-on-the-ground figures are from ${fmtDay(s.forecastAsOf)}: newer ones failed to download.`;
  return "";
}
/** % of normal only while it means something "now"; null when out of season. */
const livePct = (d) => status(d).live ? snowOf(d)?.pctNormal ?? null : null;
function pctText(d) {
  const s = snowOf(d), st = status(d);
  if (d.tags.includes("indoor")) return "Indoor · snow all year";
  if (!s) return "No snow data yet";
  if (!st.live) return st.key === "over" && s.pctNormal != null ? `Season over · finished at ${s.pctNormal}% of normal` : st.label;
  if (s.pctNormal == null) return s.nSeasons ? "Too early to tell" : "Normal pending";
  return `${s.pctNormal}% of normal`;
}
function rankText(s, final = false) {
  if (!s || s.rank == null) return "";
  const n = s.nSeasons + 1, w = final ? "season" : "start", top = s.rank, bottom = n - s.rank + 1;
  // say it from whichever end is closer, so the direction is obvious ("2nd-least snowy", not "8th of 9")
  const t = top === 1 ? `Snowiest ${w}` : bottom === 1 ? `Least snowy ${w}` : top <= bottom ? `${ordinal(top)}-snowiest ${w}` : `${ordinal(bottom)}-least snowy ${w}`;
  return `${t} of the last ${n} seasons`;
}
function seasonStatus(d) {
  const s = snowOf(d);
  if (!s) return "";
  return `${status(d).label} · counting since ${fmtDay(s.seasonStart)} (day ${s.dayOfSeason})`;
}

// ---------- filtering ----------
/** Resort/freeride pins with big, documented backcountry from the same base (Tahoe, Wasatch…) also count as day tours. */
const anyPicked = () => state.picks.length > 0 || state.levels.length > 0 || state.tourTypes.length > 0;
const alsoTouring = (d) => d.category !== "touring" && d.tags.includes("daytour") && (state.picks.includes("touring") || state.tourTypes.includes("daytour"));
function picked(d) {
  if (!anyPicked() || state.picks.includes(d.category) || alsoTouring(d)) return true;
  if (d.category === "resort") return state.levels.includes(d.level);
  if (d.category === "touring") {
    const tags = d.tags.includes("cat") ? [...d.tags, "heli"] : d.tags;
    return state.tourTypes.some(t => tags.includes(t));
  }
  return false;
}
function passes(d) {
  if (!picked(d)) return false;
  if (state.crowdMax < 5 && d.crowds > state.crowdMax) return false;
  if (state.minPct > 0) { const p = livePct(d); if (p == null || p < state.minPct) return false; }
  if (state.hideOut && outForMonths(d)) return false;
  if (state.search) {
    const q = state.search.toLowerCase();
    const hay = [d.name, d.country, d.region, d.tags.includes("offradar") ? "off the radar" : "", ...(d.children || []).map(c => c.name)].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
function markerColor(d) {
  if (state.colorBy === "snow") { const c = snowClass(livePct(d)); return c ? c.color : NODATA; }
  return CAT[d.category].color;
}

// ---------- map ----------
/** Sub-areas: "resort" (a lift area), "freeride" (lift-served freeride), "bc" (backcountry area or trailhead). */
const kidKind = (c, d) => c.kind || (d.category === "touring" ? "bc" : d.category === "freeride" ? "freeride" : "resort");
const KID_KINDS = { resort: { label: "Ski area", cat: "resort" }, freeride: { label: "Freeride area", cat: "freeride" }, bc: { label: "Backcountry area / trailhead", cat: "touring" } };
const kidColor = (c, d) => state.colorBy === "snow" ? markerColor(d) : CAT[KID_KINDS[kidKind(c, d)].cat].color;
/** Where a sub-area dot is drawn. If it sits almost on top of its main dot at the current zoom (Sun Valley's
 *  Bald Mountain, say), it is nudged out in screen space so both stay clickable; the dotted link still ties it home. */
const KID_MIN_PX = 28;
function kidPlace(d, c, i) {
  if (!map || !map.getZoom || map.getZoom() < 5) return { pos: [c.lon, c.lat], anchor: "top" };
  const P = map.project([d.lon, d.lat]), K = map.project([c.lon, c.lat]);
  let dx = K.x - P.x, dy = K.y - P.y, dist = Math.hypot(dx, dy), pos = [c.lon, c.lat];
  if (dist < 2) { const a = -Math.PI / 2 + i * 2.4; dx = Math.cos(a); dy = Math.sin(a); dist = 1; } // fan out spokes when they coincide
  if (dist < KID_MIN_PX) { const q = map.unproject([P.x + dx / dist * KID_MIN_PX, P.y + dy / dist * KID_MIN_PX]); pos = [q.lng, q.lat]; }
  // label on the far side from the main dot, so it never sits on top of it
  const anchor = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? "bottom" : "top") : (dx < 0 ? "right" : "left");
  return { pos, anchor };
}
const kidPos = (d, c, i) => kidPlace(d, c, i).pos;
const KID_LABEL_OFFSET = { top: [0, 0.8], bottom: [0, -0.8], left: [0.9, 0], right: [-0.9, 0] };
function kidFeatures() {
  return { type: "FeatureCollection", features: DEST.filter(passes).flatMap(d => (d.children || []).map((c, i) => ({
    type: "Feature", geometry: { type: "Point", coordinates: kidPos(d, c, i) },
    properties: { anchor: kidPlace(d, c, i).anchor, name: c.name, note: c.note || "", parent: d.id, i, color: kidColor(c, d), dim: outForMonths(d), bc: kidKind(c, d) === "bc" },
  }))) };
}
/** thin lines tying each sub-area back to its destination, so groups read as groups */
function kidLinkFeatures() {
  return { type: "FeatureCollection", features: DEST.filter(passes).flatMap(d => (d.children || []).map((c, i) => ({
    type: "Feature", geometry: { type: "LineString", coordinates: [[d.lon, d.lat], kidPos(d, c, i)] }, properties: { dim: outForMonths(d) },
  }))) };
}
function features() {
  return {
    type: "FeatureCollection",
    features: DEST.filter(passes).map(d => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [d.lon, d.lat] },
      properties: {
        id: d.id, name: d.name, cat: d.category,
        color: markerColor(d),
        ring: state.colorBy === "snow" ? CAT[d.category].color : "#fcfcfb",
        dim: outForMonths(d),
        best: bestForMonths(d),
      },
    })),
  };
}

function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/positron",
    center: [10, 20], zoom: 1, minZoom: -1, renderWorldCopies: false, attributionControl: { compact: true },
  });
  window.skiMap = map; // handy for debugging in the console
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
  // hover previews only where there is a real hover (mouse/trackpad); on touch a tap opens the full panel directly
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, maxWidth: "280px" });

  map.on("style.load", () => {
    // Terrain shading under the water layer → gives a sense of mountain ranges on a clean basemap
    map.addSource("dem", {
      type: "raster-dem", encoding: "terrarium", tileSize: 256, maxzoom: 12,
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      attribution: "Terrain: Mapzen/AWS",
    });
    winterizeBasemap();
    const waterLayer = map.getStyle().layers.find(l => l.id.includes("water"))?.id;
    map.addLayer({ id: "hillshade", type: "hillshade", source: "dem", paint: {
      "hillshade-exaggeration": 0.6, "hillshade-shadow-color": "#4f6a88", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#7f98b3",
      "hillshade-illumination-direction": 315,
    } }, waterLayer);

    map.addSource("dest", { type: "geojson", data: features(), cluster: true, clusterRadius: 16, clusterMaxZoom: 7 });
    map.addLayer({ id: "clusters", type: "circle", source: "dest", filter: ["has", "point_count"], paint: {
      "circle-color": "#ffffff", "circle-stroke-color": "#4f6a88", "circle-stroke-width": 1.5,
      "circle-radius": ["step", ["get", "point_count"], 12, 5, 15, 12, 19],
    } });
    map.addLayer({ id: "cluster-count", type: "symbol", source: "dest", filter: ["has", "point_count"], layout: {
      "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Bold"],
    }, paint: { "text-color": "#0b0b0b" } });
    map.addLayer({ id: "points", type: "circle", source: "dest", filter: ["!", ["has", "point_count"]], paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["case", ["get", "best"], 7, 5.5], 6, ["case", ["get", "best"], 10, 8]],
      "circle-stroke-color": ["case", ["==", ["get", "color"], NODATA], "#8a8984", ["get", "ring"]],
      "circle-stroke-width": ["case", ["get", "best"], 3, 2],
      "circle-opacity": ["case", ["get", "dim"], 0.25, 1],
      "circle-stroke-opacity": ["case", ["get", "dim"], 0.25, 1],
    } });
    map.addLayer({ id: "labels", type: "symbol", source: "dest", filter: ["!", ["has", "point_count"]], minzoom: 4.5, layout: {
      "text-field": ["get", "name"], "text-size": 12, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.1], "text-anchor": "top", "text-max-width": 12, "text-optional": true,
    }, paint: { "text-color": "#10233a", "text-halo-color": "#f5f8fb", "text-halo-width": 1.5, "text-opacity": ["case", ["get", "dim"], 0.35, 1] } });

    // every sub-resort / sub-area as its own small dot once zoomed in (Vail, Breckenridge, A-Basin…)
    map.addSource("kidlinks", { type: "geojson", data: kidLinkFeatures() });
    // light casing under the dashes so they read over hillshade
    map.addLayer({ id: "kidlinks-casing", type: "line", source: "kidlinks", minzoom: 5, layout: { "line-cap": "round" }, paint: {
      "line-color": "#fcfcfb", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3.5, 9, 5], "line-opacity": ["case", ["get", "dim"], 0.2, 0.75],
    } }, "points");
    map.addLayer({ id: "kidlinks", type: "line", source: "kidlinks", minzoom: 5, paint: {
      "line-color": "#17395c", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.8, 9, 2.8], "line-dasharray": [2, 1.2], "line-opacity": ["case", ["get", "dim"], 0.25, 0.9],
    } }, "points");
    map.addSource("kids", { type: "geojson", data: kidFeatures() });
    // every sub-area is a smaller version of a destination dot: filled with its own type colour (or the parent's snow colour), white ring
    map.addLayer({ id: "kids", type: "circle", source: "kids", minzoom: 5, paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3.5, 9, 6.5],
      "circle-color": ["get", "color"], "circle-stroke-color": "#fcfcfb", "circle-stroke-width": 1.5,
      "circle-opacity": ["case", ["get", "dim"], 0.3, 1], "circle-stroke-opacity": ["case", ["get", "dim"], 0.3, 1],
    } });
    map.addLayer({ id: "kids-labels", type: "symbol", source: "kids", minzoom: 6.3, layout: {
      "text-field": ["get", "name"], "text-size": 11, "text-font": ["case", ["get", "bc"], ["literal", ["Noto Sans Italic"]], ["literal", ["Noto Sans Regular"]]], "text-offset": ["match", ["get", "anchor"], "bottom", ["literal", KID_LABEL_OFFSET.bottom], "left", ["literal", KID_LABEL_OFFSET.left], "right", ["literal", KID_LABEL_OFFSET.right], ["literal", KID_LABEL_OFFSET.top]], "text-anchor": ["get", "anchor"], "text-optional": true, "text-max-width": 10,
    }, paint: { "text-color": "#52514e", "text-halo-color": "#f5f8fb", "text-halo-width": 1.5, "text-opacity": ["case", ["get", "dim"], 0.4, 1] } });
    map.on("click", "kids", (e) => { const f = e.features[0].properties; openSub(f.parent, +f.i); });
    map.on("mouseenter", "kids", (e) => { map.getCanvas().style.cursor = "pointer"; if (!canHover) return; const f = e.features[0].properties, d = BY_ID[f.parent];
      popup.setLngLat(e.lngLat).setHTML(`<div class="pop"><h4>${esc(f.name)}</h4><div class="row">${esc(f.note)}</div><div class="row muted">${f.bc ? "Backcountry area · " : ""}Part of ${esc(d.name)} · click for more</div></div>`).addTo(map); });
    map.on("mouseleave", "kids", () => { map.getCanvas().style.cursor = ""; popup.remove(); });

    map.addSource("children", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "children", type: "circle", source: "children", paint: { "circle-radius": 9, "circle-color": "transparent", "circle-stroke-color": "#17395c", "circle-stroke-width": ["case", ["get", "on"], 2.5, 1.2] } }, "kids");
    map.addSource("sel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "sel", type: "circle", source: "sel", paint: { "circle-radius": 14, "circle-color": "transparent", "circle-stroke-color": "#17395c", "circle-stroke-width": 2 } }, "points");

    bindZoneEvents();
    fitAll(false);
    renderZones();
    if (location.hash.startsWith("#place/")) routeFromHash(); // a shared link: fly straight there
    map.once("idle", () => { map.resize(); if (!state.selected) fitAll(false); renderZones(); }); // re-fit once the tray/layout has settled (unless a place is already open)
  });

  map.on("click", "clusters", async (e) => {
    const f = e.features[0];
    const z = await map.getSource("dest").getClusterExpansionZoom(f.properties.cluster_id);
    map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.3 });
  });
  map.on("mouseenter", "clusters", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "clusters", () => map.getCanvas().style.cursor = "");
  map.on("mouseenter", "points", (e) => {
    map.getCanvas().style.cursor = "pointer";
    if (!canHover) return;
    const d = BY_ID[e.features[0].properties.id];
    popup.setLngLat([d.lon, d.lat]).setHTML(popupHTML(d)).addTo(map);
  });
  map.on("mouseleave", "points", () => { map.getCanvas().style.cursor = ""; popup.remove(); });
  map.on("click", "points", (e) => openDetail(e.features[0].properties.id, false));
}


// ---------- world view: named region pills (semantic zoom) ----------
// Below ZONE_TIER_MAX the map shows one pill per region, with one dot per destination inside it,
// so every destination stays visible and scannable at world scale. If the regions would crowd
// each other too much (small window / far zoomed out) they merge into bigger "macro" regions.
const zoneOrder = (d) => { const keys = Object.keys(ZONES); return keys.indexOf(d.zone); };
let zoneTier = null, zoneEls = [], zoneRaf = 0;

/** merged = set of macro keys shown as one big pill; every other region keeps its own pill. "all" merges everything. */
function groupsFor(merged) {
  const groups = new Map();
  for (const d of DEST) {
    const macro = ZONES[d.zone]?.macro, big = merged === "all" || merged.has(macro);
    const key = big ? "m:" + macro : d.zone;
    if (!groups.has(key)) groups.set(key, { key, macro, name: big ? MACROS[macro] : ZONES[d.zone]?.name, all: [], shown: [] });
    const g = groups.get(key); g.all.push(d);
    if (passes(d)) g.shown.push(d);
  }
  return [...groups.values()].filter(g => g.shown.length).map(g => {
    // anchor = mean of all members (stable when filters change); wrap-safe enough for these regions
    g.lon = g.all.reduce((a, d) => a + d.lon, 0) / g.all.length;
    g.lat = g.all.reduce((a, d) => a + d.lat, 0) / g.all.length;
    return g;
  });
}

function pillHTML(g) {
  const dots = g.shown.map(d => {
    const col = markerColor(d), out = outForMonths(d), best = bestForMonths(d);
    return `<i data-id="${d.id}" class="${out ? "out" : ""} ${best ? "best" : ""}" style="background:${col};${col === NODATA ? "box-shadow:inset 0 0 0 1px #8a8984" : ""}"></i>`;
  }).join("");
  return `<div class="zname" data-zone="${g.key}">${esc(g.name)} <span>${g.shown.length}</span></div><div class="zdots">${dots}</div>`;
}

function buildZones(merged) {
  const layer = $("#zoneLayer");
  layer.querySelectorAll(".zpill").forEach(e => e.remove());
  zoneEls = groupsFor(merged).map(g => {
    const el = document.createElement("div");
    el.className = "zpill"; el.innerHTML = pillHTML(g);
    layer.appendChild(el);
    return { g, el, w: 0, h: 0 };
  });
  zoneEls.forEach(z => { z.w = z.el.offsetWidth; z.h = z.el.offsetHeight; });
}

/** Place pills at their anchors, then push overlapping pills apart. Returns the largest displacement. */
function layoutZones() {
  const W = map.getContainer().clientWidth, H = map.getContainer().clientHeight, pad = 6, margin = 24;
  const boxes = [];
  // On a phone the whole world can't fit across the screen, so regions off to the side get a small
  // edge tab ("‹ Japan 10") instead of disappearing. Only in the world view, not once zoomed in.
  const hints = W < 600 && map.getZoom() < 1.5;
  zoneEls.forEach(z => {
    const p = map.project([z.g.lon, z.g.lat]);
    const onScreen = p.x > -margin && p.x < W + margin && p.y > -margin && p.y < H + margin;
    const side = !onScreen && hints && p.y > -margin && p.y < H + margin ? (p.x < 0 ? "left" : "right") : null;
    if (z.el.classList.contains("edge") !== !!side || z.el.dataset.side !== (side || "")) {
      z.el.classList.toggle("edge", !!side); z.el.dataset.side = side || "";
      z.w = z.el.offsetWidth; z.h = z.el.offsetHeight;
    }
    z.el.style.display = onScreen || side ? "" : "none";
    if (onScreen) boxes.push({ z, ax: p.x, ay: p.y, x: p.x - z.w / 2, y: p.y - z.h / 2, w: z.w, h: z.h });
    else if (side) boxes.push({ z, ax: p.x, ay: p.y, x: side === "left" ? 4 : W - z.w - 4, y: p.y - z.h / 2, w: z.w, h: z.h, edge: true });
  });
  for (let it = 0; it < 120; it++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + pad;
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + pad;
      if (ox > 0 && oy > 0) {
        moved = true;
        if (oy < ox) { const s = (a.ay + a.h / 2 < b.ay + b.h / 2 || (a.ay === b.ay && i < j)) ? -1 : 1; a.y += s * oy / 2; b.y -= s * oy / 2; }
        else { const s = a.ax < b.ax ? -1 : 1; a.x += s * ox / 2; b.x -= s * ox / 2; }
      }
    }
    boxes.forEach(b => { b.x = Math.max(4, Math.min(W - b.w - 4, b.x)); b.y = Math.max(4, Math.min(H - b.h - 4, b.y)); });
    if (!moved) break;
  }
  let maxDisp = 0, lines = "";
  boxes.forEach(b => {
    b.z.el.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)`;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, disp = Math.hypot(cx - b.ax, cy - b.ay);
    b.z.disp = b.edge ? 0 : disp;
    if (b.edge) return;
    maxDisp = Math.max(maxDisp, disp);
    if (disp > b.h / 2 + 4) {
      // leader line from the true location to the nearest edge of the pill
      const ex = Math.max(b.x, Math.min(b.ax, b.x + b.w)), ey = Math.max(b.y, Math.min(b.ay, b.y + b.h));
      lines += `<line x1="${b.ax}" y1="${b.ay}" x2="${ex}" y2="${ey}"/><circle cx="${b.ax}" cy="${b.ay}" r="2.5"/>`;
    }
  });
  $("#zoneLines").innerHTML = lines;
  return maxDisp;
}

function setPinLayers(visible) {
  ["points", "clusters", "cluster-count", "labels", "kids", "kids-labels", "kidlinks", "kidlinks-casing"].forEach(id => map.getLayer(id) && map.setLayoutProperty(id, "visibility", visible ? "visible" : "none"));
}

/** Decide tier for the current zoom and (re)build. Called on zoomend and on filter changes. */
function renderZones() {
  if (!map?.getLayer("points")) return;
  const layer = $("#zoneLayer");
  if (map.getZoom() >= ZONE_TIER_MAX) {
    zoneTier = "pins"; layer.classList.add("hidden"); setPinLayers(true); zoneEls = []; return;
  }
  layer.classList.remove("hidden"); setPinLayers(false);
  // Start with one pill per region. Where pills had to be pushed far from their real location to fit
  // (crowded parts of the world, small screens), merge that part of the world into one bigger pill.
  // Roomy areas keep their detail, and zooming in brings the regions back.
  const merged = new Set(), limit = Math.max(28, Math.min(70, map.getContainer().clientWidth / 18));
  buildZones(merged); layoutZones();
  // only at world scale: once someone zooms in to a part of the world, always show its regions
  for (let pass = 0; pass < 4 && map.getZoom() < 2.2; pass++) {
    const crowded = zoneEls.filter(z => z.el.style.display !== "none" && z.disp > limit && !merged.has(z.g.macro)).map(z => z.g.macro);
    if (!crowded.length) break;
    crowded.forEach(m => merged.add(m));
    buildZones(merged); layoutZones();
  }
  zoneTier = merged.size ? "mixed" : "zone";
}

function bindZoneEvents() {
  map.on("zoomend", renderZones);
  map.on("zoom", refreshKidPositions);
  map.on("move", () => { if (zoneEls.length && !zoneRaf) zoneRaf = requestAnimationFrame(() => { zoneRaf = 0; layoutZones(); }); });
  map.on("resize", renderZones);
  const layer = $("#zoneLayer");
  // let the scroll wheel zoom the map even when the pointer is over a pill
  layer.addEventListener("wheel", (e) => { e.preventDefault(); map.getCanvas().dispatchEvent(new WheelEvent("wheel", e)); }, { passive: false });
  layer.addEventListener("mouseover", (e) => {
    const dot = e.target.closest("i[data-id]"), nm = e.target.closest(".zname");
    if (dot) { const d = BY_ID[dot.dataset.id]; const st = status(d); showTip(`<b>${esc(d.name)}</b><br>${CAT[d.category].label}${subLabel(d) ? " · " + esc(subLabel(d)) : ""}<br>${pctText(d)}${st.live && snowOf(d)?.next7 != null ? `<br>Next 7 days: ${snowOf(d).next7} cm` : ""}`, e.clientX, e.clientY); }
    else if (nm) {
      const z = zoneEls.find(z => z.g.key === nm.dataset.zone);
      if (z) showTip(`<b>${esc(z.g.name)}</b><br>` + z.g.shown.map(d => `<span style="color:${markerColor(d) === NODATA ? "#8a8984" : markerColor(d)}">●</span> ${esc(d.name)} <span style="opacity:.7">${livePct(d) != null ? livePct(d) + "%" : ""}</span>`).join("<br>") + `<br><span style="opacity:.7">Click to zoom in</span>`, e.clientX, e.clientY);
    }
  });
  layer.addEventListener("mouseout", (e) => { if (e.target.closest("i[data-id], .zname")) hideTip(); });
  layer.addEventListener("click", (e) => {
    const dot = e.target.closest("i[data-id]"), pill = e.target.closest(".zpill");
    hideTip();
    if (dot) { openDetail(dot.dataset.id, true); return; }
    if (pill) {
      const z = zoneEls.find(z => z.el === pill); if (!z) return;
      const b = new maplibregl.LngLatBounds(); z.g.shown.forEach(d => b.extend([d.lon, d.lat]));
      // a merged pill opens up into its regions; a region pill zooms on to the individual places
      map.fitBounds(b, z.g.key.startsWith("m:") ? { padding: 60, maxZoom: ZONE_TIER_MAX - 0.3 } : { padding: 80, maxZoom: 7, minZoom: ZONE_TIER_MAX + 0.2 });
    }
  });
}

/** Recolour the neutral grey basemap into cool, wintery tones (icy water, snow-white land, slate shadows). */
function winterizeBasemap() {
  for (const l of map.getStyle().layers) {
    const id = l.id;
    try {
      if (l.type === "background") map.setPaintProperty(id, "background-color", "#fafcfd");
      else if (l.type === "fill" && /water|ocean|lake/.test(id)) map.setPaintProperty(id, "fill-color", "#bcd4e8");
      else if (l.type === "line" && /water|river|stream/.test(id)) map.setPaintProperty(id, "line-color", "#b7cde0");
      else if (l.type === "fill" && /glacier|ice/.test(id)) map.setPaintProperty(id, "fill-color", "#ffffff");
      else if (l.type === "fill" && /landcover|landuse|park|wood|grass/.test(id)) map.setPaintProperty(id, "fill-color", "#eaf0f4");
      else if (l.type === "symbol" && /water/.test(id)) map.setPaintProperty(id, "text-color", "#6e8ba6");
      else if (l.type === "line" && /boundary|admin/.test(id)) map.setPaintProperty(id, "line-color", "#a9b8c6");
    } catch (e) { /* layer doesn't support that property: skip */ }
  }
}

function fitAll(animate = true) {
  const c = map.getContainer(), W = c.clientWidth, H = c.clientHeight;
  // the map can't zoom out past the point where the world fills the screen's height
  const zMin = Math.log2(H / 512), span = W / (512 * 2 ** zMin) * 360;
  if (span < 300) {
    // narrow screen: the whole world doesn't fit across, so centre on the stretch with the most places
    let best = 0, bestN = -1;
    for (let lon = -180 + span / 2; lon <= 180 - span / 2; lon += 5) {
      const n = DEST.filter(d => Math.abs(d.lon - lon) < span / 2 - 8).length;
      if (n > bestN) { bestN = n; best = lon; }
    }
    map[animate ? "easeTo" : "jumpTo"]({ center: [best, 25], zoom: zMin + 0.01 });
    return;
  }
  const b = new maplibregl.LngLatBounds();
  DEST.forEach(d => b.extend([d.lon, d.lat]));
  map.fitBounds(b, { padding: { top: 40, bottom: 40, left: 40, right: 90 }, animate });
}

function popupHTML(d) {
  const s = snowOf(d), c = snowClass(livePct(d)), st = status(d);
  const ft = fitText(d), month = ft ? `${monthsLabel()}: ${ft.text}` : "";
  return `<div class="pop">
    <h4>${esc(d.name)}</h4>
    <div class="row"><span style="color:${CAT[d.category].color}">●</span> ${CAT[d.category].label}${subLabel(d) ? " · " + esc(subLabel(d)) : ""} · ${esc(d.country)}</div>
    <div class="big">${c ? `<span style="color:${c.color === "#c9c8c3" ? "#8a8984" : c.color}">●</span> ` : ""}<b>${pctText(d)}</b>${st.live && lowConfidence(s) ? " <span class='muted'>(early)</span>" : ""}</div>
    ${s && st.live ? `<div class="row">${st.key === "pre" ? "Pre-season · " : ""}${s.toDate} cm since ${fmtDay(s.seasonStart)} (normal ${s.normalToDate ?? "–"}) · next 7 days: ${s.next7 ?? "–"} cm</div>
    <div class="row">${rankText(s)}</div>` : ""}
    ${month ? `<div class="row">${month}</div>` : ""}
    ${d.advisory ? `<div class="row" style="color:#a3341f">⚠ Travel advisory: see details</div>` : ""}
    <div class="row muted">Data through ${fmtDate(s?.dataThrough)}${staleNote(d) ? ` <span class="stale-tag">· out of date</span>` : ""} · click for details</div>
  </div>`;
}

function refresh() {
  persist();
  if (map?.getSource("dest")) map.getSource("dest").setData(features());
  if (map?.getSource("kids")) map.getSource("kids").setData(kidFeatures());
  if (map?.getSource("kidlinks")) map.getSource("kidlinks").setData(kidLinkFeatures());
  renderZones();
  renderList();
  renderLegend();
  renderFilterBar();
  renderTray();
  if (state.selected) renderDetail(state.selected);
}

// ---------- sidebar ----------
const FILTER_DEFAULTS = { picks: [], levels: [], tourTypes: [], months: [], hideOut: false, minPct: 0, crowdMax: 5, search: "" };
const activeFilters = () => state.picks.length + state.levels.length + state.tourTypes.length + state.months.length + (state.hideOut ? 1 : 0) + (state.minPct ? 1 : 0) + (state.crowdMax < 5 ? 1 : 0) + (state.search.trim() ? 1 : 0);
function clearFilters() {
  Object.assign(state, structuredClone(FILTER_DEFAULTS));
  $("#search").value = ""; $("#minPct").value = 0; $("#minPctVal").textContent = "any";
  renderControls(); refresh();
}
function renderFilterBar() {
  const n = activeFilters();
  $("#filterCount").textContent = n ? `· ${n} on` : "";
  $("#clearAll").disabled = !n;
}
function renderControls() {
  const any = anyPicked(), chipKey = { resort: "levels", touring: "tourTypes" };
  const rowState = (k) => state.picks.includes(k) ? "sel" : chipKey[k] && state[chipKey[k]].length ? "part" : any ? "off" : "";
  const chips = (k, defs, attr) => `<div class="subs">${Object.entries(defs).map(([v, l]) => { const on = state[chipKey[k]].includes(v);
    return `<button class="chip ${on ? "on" : ""}" ${attr}="${v}" aria-pressed="${on}">${l}</button>`; }).join("")}${info(k === "resort" ? "levels" : "tourTags")}</div>`;
  $("#catToggles").innerHTML = Object.entries(CAT).map(([k, c]) => `
    <button type="button" class="cat-row ${rowState(k)}" data-cat="${k}" aria-pressed="${state.picks.includes(k)}" style="--c:${c.color}"><span class="dot" aria-hidden="true"></span><b>${c.label}</b><span class="muted" style="font-size:12px">${c.desc}</span></button>
    ${k === "resort" ? chips(k, RESORT_LEVELS, "data-level") : ""}
    ${k === "touring" ? chips(k, TOUR_TAGS, "data-tag") : ""}
  `).join("") + `<div class="pick-note">${any ? `Showing only what you've selected · <a href="#" id="clearPicks">show everything</a>` : "Showing everything · tap any category or type to show only those"}</div>`;
  $("#clearPicks") && ($("#clearPicks").onclick = (e) => { e.preventDefault(); state.picks = []; state.levels = []; state.tourTypes = []; renderControls(); refresh(); });
  $("#months").innerHTML = MONTHS.map((m, i) => `<button data-m="${i + 1}" class="${state.months.includes(i + 1) ? "on" : ""}">${m}</button>`).join("") +
    `<button data-m="" class="any ${state.months.length ? "" : "on"}">Any time</button>`;
  $("#hideOut").checked = state.hideOut;
  document.querySelectorAll("#colorBy button").forEach(b => b.classList.toggle("on", b.dataset.v === state.colorBy));
  document.querySelectorAll("#crowdMax button").forEach(b => b.classList.toggle("on", +b.dataset.v === state.crowdMax));
  $("#minPct").value = state.minPct;
  $("#minPctVal").textContent = state.minPct ? state.minPct + "%" : "any";
  $("#sortBy").value = state.sort;
}

function bindControls() {
  $("#catToggles").addEventListener("click", (e) => {
    const row = e.target.closest("[data-cat]"), lv = e.target.closest("[data-level]"), tg = e.target.closest("[data-tag]");
    const listKey = { resort: "levels", touring: "tourTypes" };
    const toggle = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
    if (lv || tg) {
      // a chip selects just that kind; if its whole category was selected, narrow the category to this chip
      const cat = lv ? "resort" : "touring", key = listKey[cat], v = lv ? lv.dataset.level : tg.dataset.tag;
      if (state.picks.includes(cat)) { state.picks = state.picks.filter(x => x !== cat); state[key] = [v]; }
      else state[key] = toggle(state[key], v);
    } else if (row) {
      // a category row selects (or deselects) the whole category, replacing any chips within it
      const cat = row.dataset.cat;
      state.picks = toggle(state.picks, cat);
      if (listKey[cat]) state[listKey[cat]] = [];
    }
    renderControls(); refresh();
  });
  $("#months").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (!b.dataset.m) state.months = [];
    else { const m = +b.dataset.m; state.months = state.months.includes(m) ? state.months.filter(x => x !== m) : [...state.months, m].sort((a, b) => a - b); }
    renderControls(); refresh();
  });
  $("#hideOut").addEventListener("change", (e) => { state.hideOut = e.target.checked; refresh(); });
  $("#colorBy").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.colorBy = b.dataset.v; renderControls(); refresh(); });
  $("#crowdMax").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.crowdMax = +b.dataset.v; renderControls(); refresh(); });
  $("#minPct").addEventListener("input", (e) => { state.minPct = +e.target.value; $("#minPctVal").textContent = state.minPct ? state.minPct + "%" : "any"; refresh(); });
  $("#search").addEventListener("input", (e) => { state.search = e.target.value; refresh(); });
  $("#sortBy").addEventListener("change", (e) => { state.sort = e.target.value; refresh(); });
  $("#list").addEventListener("click", (e) => { const li = e.target.closest("li[data-id]"); if (li) openDetail(li.dataset.id, true); });
  $("#clearAll").addEventListener("click", clearFilters);
  const desktop = () => window.innerWidth > 820;
  const setSidebar = (open) => {
    if (desktop()) {
      document.body.classList.toggle("sb-collapsed", !open); state.sbCollapsed = !open; persist();
      map?.resize(); renderZones();
      return;
    }
    $("#sidebar").classList.toggle("open", open); document.body.classList.toggle("sb-open", open);
  };
  document.body.classList.toggle("sb-collapsed", !!state.sbCollapsed);
  $("#brandChip").addEventListener("click", () => setSidebar(true));
  $("#toggleSidebar").addEventListener("click", () => setSidebar(desktop() ? true : !$("#sidebar").classList.contains("open")));
  for (const id of ["#closeSidebar", "#showMap", "#sbBackdrop"]) $(id).addEventListener("click", () => setSidebar(false));
}

function renderLegend() {
  $("#legend").innerHTML = state.colorBy === "snow"
    ? SNOW.map(c => `<span><i style="background:${c.color}"></i>${c.label}</span>`).join("") + `<span><i style="background:#fff;border:1px solid #8a8984"></i>out of season / no snow data yet</span><span class="muted" style="width:100%">Snowfall this season vs the same date in past seasons. Ring colour = type.</span>`
    : Object.values(CAT).map(c => `<span><i style="background:${c.color}"></i>${c.label}</span>`).join("") + (state.months.length ? `<span class="muted" style="width:100%">Ringed dot = a best month · faded = out of season in all picked months</span>` : "");
}

function renderList() {
  let list = DEST.filter(passes);
  const key = {
    name: (a, b) => a.name.localeCompare(b.name),
    pct: (a, b) => (livePct(b) ?? -1) - (livePct(a) ?? -1),
    zone: (a, b) => zoneOrder(a) - zoneOrder(b) || a.name.localeCompare(b.name),
    next7: (a, b) => (snowOf(b)?.next7 ?? -1) - (snowOf(a)?.next7 ?? -1),
  }[state.sort];
  list.sort(key);
  $("#count").textContent = list.length;
  $("#countMap").textContent = list.length === 1 ? "1 place" : `${list.length} places`;
  const hidden = DEST.length - list.length;
  $("#hiddenNote").innerHTML = hidden ? `${hidden} of ${DEST.length} hidden by filters · <a href="#" id="resetFilters">show all</a>` : "";
  $("#resetFilters") && ($("#resetFilters").onclick = (e) => { e.preventDefault(); clearFilters(); });
  let lastZone = null;
  $("#list").innerHTML = list.map(d => {
    const s = snowOf(d), lp = livePct(d);
    const pill = state.sort === "next7" ? `${s?.next7 ?? "–"} cm next 7d` : lp != null ? `${lp}%` : status(d).live ? "–" : "n/a";
    const head = state.sort === "zone" && d.zone !== lastZone ? `<li class="group">${esc(ZONES[d.zone]?.name)}<span>${esc(MACROS[ZONES[d.zone]?.macro] ?? "")}</span></li>` : "";
    lastZone = d.zone;
    const dim = outForMonths(d);
    return `${head}<li data-id="${d.id}" class="${dim ? "dim" : ""}"><span class="dot" style="background:${markerColor(d)};${markerColor(d) === NODATA ? "border:1px solid #8a8984" : ""}"></span>
      <span>${esc(d.name)}${d.tags.includes("offradar") ? ` <span class="offradar-tag">off the radar</span>` : ""}<div class="sub">${esc(d.country)}${subLabel(d) ? " · " + esc(subLabel(d)) : ""}</div></span>
      <span class="pill" title="${esc(status(d).label)}">${pill}</span></li>`;
  }).join("");
}

// ---------- detail ----------
// Map links generated from coordinates.
// Piste map: OpenSkiMap (OpenStreetMap pistes and lifts) — only offered where there are lifts, since it is blank elsewhere.
// Topo map: CalTopo's free worldwide topo with slope-angle shading switched on, for judging terrain anywhere.
const trailMapUrl = (lat, lon, z = 13) => `https://openskimap.org/#${z}/${lat}/${lon}`;
const topoUrl = (lat, lon, z = 13) => `https://caltopo.com/map.html#ll=${lat},${lon}&z=${z}&b=mbt&a=sf`;
// A web search that lands on useful pages: the place's plain name (no bracketed lists), where it is, and what kind of skiing.
const plainName = (n) => n.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
const searchUrl = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const skiWord = (kind) => kind === "bc" || kind === "touring" ? "ski touring" : kind === "freeride" ? "freeride" : "skiing";
const destSearch = (d) => searchUrl(d.tags.includes("indoor") ? `${plainName(d.name)} indoor skiing` : `${plainName(d.name)} ${d.country} ${skiWord(d.category)}`);
const kidSearch = (c, d) => searchUrl(`${plainName(c.name)} ${d.region} ${skiWord(kidKind(c, d))}`);
const tourSearch = (t, d) => searchUrl(`${plainName(t.name)} ${d.region} ski tour`);
const searchLink = (url, label = "web search") => `<a href="${url}" target="_blank" rel="noopener" class="search-link" title="Search the web for this place"><svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 10l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${label} ↗</a>`;
const hasLifts = (d) => d.category !== "touring" && !d.tags.includes("indoor");
const mapLinks = (d, short = false) => {
  if (d.tags.includes("indoor")) return [];
  const z = d.children ? 11 : 13;
  return [hasLifts(d) && `<a href="${trailMapUrl(d.lat, d.lon, z)}" target="_blank" rel="noopener">${short ? "piste map" : "piste map"} ↗</a>`,
    `<a href="${topoUrl(d.lat, d.lon, z)}" target="_blank" rel="noopener">${short ? "topo" : "topo + slope angles"} ↗</a>`].filter(Boolean);
};
const hostLabel = (u) => { try { const h = new URL(u).hostname.replace(/^www\./, ""); return h; } catch { return u; } };
const rawUrl = (d, s) => `https://archive-api.open-meteo.com/v1/archive?latitude=${d.lat}&longitude=${d.lon}&elevation=${d.refElev}&start_date=${s.seasonStart}&end_date=${s.dataThrough}&daily=snowfall_sum,precipitation_sum,temperature_2m_mean,snow_depth_max&models=ecmwf_ifs&timezone=auto`;
const fcUrl = (d) => `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}&elevation=${d.refElev}&daily=snowfall_sum,precipitation_sum,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`;
function openDetail(id, fly) {
  popup?.remove(); // the full panel replaces the hover preview
  state.selected = id;
  const d = BY_ID[id];
  if (fly) map.flyTo({ center: [d.lon, d.lat], zoom: Math.max(map.getZoom(), d.children ? 7 : 7.5), speed: 1.4, padding: panelPadding() });
  markGroup(d);
  map.getSource("sel")?.setData({ type: "Feature", geometry: { type: "Point", coordinates: [d.lon, d.lat] }, properties: {} });
  $("#sidebar").classList.remove("open"); document.body.classList.remove("sb-open");
  renderDetail(id);
}
let markedGroup = null;
function markGroup(d, on = -1) {
  markedGroup = d ? [d, on] : null;
  map.getSource("children")?.setData({ type: "FeatureCollection", features: (d?.children || []).map((c, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: kidPos(d, c, i) }, properties: { on: i === on } })) });
}
/** keep nudged sub-area dots (and their links and rings) in step with the zoom */
let kidRaf = 0;
function refreshKidPositions() {
  if (kidRaf) return;
  kidRaf = requestAnimationFrame(() => {
    kidRaf = 0;
    map.getSource("kids")?.setData(kidFeatures());
    map.getSource("kidlinks")?.setData(kidLinkFeatures());
    if (markedGroup) markGroup(...markedGroup);
  });
}
const toursList = (d, filter) => `<ul class="tours">${d.tours.filter(t => !filter || filter(t)).map(t => `<li><b>${esc(t.name)}</b>${t.grade ? ` <span class="muted">· ${esc(t.grade)}</span>` : ""} ${searchLink(tourSearch(t, d), "search")}<div>${esc(t.note)}</div></li>`).join("")}</ul>`;
/** A lighter card for one area inside a destination (Alta inside the Cottonwoods, Mount Baker inside the Cascade Volcanoes). */
function openSub(id, i) {
  popup?.remove(); // the full panel replaces the hover preview
  const d = BY_ID[id], c = d?.children?.[i]; if (!c) return;
  state.selected = id;
  const k = kidKind(c, d), kc = CAT[KID_KINDS[k].cat];
  map.getSource("sel")?.setData({ type: "Feature", geometry: { type: "Point", coordinates: [d.lon, d.lat] }, properties: {} });
  markGroup(d, i);
  map.flyTo({ center: [c.lon, c.lat], zoom: Math.max(map.getZoom(), 9.5), speed: 1.4, padding: panelPadding() });
  $("#sidebar").classList.remove("open"); document.body.classList.remove("sb-open");
  const s = snowOf(d), st = status(d), lp = livePct(d);
  const tours = d.tours?.filter(t => t.area === c.name) || [];
  const el = $("#detail"); el.classList.remove("hidden"); el.scrollTop = 0;
  el.innerHTML = `
    <div class="sticky-close"><button class="close" id="detailClose" aria-label="Close">×</button></div>
    <a href="#" class="crumb" id="toParent">‹ ${esc(plainName(d.name))}</a>
    <div class="d-type"><span class="dot" style="background:${kc.color}"></span>${KID_KINDS[k].label} · part of ${esc(plainName(d.name))}</div>
    <h3>${esc(c.name)}</h3>
    <div class="muted" style="font-size:13px">${esc(d.region)}, ${esc(d.country)}</div>
    <p class="pitch">${esc(c.note)}</p>
    ${c.more ? `<p style="font-size:14px;line-height:1.5">${esc(c.more)}</p>` : ""}
    ${tours.length ? `<div class="section-title">Notable tours here</div>${toursList(d, t => t.area === c.name)}` : ""}
    <div class="section-title">Look it up</div>
    <div class="sub-links">${[c.url && `<a href="${c.url}" target="_blank" rel="noopener">${hostLabel(c.url)} ↗</a>`, k === "bc" ? `<a href="${topoUrl(c.lat, c.lon, 13)}" target="_blank" rel="noopener">topo + slope angles ↗</a>` : `<a href="${trailMapUrl(c.lat, c.lon)}" target="_blank" rel="noopener">piste map ↗</a>`, k !== "bc" ? `<a href="${topoUrl(c.lat, c.lon, 13)}" target="_blank" rel="noopener">topo ↗</a>` : "", searchLink(kidSearch(c, d))].filter(Boolean).join(" · ")}</div>
    <div class="section-title">Snow, season &amp; essentials</div>
    <div class="callout">Shared with the whole destination: <b>${esc(plainName(d.name))}</b>${s ? ` is at <b>${lp != null ? lp + "% of normal" : esc(st.label)}</b> this season` : ""}, best ${d.best.map(m => MONTHS[m - 1]).join(", ") || "any month"}.
      <div style="margin-top:8px"><button class="btn primary" id="parentCard">Full card for ${esc(plainName(d.name))}</button>${STORIES[id] ? ` <button class="btn" id="readMore">Read more →</button>` : ""}</div></div>
    ${d.children.length > 1 ? `<div class="section-title">Other areas in ${esc(plainName(d.name))}</div><ul class="children">${d.children.map((x, j) => j === i ? "" : `<li data-i="${j}"><span class="dot sm" style="background:${CAT[KID_KINDS[kidKind(x, d)].cat].color}"></span><div><b>${esc(x.name)}</b></div><span class="chev" aria-hidden="true">›</span></li>`).join("")}</ul>` : ""}
    <div class="fb-line">Spot something off, or know this place well? <button type="button" class="link-btn" data-feedback="${esc(c.name + " (" + plainName(d.name) + ")")}">Send feedback</button></div>
  `;
  $("#detailClose").onclick = closeDetail;
  const back = (e) => { e?.preventDefault(); openDetail(id, true); };
  $("#toParent").onclick = back; $("#parentCard").onclick = back;
  if (STORIES[id]) $("#readMore").onclick = () => openStory(id);
  el.querySelectorAll(".children li").forEach(li => li.onclick = () => openSub(id, +li.dataset.i));
}
// keep the target visible beside (desktop) or above (mobile) the detail panel
function panelPadding() {
  return window.innerWidth > 820 ? { right: 420, left: 0, top: 0, bottom: 0 } : { bottom: Math.round(window.innerHeight * 0.6), top: 0, left: 0, right: 0 };
}
function closeDetail() {
  state.selected = null;
  $("#detail").classList.add("hidden");
  markGroup(null);
  map.getSource("sel")?.setData({ type: "FeatureCollection", features: [] });
}

function renderDetail(id) {
  const d = BY_ID[id], s = snowOf(d), st = status(d), c = snowClass(s?.pctNormal);
  const inCmp = state.compare.some(x => x.id === id);
  const avyUrl = d.links?.avalanche || AVY_LINKS[d.country]?.[1];
  const avy = avyUrl ? [hostLabel(avyUrl), avyUrl] : null;
  const relLabel = s?.reliabilityCV == null ? "" : s.reliabilityCV < 0.2 ? "very consistent" : s.reliabilityCV < 0.3 ? "fairly consistent" : s.reliabilityCV < 0.4 ? "variable" : "very variable (boom or bust)";
  const el = $("#detail");
  el.classList.remove("hidden");
  el.innerHTML = `
    <div class="sticky-close"><button class="close" id="detailClose" aria-label="Close">×</button></div>
    <div class="d-type"><span class="dot" style="background:${CAT[d.category].color}"></span>${CAT[d.category].label}${subLabel(d) ? " · " + esc(subLabel(d)) : ""}${d.tags.includes("volcano") ? " · Volcano" : ""}${d.tags.includes("spring") ? " · Spring" : ""}${d.tags.includes("park") ? " · Park" : ""}</div>
    <h3>${esc(d.name)}</h3>
    ${d.tags.includes("offradar") ? `<div class="offradar">${OFFRADAR}</div>` : ""}
    <div class="muted" style="font-size:13px">${esc(d.region)}, ${esc(d.country)}</div>
    <p class="pitch">${esc(d.pitch)}</p>
    ${d.advisory ? `<div class="callout warn"><b>⚠ Travel advisory.</b> ${esc(d.advisory)}</div>` : ""}
    ${d.tags.includes("indoor") ? `<div class="callout"><b>Indoor slope.</b> Real snow under a roof, kept below freezing all year. It's a novelty stop rather than a ski trip: a few short runs, rental gear included, and a fun way to ski somewhere hot.</div>` : d.tags.includes("novelty") ? `<div class="callout"><b>Go for the place.</b> The location is the draw more than the skiing: expect a small area, a short or unreliable season, and weather that can cancel plans. Have a non-ski backup and treat good snow as a bonus.</div>` : ""}
    <div class="actions">
      <button class="btn primary" id="addCmp" ${inCmp || state.compare.length >= 6 ? "disabled" : ""}>${inCmp ? "In compare ✓" : "+ Compare"}</button>
      <button class="btn" id="zoomTo">Zoom to</button>
      ${STORIES[id] ? `<button class="btn" id="readMore">Read more →</button>` : ""}
    </div>

    <div class="section-title">${d.tags.includes("indoor") ? "Snow" : `This season · ${s?.season ?? ""}`}</div>
    ${staleNote(d) ? `<div class="callout"><b>Out of date.</b> ${staleNote(d)}</div>` : ""}
    <div class="snowcard">
      ${s ? `
      <div class="snow-head">
        <div><div class="hero" style="${st.live ? "" : "color:#8a8984"}">${s.pctNormal != null ? s.pctNormal + "%" : "–"}</div><div class="hero-sub">${st.live ? "of normal to date" : "of normal (final)"} ${info("pct")} ${c && st.live ? `<span class="badge"><i style="width:8px;height:8px;border-radius:50%;background:${c.color};display:inline-block"></i>${c.word}</span>` : ""}</div></div>
        <div class="hero-sub" style="flex:1">${rankText(s) ? `<b style="color:var(--text-primary)">${rankText(s, !st.live)}</b> ${info("rank")}<br>` : ""}<span class="badge">${esc(st.label)}</span> ${info("status")}<br>counting since ${fmtDay(s.seasonStart)} (day ${s.dayOfSeason})</div>
      </div>
      ${lowConfidence(s) ? `<div class="note">⚠ Early season: the normal to date is only ${s.normalToDate} cm, so the % swings a lot on one storm.</div>` : ""}
      <div class="stats">
        <div class="stat"><b>${s.toDate} cm</b><span>snowfall since ${fmtDay(s.seasonStart)} (normal ${s.normalToDate ?? "–"}) ${info("toDate")}</span></div>
        <div class="stat"><b>${s.last7} cm</b><span>last 7 days</span></div>
        <div class="stat"><b>${s.next7 ?? "–"} cm</b><span>forecast next 7 days ${info("next7")}</span></div>
        <div class="stat"><b>${s.snowDepth ?? "–"} cm</b><span>on the ground now (modelled) ${info("depth")}</span></div>
        <div class="stat"><b>${s.normalTotal ?? "–"} cm</b><span>typical full season ${info("normalTotal")}</span></div>
        <div class="stat"><b>${s.reliabilityCV != null ? "±" + Math.round(s.reliabilityCV * 100) + "%" : "–"}</b><span>season-to-season swing ${info("swing")}</span></div>
      </div>
      <div id="seasonChart" style="margin-top:10px"></div>
      <div class="note">Modelled snowfall (ECMWF 9 km via Open-Meteo) at ~${d.refElev} m. Data through ${fmtDate(s.dataThrough)}. Raw data: <a href="${rawUrl(d, s)}" target="_blank" rel="noopener">this season, daily ↗</a> · <a href="${fcUrl(d)}" target="_blank" rel="noopener">forecast ↗</a>. A 9 km model under-reads resort-reported totals, especially in Japan and coastal ranges, so trust the % and rank more than the cm.</div>`
      : d.tags.includes("indoor") ? `<p class="note">Indoor: the snow is made inside and kept below freezing, so there's no season to track. Open every day of the year.</p>`
      : `<p class="note">No snow data yet for this destination.</p>`}
    </div>

    <div class="section-title">When to go ${info("whenToGo")}</div>
    <div class="season-bar">${MONTHS.map((m, i) => `<div class="${isBest(d, i + 1) ? "best" : inSeason(d, i + 1) ? "in" : ""} ${state.months.includes(i + 1) ? "sel" : ""}">${m[0]}</div>`).join("")}</div>
    <div class="note" style="margin-top:4px">${d.tags.includes("indoor") ? "Open all year" : "Blue = in season · dark = best months · grey = off season"}</div>

    ${d.tags.includes("indoor") ? "" : `<div class="section-title">Typical weather by month ${info("weather")}</div>
    <div id="monthBars"></div>
    <div class="note">Average modelled snowfall (cm, bars) and mean temperature (°C), past ${s?.nSeasons ?? "–"} seasons. Hover for sunshine, wind and variability.${relLabel ? ` Season totals are <b>${relLabel}</b>.` : ""}${d.weather ? " " + esc(d.weather) : ""}</div>`}

    <div class="section-title">Essentials</div>
    <dl class="facts">
      <dt>Crowds ${info("crowds")}</dt><dd>${meter(d.crowds)} ${d.crowdNote ? `<div class="note" style="margin-top:2px">${esc(d.crowdNote)}</div>` : ""}</dd>
      <dt>Cost ${info("cost")}</dt><dd>${meter(d.cost, 5)}</dd>
      <dt>Guide ${info("guide")}</dt><dd>${esc(d.guide)}</dd>
      <dt>${d.slope ? "Slopes" : `Elevation ${info("elevation")}`}</dt><dd>${d.slope ? esc(d.slope) : `${d.elev[0]}–${d.elev[1]} m (${d.elev[1] - d.elev[0]} m vertical)`}</dd>
      <dt>Snowpack ${info("snowpack")}</dt><dd>${esc(d.snowpack)}</dd>
      <dt>Avalanche ${info("avalanche")}</dt><dd>${esc(d.avalanche)}${avy ? `<div class="note" style="margin-top:2px">Live bulletin: <a href="${avy[1]}" target="_blank" rel="noopener">${avy[0]} ↗</a></div>` : d.tags.includes("indoor") ? "" : `<div class="note" style="margin-top:2px">No official public forecast service: rely on guides.</div>`}</dd>
      ${d.pass.length ? `<dt>Pass ${info("pass")}</dt><dd>${d.pass.join(", ")} <span class="muted">(verify)</span></dd>` : ""}
      <dt>Getting there</dt><dd>${esc(d.airport)}</dd>
      <dt>Look it up ${info("lookAround")}</dt><dd>${[...mapLinks(d), searchLink(destSearch(d))].join(" · ")}</dd>
      ${d.links?.permits ? `<dt>Permits ${info("permits")}</dt><dd><a href="${d.links.permits.url}" target="_blank" rel="noopener">${esc(d.links.permits.label)} ↗</a></dd>` : ""}
      ${d.links?.website ? `<dt>Website</dt><dd><a href="${d.links.website}" target="_blank" rel="noopener">${hostLabel(d.links.website)} ↗</a></dd>` : ""}
      ${d.links?.huts ? `<dt>Huts ${info("huts")}</dt><dd><a href="${d.links.huts}" target="_blank" rel="noopener">${hostLabel(d.links.huts)} ↗</a></dd>` : ""}
    </dl>

    ${d.children ? `<div class="section-title">Areas &amp; trailheads ${info("areas")}</div>
    <ul class="children">${d.children.map((c, i) => `<li data-i="${i}"><span class="dot sm" style="background:${CAT[KID_KINDS[kidKind(c, d)].cat].color}"></span><div><b>${esc(c.name)}</b>${kidKind(c, d) === "bc" ? ` <span class="bc-tag">backcountry</span>` : ""}<div class="muted" style="font-size:12px">${esc(c.note)}</div></div><span class="chev" aria-hidden="true">›</span></li>`).join("")}</ul>` : ""}
    ${d.tours?.length ? `<div class="section-title">Notable tours ${info("tours")}</div>${toursList(d)}` : ""}
    <div class="fb-line">Spot something off, or know this place well? <button type="button" class="link-btn" data-feedback="${esc(plainName(d.name))}">Send feedback</button></div>
  `;
  $("#detailClose").onclick = closeDetail;
  $("#addCmp").onclick = () => addCompare(id);
  if (STORIES[id]) $("#readMore").onclick = () => openStory(id);
  $("#zoomTo").onclick = () => map.flyTo({ center: [d.lon, d.lat], zoom: d.children ? 8 : 9.5, padding: panelPadding() });
  el.querySelectorAll(".children li").forEach(li => li.onclick = () => openSub(id, +li.dataset.i));
  if (s) seasonChart($("#seasonChart"), s, "#0b0b0b");
  if ($("#monthBars")) monthBars($("#monthBars"), s?.climate, { months: state.months, best: d.best });
}

// ---------- compare ----------
function addCompare(id) {
  if (state.compare.some(x => x.id === id) || state.compare.length >= 6) return;
  const used = state.compare.map(x => x.slot);
  const slot = [0, 1, 2, 3, 4, 5].find(i => !used.includes(i));
  state.compare.push({ id, slot });
  refresh();
}
function renderTray() {
  const tray = $("#tray");
  tray.classList.toggle("hidden", !state.compare.length);
  $("#cmpCount").textContent = state.compare.length;
  const body = $("#trayBody");
  body.innerHTML = `<div class="tray-row">
    ${state.compare.map(x => `<span class="tchip"><i style="background:${SLOTS[x.slot]}"></i>${esc(BY_ID[x.id].name)}<button data-rm="${x.id}" aria-label="Remove ${esc(BY_ID[x.id].name)}">×</button></span>`).join("")}
    ${state.compare.length ? `<button class="btn primary" id="openCmp">Compare ${state.compare.length}</button><button class="btn" id="clrCmp">Clear</button>` : ""}
  </div>`;
  body.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { state.compare = state.compare.filter(x => x.id !== b.dataset.rm); refresh(); });
  $("#openCmp") && ($("#openCmp").onclick = openCompare);
  $("#clrCmp") && ($("#clrCmp").onclick = () => { state.compare = []; refresh(); });
  setTimeout(() => map?.resize(), 0);
}

// ---------- "More about this place" pages (linkable: #place/<id>) ----------
const richText = (t) => esc(t).split(/\n\s*\n/).map(p => `<p>${p.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>")}</p>`).join("");
const OFFRADAR = `<b>Off the radar.</b> Few travelling skiers have heard of it, but there's an official avalanche forecast here, a sign of a real local ski scene. Expect fewer services, less English-language information and more self-reliance. ${info("offradar")}`;
/** A photo with its credit. Photos are Wikimedia Commons files under free licences, shown with author and licence as they require. */
const photoFig = (p, cls = "") => `<figure class="photo ${cls}"><a href="${p.page}" target="_blank" rel="noopener"><img src="${p.src}" alt="${esc(p.alt)}" loading="lazy" /></a><figcaption>${esc(p.caption)} <span class="credit">Photo: ${esc(p.author)}, ${p.licenseUrl ? `<a href="${p.licenseUrl}" target="_blank" rel="noopener">${esc(p.license)}</a>` : esc(p.license)}, via <a href="${p.page}" target="_blank" rel="noopener">Wikimedia Commons</a></span></figcaption></figure>`;
function openStory(id, push = true) {
  const d = BY_ID[id], st = STORIES[id]; if (!d || !st) return;
  const mo = (m) => m.length ? m.map(x => MONTHS[x - 1]).join(", ") : "any month";
  const avy = d.links?.avalanche || AVY_LINKS[d.country]?.[1];
  const links = [d.links?.website && [hostLabel(d.links.website), d.links.website], avy && ["Avalanche forecast", avy],
    d.links?.permits && [d.links.permits.label, d.links.permits.url], d.links?.huts && ["Huts", d.links.huts]].filter(Boolean);
  $("#modalBody").innerHTML = `<article class="story">
    <div class="d-type"><span class="dot" style="background:${CAT[d.category].color}"></span>${CAT[d.category].label}${subLabel(d) ? " · " + esc(subLabel(d)) : ""}</div>
    <h2>${esc(d.name)}</h2>
    <div class="muted">${esc(d.region)}, ${esc(d.country)}</div>
    ${d.tags.includes("offradar") ? `<div class="offradar">${OFFRADAR}</div>` : ""}
    <p class="pitch">${esc(d.pitch)}</p>
    ${st.draft ? `<div class="callout"><b>Draft.</b> Not reviewed yet, and hidden on the live site.</div>` : ""}
    ${d.advisory ? `<div class="callout warn"><b>⚠ Travel advisory.</b> ${esc(d.advisory)}</div>` : ""}
    ${st.photos?.length ? photoFig(st.photos[0], "hero") : ""}
    <h3>The skiing</h3>${richText(st.skiing)}
    ${st.photos?.length > 1 ? photoFig(st.photos[1]) : ""}
    ${d.tours?.length ? `<h3>Notable tours</h3><p class="note" style="margin-top:0">Starting points for your own research: names to look up, not route descriptions.</p>${toursList(d)}` : ""}
    <h3>Beyond the skiing</h3>${richText(st.beyond)}
    ${st.photos?.length > 2 ? `<div class="photo-grid">${st.photos.slice(2).map(p => photoFig(p)).join("")}</div>` : ""}
    <h3>Good to know</h3>${richText(st.know)}
    <dl class="facts">
      <dt>Season</dt><dd>${d.tags.includes("indoor") ? "All year, indoors" : `${MONTHS[d.season[0] - 1]}–${MONTHS[d.season[1] - 1]} · best ${mo(d.best)}`}</dd>
      <dt>Cost ${info("cost")}</dt><dd>${meter(d.cost, 5)}</dd>
      <dt>Crowds ${info("crowds")}</dt><dd>${meter(d.crowds, 5)}</dd>
      <dt>Guide ${info("guide")}</dt><dd>${esc(d.guide)}</dd>
      <dt>Getting there</dt><dd>${esc(d.airport)}</dd>
    </dl>
    <div class="story-links">${[...links.map(([l, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(l)} ↗</a>`), searchLink(destSearch(d))].join(" · ")}</div>
    ${st.sources?.length ? `<div class="note">Sources: ${st.sources.map(x => `<a href="${x.url}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join(" · ")}</div>` : ""}
    <div class="note">This page describes what a place is like, not how to ski specific routes. Check current avalanche and travel conditions before you go.</div>
    <div class="fb-line">Spot something off, or know this place well? <button type="button" class="link-btn" data-feedback="${esc(plainName(d.name))}">Send feedback</button></div>
  </article>`;
  $("#modal").classList.add("story-mode"); $("#modal").classList.remove("hidden");
  $("#modal .modal-card").scrollTop = 0;
  if (push && location.hash !== `#place/${id}`) history.pushState(null, "", `#place/${id}`);
}
/** Feedback form (Tally), opened as a pop-up over the page. Its script loads only on the first click. */
const FEEDBACK_FORM = "LDK2Yv";
let tallyLoad = null;
function loadTally() {
  return tallyLoad ||= new Promise((ok, fail) => {
    const sc = document.createElement("script"); sc.src = "https://tally.so/widgets/embed.js";
    sc.onload = ok; sc.onerror = () => { tallyLoad = null; fail(); }; document.head.appendChild(sc);
  });
}
function openFeedback(place = "", btn = null) {
  const page = !$("#modal").classList.contains("hidden") && $("#modal").classList.contains("story-mode") ? "read-more"
    : !$("#detail").classList.contains("hidden") ? "detail" : "map";
  const hiddenFields = { place, page };
  const fallback = () => window.open(`https://tally.so/r/${FEEDBACK_FORM}?` + new URLSearchParams(hiddenFields), "_blank", "noopener");
  // the first open fetches Tally's script and the form, which takes a moment: say so on the button
  const label = btn?.textContent;
  if (btn) { btn.textContent = "Opening…"; btn.disabled = true; }
  const done = () => { if (btn) { btn.textContent = label; btn.disabled = false; } };
  setTimeout(done, 8000);
  loadTally().then(() => window.Tally ? window.Tally.openPopup(FEEDBACK_FORM, { layout: "modal", width: 460, overlay: true, hiddenFields, onOpen: done }) : (done(), fallback()))
    .catch(() => { done(); fallback(); });
}
/** About: the story behind the Wayward sites, in the reading layout used for stories */
function openAbout() {
  $("#modalBody").innerHTML = aboutHTML("ski");
  $("#modal").classList.add("story-mode"); $("#modal").classList.remove("hidden");
  $("#modal .modal-card").scrollTop = 0;
}
function closeModal() {
  $("#modal").classList.add("hidden"); $("#modal").classList.remove("story-mode");
  if (location.hash.startsWith("#place/")) history.pushState(null, "", location.pathname + location.search);
}
function routeFromHash() {
  const m = location.hash.match(/^#place\/([\w-]+)$/);
  if (m && BY_ID[m[1]] && STORIES[m[1]]) { if (state.selected !== m[1]) openDetail(m[1], true); openStory(m[1], false); }
  else if (m && BY_ID[m[1]]) { if (state.selected !== m[1]) openDetail(m[1], true); $("#modal").classList.add("hidden"); $("#modal").classList.remove("story-mode"); }
  else if (!$("#modal").classList.contains("hidden") && $("#modal").classList.contains("story-mode")) { $("#modal").classList.add("hidden"); $("#modal").classList.remove("story-mode"); }
}

function openCompare() {
  const items = state.compare.map(x => ({ d: BY_ID[x.id], s: snowOf(BY_ID[x.id]), color: SLOTS[x.slot] }));
  let mode = "pct";
  const m = state.months[0] || null;
  const monthOf = (it) => state.months.find(x => inSeason(it.d, x)) || m || it.d.best[0] || 1;
  const clim = (it) => it.s?.climate?.[monthOf(it)];
  const yMax = Math.max(1, ...items.flatMap(it => Object.values(it.s?.climate || {}).map(c => c.snow)));
  const row = (label, f) => `<tr><th>${label}</th>${items.map(it => `<td>${f(it)}</td>`).join("")}</tr>`;
  $("#modalBody").innerHTML = `
    <h2>Compare ${items.length} destinations</h2>
    <div class="muted" style="font-size:13px">Snow data through ${fmtDate(items[0]?.s?.dataThrough)}${m ? ` · travel months: <b>${monthsLabel()}</b>` : " · pick months in the sidebar to compare timing"}</div>
    <div class="cmp-grid">
      <div>
        <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">This season so far
          <span class="seg" id="cmpMode" style="margin:0;width:220px"><button data-v="pct" class="on">% of normal to date</button><button data-v="cm">cm</button></span></div>
        <div class="chart-legend">${items.map(it => `<span><i style="background:${it.color}"></i>${esc(it.d.name)}</span>`).join("")}</div>
        <div id="cmpChart"></div>
        <div class="note">x-axis = days since each place's season started (Oct 1 north, Apr 1 south), so hemispheres line up. "% of normal to date" is the same measure as in each detail panel: 100% (dashed line) = a typical season so far. Lines start once the normal reaches 10 cm, because before that one storm swings the % wildly.</div>
      </div>
      <div>
        <div class="section-title">Typical snowfall by month (same scale)</div>
        <div class="small-multiples">${items.map((it, i) => `<div class="sm"><h5><i style="background:${it.color}"></i>${esc(it.d.name)}</h5><div id="sm${i}"></div></div>`).join("")}</div>
      </div>
    </div>
    <table class="cmp-table">
      <thead><tr><th></th>${items.map(it => `<td><i style="background:${it.color}"></i>${esc(it.d.name)}</td>`).join("")}</tr></thead>
      <tbody>
        ${row("Type", it => `${CAT[it.d.category].label}${subLabel(it.d) ? "<br><span class='muted'>" + esc(subLabel(it.d)) + "</span>" : ""}`)}
        ${row("Where", it => `${esc(it.d.region)}, ${esc(it.d.country)}`)}
        ${row(`This season ${info("pct")}`, it => it.s ? `<b>${pctText(it.d)}</b>${status(it.d).live && lowConfidence(it.s) ? " <span class='muted'>(early)</span>" : ""}<br><span class="muted">${status(it.d).live ? rankText(it.s) : ""}</span>` : "–")}
        ${row(`Snowfall this season ${info("toDate")}`, it => it.s ? `${it.s.toDate} cm since ${fmtDay(it.s.seasonStart)} <span class="muted">(normal ${it.s.normalToDate ?? "–"})</span>` : "–")}
        ${row(`On the ground now ${info("depth")}`, it => it.s?.snowDepth != null ? `${it.s.snowDepth} cm <span class="muted">(modelled)</span>` : "–")}
        ${row(`Next 7 days ${info("next7")}`, it => it.s?.next7 != null ? `${it.s.next7} cm` : "–")}
        ${row(`Typical season total ${info("normalTotal")}`, it => it.s?.normalTotal != null ? `${it.s.normalTotal} cm <span class="muted">(modelled)</span>` : "–")}
        ${row(`Year-to-year swing ${info("swing")}`, it => it.s?.reliabilityCV != null ? `±${Math.round(it.s.reliabilityCV * 100)}%` : "–")}
        ${row(`Season / best ${info("whenToGo")}`, it => `${MONTHS[it.d.season[0] - 1]}–${MONTHS[it.d.season[1] - 1]} / <b>${it.d.best.map(b => MONTHS[b - 1]).join(", ") || "any month"}</b>`)}
        ${row((m ? `In ${monthsLabel()}` : "Timing fit") + " " + info("timing"), it => { const ft = fitText(it.d); return ft ? `<span class="${ft.cls}">● ${ft.text}</span>` : "<span class='muted'>pick months</span>"; })}
        ${row(`Weather in ${m ? "your months" : "best month"} ${info("weather")}`, it => { const c = clim(it); return c ? `${c.temp}°C · ${c.sun} h sun/day · ${c.snow} cm snow · wind ${c.wind} km/h <span class="muted">(${MONTHS[monthOf(it) - 1]})</span>` : "–"; })}
        ${row(`Elevation ${info("elevation")}`, it => it.d.slope ? esc(it.d.slope) : `${it.d.elev[0]}–${it.d.elev[1]} m<br><span class="muted">${it.d.elev[1] - it.d.elev[0]} m vertical</span>`)}
        ${row(`Snowpack ${info("snowpack")}`, it => esc(it.d.snowpack))}
        ${row(`Crowds ${info("crowds")}`, it => `${meter(it.d.crowds)}${it.d.crowdNote ? `<div class="note">${esc(it.d.crowdNote)}</div>` : ""}`)}
        ${row(`Cost ${info("cost")}`, it => meter(it.d.cost, 5))}
        ${row(`Guide ${info("guide")}`, it => esc(it.d.guide))}
        ${row(`Pass ${info("pass")}`, it => it.d.pass.join(", ") || "–")}
        ${items.some(it => it.d.advisory) ? row("Travel advisory", it => it.d.advisory ? `<span style="color:#a3341f">⚠ ${esc(it.d.advisory)}</span>` : "–") : ""}
        ${row("Getting there", it => esc(it.d.airport))}
        ${row("Links", it => [it.d.links?.website && `<a href="${it.d.links.website}" target="_blank" rel="noopener">website ↗</a>`, ...mapLinks(it.d, true), it.d.links?.permits && `<a href="${it.d.links.permits.url}" target="_blank" rel="noopener">permits ↗</a>`, (it.d.links?.avalanche || AVY_LINKS[it.d.country]) && `<a href="${it.d.links?.avalanche || AVY_LINKS[it.d.country][1]}" target="_blank" rel="noopener">avalanche ↗</a>`, it.d.links?.huts && `<a href="${it.d.links.huts}" target="_blank" rel="noopener">huts ↗</a>`].filter(Boolean).join(" · ") || "–")}
        ${row(`Avalanche ${info("avalanche")}`, it => `<span class="muted">${esc(it.d.avalanche)}</span>`)}
      </tbody>
    </table>`;
  const draw = () => compareLines($("#cmpChart"), items.map(it => ({ name: it.d.name, color: it.color, snow: it.s })), mode);
  draw();
  items.forEach((it, i) => monthBars($(`#sm${i}`), it.s?.climate, { compact: true, width: 200, height: 80, yMax, color: it.color, months: state.months }));
  $("#cmpMode").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; mode = b.dataset.v; $("#cmpMode").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); draw(); };
  $("#modal").classList.remove("hidden", "story-mode");
}

// ---------- boot ----------
async function boot() {
  const [dj, sj, stj] = await Promise.all([
    fetch("data/destinations.json").then(r => r.json()),
    fetch("data/snow.json").then(r => r.ok ? r.json() : { destinations: {} }).catch(() => ({ destinations: {} })),
    fetch("data/stories.json").then(r => r.ok ? r.json() : {}).catch(() => ({})),
  ]);
  DEST = dj.destinations; DEST.forEach(d => BY_ID[d.id] = d); SNOWDATA = sj; STORIES = stj; delete STORIES._about;
  // pages marked "draft" stay hidden on the live site until reviewed; add ?drafts to the URL to see them
  const showDrafts = new URLSearchParams(location.search).has("drafts");
  for (const k of Object.keys(STORIES)) if (STORIES[k].draft && !showDrafts) delete STORIES[k];
  ZONES = dj.zones || {}; MACROS = dj.macros || {};
  state.compare = state.compare.filter(x => BY_ID[x.id]);
  const gen = sj.generated ? new Date(sj.generated) : null;
  const through = Object.values(sj.destinations).map(s => s.dataThrough).filter(Boolean).sort().at(-1);
  const age = gen ? Math.floor((Date.now() - gen) / 864e5) : null;
  $("#asof").innerHTML = gen ? `Snow data through <b>${fmtDate(through)}</b>` : "No snow data yet: run scripts/update_snow.py";
  if (gen) $("#asof").title = `Last updated ${fmtDate(sj.generated)}`;
  if (age != null && age >= 4) {
    $("#asof").classList.add("stale");
    $("#asof").innerHTML += `<br>⚠ Not updated for ${age} days (it normally updates daily), so figures may be out of date.`;
  }
  renderControls(); bindControls(); initMap(); refresh();
  const infoAt = (el) => { const r = el.getBoundingClientRect(); showTip(DEFS[el.dataset.info] || "", r.right, r.top); };
  document.addEventListener("mouseover", (e) => { const el = e.target.closest?.("[data-info]"); if (el) infoAt(el); });
  document.addEventListener("mouseout", (e) => { if (e.target.closest?.("[data-info]")) hideTip(); });
  document.addEventListener("focusin", (e) => { const el = e.target.closest?.("[data-info]"); if (el) infoAt(el); });
  document.addEventListener("focusout", (e) => { if (e.target.closest?.("[data-info]")) hideTip(); });
  document.addEventListener("click", (e) => { const el = e.target.closest?.("[data-info]"); if (el) { e.stopPropagation(); infoAt(el); } }, true);
  $("#showAll").onclick = () => fitAll(true);
  document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-feedback]"); if (b) { e.preventDefault(); openFeedback(b.dataset.feedback, b); } });
  $("#siteLinks").innerHTML = siteLinksHTML("ski");
  document.addEventListener("click", (e) => { if (e.target.closest?.("[data-about]")) { e.preventDefault(); openAbout(); } });
  // start fetching Tally as soon as someone heads for a feedback link
  const warmTally = (e) => { if (e.target.closest?.("[data-feedback]")) loadTally().catch(() => {}); };
  document.addEventListener("pointerover", warmTally); document.addEventListener("focusin", warmTally);
  $("#modalClose").onclick = closeModal;
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("#modal").classList.contains("hidden")) closeModal(); else if ($("#sidebar").classList.contains("open")) { $("#sidebar").classList.remove("open"); document.body.classList.remove("sb-open"); } hideTip(); } });
  window.addEventListener("popstate", routeFromHash);
  window.addEventListener("hashchange", routeFromHash);
}
boot();
