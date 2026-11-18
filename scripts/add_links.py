#!/usr/bin/env python3
"""Merge scripts/links_data.py into data/destinations.json (adds "links" per destination and "url" per child)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from links_data import L, AVY, PERMITS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "data", "destinations.json")
j = json.load(open(p))
for d in j["destinations"]:
    if d["id"] not in L:
        continue  # added later with links written directly into destinations.json: keep them
    v = L[d["id"]]
    links = {}
    if v.get("site"): links["website"] = v["site"]
    if v.get("avy"): links["avalanche"] = AVY[v["avy"]]
    if v.get("huts"): links["huts"] = v["huts"]
    if d["id"] in PERMITS: links["permits"] = {"url": PERMITS[d["id"]][0], "label": PERMITS[d["id"]][1]}
    if links: d["links"] = links
    else: d.pop("links", None)
    for c, u in zip(d.get("children", []), v.get("kids", [])):
        c["url"] = u
    if v.get("kids") and len(v["kids"]) != len(d.get("children", [])):
        print("child count mismatch:", d["id"])
lines = ['{', '  "_about": ' + json.dumps(j["_about"], ensure_ascii=False) + ',', '  "macros": ' + json.dumps(j["macros"], ensure_ascii=False) + ',', '  "zones": {',
         ",\n".join(f'    "{z}": ' + json.dumps(v, ensure_ascii=False) for z, v in j["zones"].items()), '  },', '  "destinations": [',
         ",\n".join("    " + json.dumps(d, ensure_ascii=False) for d in j["destinations"]), '  ]', '}']
open(p, "w").write("\n".join(lines) + "\n")
n = sum(1 for d in j["destinations"] if d.get("links"))
print(f"links on {n}/{len(j['destinations'])} destinations; child urls: {sum(1 for d in j['destinations'] for c in d.get('children', []) if c.get('url'))}")
