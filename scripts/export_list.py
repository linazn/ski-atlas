#!/usr/bin/env python3
"""Export data/destinations.json to a readable Markdown list and a CSV (for spreadsheets).

  python3 scripts/export_list.py   ->  destinations-list.md, destinations-list.csv
Re-run after editing destinations.json.
"""
import csv, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
CONTINENT = {
    "USA": "North America", "Canada": "North America", "Greenland": "North America",
    "Chile": "South America", "Argentina": "South America", "Antarctica": "Antarctica",
    "Japan": "Asia", "India": "Asia", "Kyrgyzstan": "Asia", "Kazakhstan": "Asia", "Russia": "Russia",
    "Australia": "Oceania", "New Zealand": "Oceania",
    "Georgia": "Caucasus & Middle East", "Turkey": "Caucasus & Middle East", "Iran": "Caucasus & Middle East", "Lebanon": "Caucasus & Middle East",
    "Morocco": "Africa & Mediterranean", "Spain / France": "Alps & Pyrenees", "Lesotho": "Africa & Mediterranean", "Greece": "Africa & Mediterranean",
    "Norway": "Scandinavia & Iceland", "Sweden": "Scandinavia & Iceland", "Iceland": "Scandinavia & Iceland",
}
ORDER = ["North America", "South America", "Antarctica", "Alps & Pyrenees", "Scandinavia & Iceland", "Africa & Mediterranean", "Caucasus & Middle East", "Russia", "Asia", "Oceania"]
CAT = {"resort": "Resort", "freeride": "Freeride", "touring": "Touring"}
LEVEL = {"all": "All levels / family", "advanced": "Known for advanced"}


def continent(d):
    if d["id"] in ("etna", "sierranevada"):
        return "Africa & Mediterranean"
    if d["id"] == "maunakea":
        return "Oceania"
    return CONTINENT.get(d["country"].split(" / ")[0], "Alps & Pyrenees")


def months(ms):
    return ", ".join(MONTHS[m - 1] for m in ms)


def style(d):
    if d["category"] == "resort":
        return LEVEL[d["level"]]
    return ", ".join(t for t in d["tags"]) or "-"


def main():
    with open(os.path.join(ROOT, "data", "destinations.json")) as f:
        dests = json.load(f)["destinations"]
    dests.sort(key=lambda d: (ORDER.index(continent(d)), d["country"], d["name"]))

    # CSV: one row per destination, all key fields
    with open(os.path.join(ROOT, "destinations-list.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Region", "Country", "Area", "Name", "Category", "Style / tags", "Season", "Best months",
                    "Base m", "Top m", "Crowds (1-5)", "Cost (1-4)", "Guide", "Snowpack", "Pass", "Getting there",
                    "Includes", "Pitch", "Website", "Avalanche forecast", "Huts", "Permits", "Travel advisory", "Lat", "Lon"])
        for d in dests:
            w.writerow([continent(d), d["country"], d["region"], d["name"], CAT[d["category"]], style(d),
                        f"{MONTHS[d['season'][0]-1]}-{MONTHS[d['season'][1]-1]}", months(d["best"]),
                        d["elev"][0], d["elev"][1], d["crowds"], d["cost"], d["guide"], d["snowpack"],
                        "; ".join(d["pass"]), d["airport"], "; ".join(c["name"] for c in d.get("children", [])),
                        d["pitch"], d.get("links", {}).get("website", ""), d.get("links", {}).get("avalanche", ""), d.get("links", {}).get("huts", ""), d.get("links", {}).get("permits", {}).get("url", ""), d.get("advisory", ""), d["lat"], d["lon"]])

    # Markdown: grouped by region, a table per region
    counts = {c: sum(1 for d in dests if d["category"] == c) for c in CAT}
    out = ["# Ski Atlas: destination list", "",
           f"{len(dests)} destinations: {counts['resort']} resort, {counts['freeride']} freeride, {counts['touring']} touring. "
           "Generated from `data/destinations.json` by `scripts/export_list.py`.", "",
           "Crowds 1 (empty) to 5 (lines). Cost 1 (budget) to 4 (very expensive). Season and best months are typical, not this year’s dates.", ""]
    for region in ORDER:
        rows = [d for d in dests if continent(d) == region]
        if not rows:
            continue
        out += [f"## {region} ({len(rows)})", "",
                "| Name | Country | Type | Style / tags | Best months | Crowds | Cost | Includes |",
                "|---|---|---|---|---|---|---|---|"]
        for d in rows:
            inc = "; ".join(c["name"] for c in d.get("children", []))
            out.append(f"| {d['name']} | {d['country']} | {CAT[d['category']]} | {style(d)} | {months(d['best'])} | {d['crowds']} | {d['cost']} | {inc} |")
        out.append("")
    with open(os.path.join(ROOT, "destinations-list.md"), "w") as f:
        f.write("\n".join(out))
    print(f"wrote destinations-list.md and destinations-list.csv ({len(dests)} destinations)")


if __name__ == "__main__":
    main()
