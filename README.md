# Wayward Ski

*Ski trips worth the journey.* Live at https://waywardski.com

Early-stage ski-trip scoping: a world map of destinations you'd centre a trip around,
with "how is the season going" snow data, month-of-travel filtering and a compare view (up to 6).

## Run locally

```bash
python3 scripts/serve.py
```
(A plain `python3 -m http.server` works too, but the browser may cache old files.)
Then open http://localhost:8765.

## Files

| Path | What |
|---|---|
| `data/destinations.json` | The curated list. Edit it to add, remove or adjust places (field guide at the top of the file). |
| `data/snow.json` | Generated snow stats (don't hand-edit). |
| `data/cache/<id>/<year>.json` | Cached past seasons used for "normal". Never changes, so keep it. |
| `scripts/update_snow.py` | Builds `snow.json` (Python 3, standard library only). |
| `scripts/export_list.py` | Writes `destinations-list.md` / `.csv` for reading outside the app. |
| `scripts/serve.py` | Local server with caching disabled. |
| `index.html`, `js/`, `css/` | The app: static files plus MapLibre GL from a CDN, no build step. |

## Snow data: how "season so far" works

* Source: [Open-Meteo](https://open-meteo.com), ECMWF IFS 9 km archive (free, no key),
  sampled at each destination's `refElev`.
* Raw data for any destination: the detail panel links straight to the Open-Meteo API query it uses.
* **% of normal** = snowfall since season start (1 Oct north, 1 Apr south, 1 Jul Antarctica)
  ÷ the average to the same date over the last 8 complete seasons. **Rank** = where this season sits among them.
* **Absolute cm are modelled.** A 9 km model smooths terrain and under-reads resort-reported totals
  (it says Niseko averages ~280 cm against ~1,500 cm reported). % and rank are the robust signals.
* Refresh: `python3 scripts/update_snow.py`. The first full build needs about 18k API "units",
  more than the free 10k/day, so it may take two runs. The script resumes from the cache.

## Publishing (GitHub Pages + weekly refresh)

* Hosted on GitHub Pages from the `main` branch root; `CNAME` holds the custom domain.
* `.github/workflows/update-snow.yml` runs every day at 06:00 UTC (and on demand from the Actions tab), refreshes `data/snow.json` and commits it, which republishes the site.
* Open-Meteo's free API is for non-commercial use with attribution (see the footer credits).

## Older notes

Everything is static, so it can go on GitHub Pages, Netlify or Cloudflare Pages as is. The weekly refresh can become a
scheduled GitHub Action that runs `update_snow.py` and commits `data/snow.json`.
The layout already collapses to a drawer and bottom sheet on narrow screens.
