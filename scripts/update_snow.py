#!/usr/bin/env python3
"""
Build data/snow.json for Ski Atlas.

Source: Open-Meteo (free, no key). Model: ECMWF IFS 9 km archive (2017 -> yesterday),
plus the Open-Meteo forecast API for the last 10 / next 10 days (snow, rain, sun) and current modelled snow depth.

For each destination (at its refElev):
  * current season cumulative snowfall (season window start -> yesterday)
  * the last N completed seasons (cached on disk forever; they don't change)
  * normal-to-date, % of normal, rank vs past seasons, monthly climate profile

Free-tier quota is ~10k "call units"/day; one season of daily data ≈ 20 units/location.
Past seasons are cached under data/cache/, so the first full build can take 2 runs;
weekly refreshes after that are cheap (~5-20 units per location).

Usage:
  python3 scripts/update_snow.py            # current season + fill missing climatology
  python3 scripts/update_snow.py --no-clim  # current season only (fast)
  python3 scripts/update_snow.py --only lyngen,niseko
"""
import argparse, datetime as dt, json, math, os, statistics, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(DATA, "cache")
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
FORECAST = "https://api.open-meteo.com/v1/forecast"
MODEL = "ecmwf_ifs"
DAILY = "snowfall_sum,temperature_2m_mean,sunshine_duration,wind_speed_10m_max,precipitation_sum"
N_CLIM = 8  # past seasons used as "normal"
PAST_DAYS, AHEAD_DAYS = 10, 10  # weather strip window around today


class DailyLimit(Exception):
    pass


def window(d):
    """Season window as (start_month, start_day, end_month, end_day)."""
    if d["lat"] < -60:   # Antarctica: Jul 1 -> Feb 28 (wraps)
        return (7, 1, 2, 28)
    if d["lat"] < 0:     # Southern hemisphere: Apr 1 -> Nov 30
        return (4, 1, 11, 30)
    return (10, 1, 6, 30)  # Northern hemisphere: Oct 1 -> Jun 30 (wraps)


def season_dates(d, start_year):
    sm, sd, em, ed = window(d)
    start = dt.date(start_year, sm, sd)
    end = dt.date(start_year + (1 if em < sm else 0), em, ed)
    return start, end


def season_label(d, start_year):
    sm, _, em, _ = window(d)
    return f"{start_year}/{str(start_year + 1)[2:]}" if em < sm else str(start_year)


def current_start_year(d, today):
    sm, sd, _, _ = window(d)
    return today.year if (today.month, today.day) >= (sm, sd) else today.year - 1


def get(url, params, tries=4, timeout=30):
    q = url + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            with urllib.request.urlopen(q, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf8", "ignore")
            if e.code == 429:
                low = body.lower()
                if "daily" in low:
                    raise DailyLimit(body)
                wait = 3700 if "hourly" in low else 65
                print(f"  rate limited ({body.strip()[:80]}), sleeping {wait}s", flush=True)
                time.sleep(wait)
                continue
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))
    raise RuntimeError("unreachable")


def fetch_daily(d, start, end):
    js = get(ARCHIVE, {
        "latitude": d["lat"], "longitude": d["lon"], "elevation": d["refElev"],
        "start_date": start.isoformat(), "end_date": end.isoformat(),
        "daily": DAILY, "models": MODEL, "timezone": "auto",
    })
    return js["daily"]


def clean(xs):
    return [0.0 if v is None else float(v) for v in xs]


def cumulative(xs):
    out, s = [], 0.0
    for v in xs:
        s += 0.0 if v is None else v
        out.append(s)
    return out


def weekly(cum):
    """Sample a cumulative series every 7 days (index 0,7,14,...) and the last value."""
    pts = [round(cum[i], 1) for i in range(0, len(cum), 7)]
    if cum and (len(cum) - 1) % 7:
        pts.append(round(cum[-1], 1))
    return pts


def cache_path(did, year):
    return os.path.join(CACHE, did, f"{year}.json")


def load_cache(did, year):
    p = cache_path(did, year)
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    return None


def save_cache(did, year, daily):
    os.makedirs(os.path.join(CACHE, did), exist_ok=True)
    with open(cache_path(did, year), "w") as f:
        json.dump(daily, f)


def monthly_climate(seasons):
    """Average per calendar month across past seasons."""
    acc = {}
    for daily in seasons:
        per_year = {}
        for i, t in enumerate(daily["time"]):
            m = int(t[5:7])
            b = per_year.setdefault(m, {"snow": 0.0, "temp": [], "sun": [], "wind": [], "snowdays": 0, "days": 0})
            sf = daily["snowfall_sum"][i] or 0.0
            b["snow"] += sf
            b["snowdays"] += 1 if sf >= 5 else 0
            b["days"] += 1
            for k, src, f in (("temp", "temperature_2m_mean", 1), ("sun", "sunshine_duration", 1 / 3600), ("wind", "wind_speed_10m_max", 1)):
                v = daily[src][i]
                if v is not None:
                    b[k].append(v * f)
        for m, b in per_year.items():
            if b["days"] < 20:
                continue  # partial month at window edges
            a = acc.setdefault(m, {"snow": [], "temp": [], "sun": [], "wind": [], "snowdays": []})
            a["snow"].append(b["snow"])
            a["snowdays"].append(b["snowdays"])
            if b["temp"]: a["temp"].append(statistics.mean(b["temp"]))
            if b["sun"]: a["sun"].append(statistics.mean(b["sun"]))
            if b["wind"]: a["wind"].append(statistics.mean(b["wind"]))
    out = {}
    for m, a in sorted(acc.items()):
        mean_snow = statistics.mean(a["snow"])
        out[str(m)] = {
            "snow": round(mean_snow),
            "snowCV": round(statistics.pstdev(a["snow"]) / mean_snow, 2) if mean_snow > 1 and len(a["snow"]) > 1 else None,
            "snowDays": round(statistics.mean(a["snowdays"]), 1),
            "temp": round(statistics.mean(a["temp"]), 1) if a["temp"] else None,
            "sun": round(statistics.mean(a["sun"]), 1) if a["sun"] else None,
            "wind": round(statistics.mean(a["wind"])) if a["wind"] else None,
        }
    return out


def build_entry(d, today, cur_daily, clim, fc):
    y0 = current_start_year(d, today)
    start, end = season_dates(d, y0)
    cur = clean(cur_daily["snowfall_sum"]) if cur_daily else []
    cum = cumulative(cur)
    n = len(cum)
    to_date = cum[-1] if cum else 0.0

    past = []  # (label, cumulative list, total)
    for yr in sorted(clim):
        c = cumulative(clean(clim[yr]["snowfall_sum"]))
        past.append((season_label(d, yr), c, c[-1] if c else 0.0))

    e = {
        "season": season_label(d, y0),
        "seasonStart": start.isoformat(),
        "seasonEnd": end.isoformat(),
        "dataThrough": cur_daily["time"][-1] if cur_daily and cur_daily["time"] else None,
        "dayOfSeason": n,
        "toDate": round(to_date),
        "last7": round(sum(cur[-7:])) if cur else 0,
        "last30": round(sum(cur[-30:])) if cur else 0,
        "curve": weekly(cum),
        "nSeasons": len(past),
    }
    if fc:
        e["next7"] = fc.get("next7")
        e["snowDepth"] = fc.get("depth")
        e["forecastAsOf"] = fc.get("asof")
        if fc.get("wx"):
            e["wx"] = fc["wx"]
    if past and n:
        at = [p[1][min(n, len(p[1])) - 1] for p in past]
        normal = statistics.mean(at)
        e["normalToDate"] = round(normal)
        e["pctNormal"] = round(100 * to_date / normal) if normal >= 5 else None
        e["rank"] = 1 + sum(1 for v in at if v > to_date)  # 1 = best to date
        e["minToDate"], e["maxToDate"] = round(min(at)), round(max(at))
    if past:
        L = min(len(p[1]) for p in past)
        mean_curve = [statistics.mean(p[1][i] for p in past) for i in range(L)]
        e["normalCurve"] = weekly(mean_curve)
        e["minCurve"] = weekly([min(p[1][i] for p in past) for i in range(L)])
        e["maxCurve"] = weekly([max(p[1][i] for p in past) for i in range(L)])
        totals = [p[2] for p in past]
        e["normalTotal"] = round(statistics.mean(totals))
        e["seasonTotals"] = {p[0]: round(p[2]) for p in past}
        e["reliabilityCV"] = round(statistics.pstdev(totals) / statistics.mean(totals), 2) if statistics.mean(totals) > 0 and len(totals) > 1 else None
        e["climate"] = monthly_climate([clim[y] for y in sorted(clim)])
    return e


def write_output(dests, today, current, forecast, prev, args, out_path):
    result = {}
    for d in dests:
        y0 = current_start_year(d, today)
        clim = {}
        for back in range(1, N_CLIM + 1):
            c = load_cache(d["id"], y0 - back)
            if c is not None:
                clim[y0 - back] = c
        cur = current.get(d["id"])
        if cur is None and d["id"] in prev:
            result[d["id"]] = prev[d["id"]]  # keep last good value
            continue
        result[d["id"]] = build_entry(d, today, cur, clim, forecast.get(d["id"]))

    if args.only and prev:
        prev.update(result)
        result = prev

    out = {
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "source": "Open-Meteo, ECMWF IFS 9 km archive (modelled, at each destination's reference elevation)",
        "normalsFrom": f"last {N_CLIM} complete seasons",
        "destinations": result,
    }
    with open(out_path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {out_path} ({len(result)} destinations)", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-clim", action="store_true", help="skip fetching missing past seasons")
    ap.add_argument("--only", default="", help="comma-separated destination ids")
    ap.add_argument("--pause", type=float, default=1.5, help="seconds between archive calls")
    ap.add_argument("--budget", type=float, default=0, help="stop fetching after this many minutes (0 = no limit)")
    args = ap.parse_args()
    t0 = time.monotonic()

    def over_budget():
        return args.budget and (time.monotonic() - t0) > args.budget * 60

    with open(os.path.join(DATA, "destinations.json")) as f:
        dests = json.load(f)["destinations"]
    # indoor slopes have no weather-driven season to track
    dests = [d for d in dests if "indoor" not in d.get("tags", [])]
    if args.only:
        keep = set(args.only.split(","))
        dests = [d for d in dests if d["id"] in keep]

    today = dt.date.today()
    yesterday = today - dt.timedelta(days=1)
    out_path = os.path.join(DATA, "snow.json")
    prev = {}
    if os.path.exists(out_path):
        with open(out_path) as f:
            prev = json.load(f).get("destinations", {})

    # 1) Current season + forecast (cheap, always)
    current, forecast = {}, {}
    forecast_fails = 0
    for i, d in enumerate(dests):
        y0 = current_start_year(d, today)
        start, end = season_dates(d, y0)
        stop = min(yesterday, end)
        print(f"[{i+1}/{len(dests)}] current {d['id']} {start}..{stop}", flush=True)
        if over_budget():
            print("Time budget used up during current-season fetch; keeping last values for the rest.")
            break
        try:
            current[d["id"]] = fetch_daily(d, start, stop) if stop >= start else None
        except DailyLimit as e:
            print("Daily API limit reached during current-season fetch:", e)
            break
        except Exception as e:
            print("  season fetch failed:", e)
        # The forecast is a separate API; if it is down, keep last week's values and stop asking.
        if forecast_fails < 3:
            try:
                # 10 days back + today + 10 ahead, for the strip in the detail panel
                fj = get(FORECAST, {"latitude": d["lat"], "longitude": d["lon"], "elevation": d["refElev"],
                                    "daily": "snowfall_sum,rain_sum,sunshine_duration", "current": "snow_depth",
                                    "past_days": PAST_DAYS, "forecast_days": AHEAD_DAYS + 1,
                                    "timezone": "auto"}, tries=2, timeout=20)
                sd = (fj.get("current") or {}).get("snow_depth")
                dd = fj["daily"]
                snow = [round(v or 0, 1) for v in dd["snowfall_sum"]]
                forecast[d["id"]] = {"next7": round(sum(snow[PAST_DAYS:PAST_DAYS + 7])),
                                     "depth": round(sd * 100) if sd is not None else None,
                                     "asof": today.isoformat(),
                                     "wx": {"start": dd["time"][0], "today": PAST_DAYS, "snow": snow,
                                            "rain": [round(v or 0, 1) for v in dd["rain_sum"]],
                                            "sun": [round((v or 0) / 3600, 1) for v in dd["sunshine_duration"]]}}
                forecast_fails = 0
            except DailyLimit as e:
                print("Daily API limit reached during forecast fetch:", e)
                break
            except Exception as e:
                forecast_fails += 1
                print("  forecast failed:", e)
                if forecast_fails == 3:
                    print("  forecast API looks down; skipping it for the rest of this run")
        if d["id"] not in forecast and d["id"] in prev:
            p = prev[d["id"]]
            forecast[d["id"]] = {"next7": p.get("next7"), "depth": p.get("snowDepth"), "wx": p.get("wx"),
                                 "asof": p.get("forecastAsOf") or (p.get("dataThrough") and
                                         (dt.date.fromisoformat(p["dataThrough"]) + dt.timedelta(days=1)).isoformat())}
        time.sleep(args.pause)

    write_output(dests, today, current, forecast, prev, args, out_path)

    # 2) Climatology: round-robin by season (most recent first) so every place gets usable normals early
    if not args.no_clim:
        fetched = 0
        try:
            for back in range(1, N_CLIM + 1):
                for d in dests:
                    yr = current_start_year(d, today) - back
                    if load_cache(d["id"], yr) is not None:
                        continue
                    if over_budget():
                        raise TimeoutError("time budget used up")
                    s, e = season_dates(d, yr)
                    print(f"clim {d['id']} {season_label(d, yr)}", flush=True)
                    try:
                        save_cache(d["id"], yr, fetch_daily(d, s, e))
                        fetched += 1
                        if fetched % 40 == 0:
                            write_output(dests, today, current, forecast, prev, args, out_path)
                    except DailyLimit:
                        raise
                    except Exception as ex:
                        print("  failed:", ex)
                    time.sleep(args.pause)
        except DailyLimit as e:
            print("Daily API limit reached: climatology will continue on the next run.", e)
        except TimeoutError:
            print("Time budget used up: climatology will continue on the next run.")

    write_output(dests, today, current, forecast, prev, args, out_path)


if __name__ == "__main__":
    main()
