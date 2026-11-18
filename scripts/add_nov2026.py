#!/usr/bin/env python3
"""One-off: Nov 2026 additions agreed in notes/review-2026-11.md.
New destinations, sub-spots, 5-step cost scale, 'traverse' tag, backcountry sub-spots on resorts.
Idempotent: safe to rerun."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "data", "destinations.json")
J = json.load(open(P))
D = {d["id"]: d for d in J["destinations"]}

# ---------- zones ----------
J["macros"]["alps"] = "Alps & Europe"
J["zones"]["himalaya"]["name"] = "Kashmir & Himachal"
J["zones"]["caucasus"]["name"] = "Caucasus"
J["zones"].update({
    "nepal": {"name": "Nepal", "macro": "casia"},
    "pamir": {"name": "Pamir & Karakoram", "macro": "casia"},
    "altai": {"name": "Altai (China & Mongolia)", "macro": "casia"},
    "turkey": {"name": "Türkiye", "macro": "casia"},
    "balkans": {"name": "Balkans", "macro": "alps"},
    "scotland": {"name": "Scotland", "macro": "alps"},
    "northandes": {"name": "Ecuador", "macro": "andes"},
    "arcticcanada": {"name": "Baffin Island", "macro": "arctic"},
})
J["macros"]["arctic"] = "Arctic: Iceland, Greenland, Svalbard & Baffin"
D["kackar"]["zone"] = "turkey"

XINJIANG = ("Xinjiang has pervasive police checkpoints and surveillance; border areas (including Hemu/Kanas and the Pamir) "
            "need extra permits, and some travellers also weigh the region's human-rights situation. Check your government's travel advice.")

def dest(**k):
    base = {"pass": [], "children": [], "links": {}}
    base.update(k)
    if not base["children"]:
        del base["children"]
    return base

NEW = [
    # ----- expeditions & crossings -----
    dest(id="baffin", name="Baffin Island (Clyde River & Sam Ford Fjord)", category="touring", tags=["expedition"],
         country="Canada", region="Nunavut", zone="arcticcanada", lat=70.55, lon=-70.2, elev=[0, 1500], refElev=500,
         season=[4, 6], best=[4, 5], snowpack="high arctic", crowds=1, crowdNote="A handful of teams each spring.",
         cost=5, guide="required", airport="Clyde River (YCY) via Iqaluit",
         pitch="Big-wall fjords and 1,000 m couloirs straight off the sea ice, from tent camps reached by Inuit-run snowmobile.",
         avalanche="No forecast service; cold, dry high-arctic snowpack. Self-reliance and polar-bear protection required.",
         weather="Very cold in April, milder in May; 24-hour daylight by mid-May.",
         links={"website": "https://travelnunavut.ca"}),
    dest(id="denali", name="Denali & Ruth Gorge", category="touring", tags=["expedition"],
         country="USA", region="Alaska Range", zone="alaska", lat=63.07, lon=-151.0, elev=[2200, 6190], refElev=2300,
         season=[4, 7], best=[5, 6], snowpack="continental high alpine", crowds=2,
         crowdNote="Busy West Buttress camps in late May; Ruth Gorge is quiet.",
         cost=5, guide="recommended", airport="Anchorage (ANC), then Talkeetna air taxi",
         pitch="North America's highest peak, guided on skis since 2022, or glacier ski touring under the granite walls of Ruth Gorge.",
         avalanche="No public forecast; glacier travel and crevasse rescue skills essential.",
         weather="Extreme cold and wind high up; storms can pin teams for days.",
         children=[{"name": "Ruth Gorge (Sheldon Amphitheater)", "lat": 62.96, "lon": -150.76,
                    "note": "Glacier ski touring from a fly-in base camp.", "kind": "bc"}],
         links={"permits": {"url": "https://www.nps.gov/dena/planyourvisit/mountaineering.htm", "label": "Denali mountaineering (NPS)"}}),
    dest(id="mera", name="Mera Peak", category="touring", tags=["expedition"],
         country="Nepal", region="Khumbu / Hinku", zone="nepal", lat=27.71, lon=86.87, elev=[5000, 6476], refElev=5400,
         season=[10, 5], best=[4, 5, 10], snowpack="high-altitude dry", crowds=2,
         crowdNote="A popular trekking peak; skiers are few.",
         cost=3, guide="required", airport="Kathmandu (KTM), then Lukla",
         pitch="The Himalaya's classic ski objective: a gentle glacier from 6,476 m with Everest, Lhotse and Makalu on the horizon.",
         avalanche="No forecast service; guides manage glacier and altitude risk.",
         weather="Cold, dry and stable in the pre- and post-monsoon windows.",
         links={"permits": {"url": "https://www.nepalmountaineering.org", "label": "Peak permits (Nepal Mountaineering Assoc.)"}}),
    dest(id="annapurna", name="Annapurna Sanctuary", category="touring", tags=["expedition", "daytour"],
         country="Nepal", region="Gandaki", zone="nepal", lat=28.53, lon=83.88, elev=[3700, 5500], refElev=4200,
         season=[1, 4], best=[2, 3], snowpack="high-altitude, monsoon-fed", crowds=1,
         crowdNote="Trekkers on the trail; nobody on skis.",
         cost=3, guide="required", airport="Pokhara (PKR)",
         pitch="Ski touring inside a ring of 7,000 and 8,000 m peaks from the lodges at Annapurna Base Camp.",
         avalanche="No forecast service; the sanctuary approach is notorious for avalanche paths.",
         weather="Cold clear mornings, afternoon cloud; late-winter snow.",
         links={}),
    dest(id="muztagh", name="Muztagh Ata", category="touring", tags=["expedition"],
         country="China", region="Xinjiang (Pamir)", zone="pamir", lat=38.28, lon=75.12, elev=[4450, 7546], refElev=5300,
         season=[6, 8], best=[7], snowpack="high-altitude continental", crowds=2,
         crowdNote="A few commercial teams each July.",
         cost=3, guide="required", airport="Kashgar (KHG)",
         pitch="The 7,546 m 'father of ice mountains': the classic first 7,000 m peak to ski, with a broad glacier from near the summit.",
         avalanche="No forecast service; high-altitude glacier travel.",
         weather="Thin air, strong sun, sudden storms; summer is the stable window.",
         advisory=XINJIANG, links={}),
    dest(id="ecuador", name="Ecuador's Volcanoes (Cayambe, Cotopaxi, Chimborazo)", category="touring",
         tags=["expedition", "volcano"], country="Ecuador", region="Avenue of the Volcanoes", zone="northandes",
         lat=-0.68, lon=-78.44, elev=[4500, 6263], refElev=5000, season=[1, 12], best=[11, 12, 1], snowpack="equatorial glacier",
         crowds=2, crowdNote="Climbers on the standard routes; few skiers.",
         cost=3, guide="required", airport="Quito (UIO)",
         pitch="Ski glaciated volcanoes on the equator, ending on Chimborazo: the point on Earth farthest from its centre.",
         avalanche="No forecast service; rime ice, crevasses and quick melt-freeze cycles.",
         weather="Equatorial: no real seasons, but drier windows; altitude is the challenge.",
         children=[{"name": "Cayambe", "lat": 0.03, "lon": -77.99, "note": "5,790 m, right on the equator."},
                   {"name": "Cotopaxi", "lat": -0.68, "lon": -78.44, "note": "5,897 m; access depends on volcanic activity."},
                   {"name": "Chimborazo", "lat": -1.47, "lon": -78.82, "note": "6,263 m; farthest point from Earth's centre."}],
         links={"website": "https://aseguim.org"}),
    dest(id="ararat", name="Mount Ararat", category="touring", tags=["expedition", "volcano"],
         country="Türkiye", region="Ağrı", zone="turkey", lat=39.70, lon=44.30, elev=[2200, 5137], refElev=3800,
         season=[2, 5], best=[3, 4], snowpack="continental high plateau", crowds=1, crowdNote="Very few ski parties.",
         cost=2, guide="required", airport="Ağrı (AJI) or Van (VAN)",
         pitch="Ski the 5,137 m volcano where Noah's Ark is said to rest, with mule support to camp and views into Iran and Armenia.",
         avalanche="No forecast service; open, mostly moderate slopes.",
         weather="Cold, windy summit days; best snow March–April.",
         advisory="Ararat is a military border zone: a climbing permit through a licensed Turkish agency is required and takes weeks. Check your government's advice for eastern Türkiye.",
         links={}),
    dest(id="patagoniaicefield", name="Southern Patagonian Ice Field", category="touring",
         tags=["expedition", "traverse"], country="Argentina / Chile", region="Santa Cruz / Magallanes", zone="patagonia",
         lat=-49.15, lon=-73.25, elev=[1000, 2000], refElev=1400, season=[9, 12], best=[10, 11], snowpack="maritime ice cap",
         crowds=1, crowdNote="Remote; you will see your own team.",
         cost=3, guide="required", airport="El Calafate (FTE), then El Chaltén",
         pitch="Ski onto the largest ice field outside the poles, under the east faces of Fitz Roy and Cerro Torre.",
         avalanche="No forecast service; glacier travel and storm-proof camping essential.",
         weather="Infamous wind and storms; good-weather windows are short and precious.",
         links={"website": "https://www.argentina.gob.ar/parquesnacionales/losglaciares"}),
    dest(id="greenlandcrossing", name="Greenland Ice Cap Crossing", category="touring", tags=["expedition", "traverse"],
         country="Greenland", region="Inland ice", zone="greenland", lat=65.6, lon=-42.0, elev=[0, 2700], refElev=2300,
         season=[4, 9], best=[4, 5, 8], snowpack="polar ice cap", crowds=1, crowdNote="A few dozen teams a year.",
         cost=5, guide="recommended", airport="Kulusuk (KUS) or Kangerlussuaq (SFJ)",
         pitch="The classic polar journey: about 550 km and four weeks pulling a sled across the ice cap, coast to coast.",
         avalanche="Not an avalanche trip; crevasses near the coasts, piteraq storms and cold injury are the risks.",
         weather="−30 °C nights in spring; katabatic storms.",
         links={}),
    dest(id="vatnajokull", name="Vatnajökull Crossing", category="touring", tags=["expedition", "traverse"],
         country="Iceland", region="Vatnajökull National Park", zone="iceland", lat=64.42, lon=-16.8, elev=[600, 2110],
         refElev=1500, season=[3, 5], best=[4, 5], snowpack="maritime ice cap", crowds=1, crowdNote="A few guided groups each spring.",
         cost=3, guide="recommended", airport="Keflavík (KEF)",
         pitch="Europe's largest ice cap on skis: a week-plus pulling sleds over volcanoes buried under the ice.",
         avalanche="Low avalanche exposure; crevasses, whiteout and storms are the risks.",
         weather="Fast-moving Atlantic storms; long spring days.",
         links={"website": "https://www.vatnajokulsthjodgardur.is/en"}),
    dest(id="sarek", name="Sarek", category="touring", tags=["expedition", "traverse"],
         country="Sweden", region="Lapland (Laponia)", zone="arcticscandi", lat=67.30, lon=17.70, elev=[500, 2089], refElev=900,
         season=[2, 5], best=[3, 4], snowpack="arctic continental", crowds=1, crowdNote="Roadless and hutless: true solitude.",
         cost=2, guide="optional", airport="Kiruna (KRN) or Gällivare (GEV)",
         pitch="Sweden's wildest park: no huts, no roads, no trails, a week of tent and sled touring among glaciated peaks.",
         avalanche="Swedish avalanche forecasts cover nearby areas; steep valley sides.",
         weather="Cold and windy; March–April brings light and stable days.",
         links={"website": "https://laponia.nu/en/", "avalanche": "https://www.lavinprognoser.se/en"}),
    # ----- China & emerging -----
    dest(id="altay", name="Altay: Jikepulin-Hemu", category="freeride", tags=["novelty"],
         country="China", region="Xinjiang (Altai)", zone="altai", lat=48.57, lon=87.47, elev=[1380, 2848], refElev=1900,
         season=[11, 4], best=[1, 2, 3], snowpack="cold continental (very dry)", crowds=2,
         crowdNote="Growing fast domestically; still quiet midweek.",
         cost=2, guide="optional", airport="Kanas (KJI) or Altay (AAT)",
         pitch="Bone-dry powder in the hills that claim to be the birthplace of skiing, beside a Tuvan log-cabin village.",
         avalanche="Resort patrol closes high-risk zones; no public regional forecast.",
         weather="Very cold (−20 °C common); light, cold smoke snow.",
         advisory=XINJIANG,
         children=[{"name": "Jikepulin (Hemu)", "lat": 48.58, "lon": 87.50, "note": "1,466 m vertical; Freeride World Tour qualifier venue."},
                   {"name": "Koktokay", "lat": 47.21, "lon": 89.79, "note": "Big, steep resort near Fuyun."},
                   {"name": "Jiangjunshan", "lat": 47.86, "lon": 88.12, "note": "Town hill above Altay city; ancient ski rock art nearby."}],
         links={}),
    dest(id="erciyes", name="Erciyes & Cappadocia", category="resort", level="all", tags=["volcano", "novelty"],
         country="Türkiye", region="Kayseri", zone="turkey", lat=38.53, lon=35.47, elev=[2150, 3400], refElev=2600,
         season=[12, 4], best=[1, 2, 3], snowpack="continental volcanic", crowds=2, crowdNote="Busy on Turkish holidays only.",
         cost=1, guide="optional", airport="Kayseri (ASR), 30 min",
         pitch="Ski an extinct 3,917 m volcano by day and sleep in a Cappadocian cave hotel among the balloons.",
         avalanche="Resort controlled; off-piste on open volcano slopes.",
         weather="Sunny, dry continental winters.",
         links={"website": "https://www.kayserierciyes.com.tr"}),
    dest(id="uzbekistan", name="Amirsoy & Chimgan", category="resort", level="all", tags=["heli", "novelty"],
         country="Uzbekistan", region="Tashkent region (Western Tian Shan)", zone="tianshan", lat=41.51, lon=70.03,
         elev=[1600, 2290], refElev=2000, season=[12, 3], best=[1, 2], snowpack="continental", crowds=2,
         crowdNote="Weekend crowds from Tashkent; quiet midweek.",
         cost=1, guide="optional", airport="Tashkent (TAS), 90 min",
         pitch="New lifts and old Soviet runs in the Tian Shan, 90 minutes from Tashkent and a train ride from Samarkand.",
         avalanche="No public forecast; off-piste and heli days with local guides.",
         weather="Continental, sunny; short season.",
         children=[{"name": "Amirsoy", "lat": 41.49, "lon": 70.01, "note": "Modern resort opened 2019.", "url": "https://amirsoy.com"},
                   {"name": "Chimgan & Beldersay", "lat": 41.55, "lon": 70.07, "note": "Soviet-era lifts; heli-ski base."}],
         links={"website": "https://amirsoy.com"}),
    dest(id="popova", name="Popova Šapka Cat Skiing", category="touring", tags=["cat"],
         country="North Macedonia", region="Šar Mountains", zone="balkans", lat=42.01, lon=20.88, elev=[1700, 2700], refElev=2000,
         season=[12, 3], best=[1, 2], snowpack="continental", crowds=1, crowdNote="Small groups, big terrain.",
         cost=1, guide="required", airport="Skopje (SKP), 1 h",
         pitch="Europe's oldest cat-skiing operation, in the wild Šar Mountains above a small Balkan resort.",
         avalanche="No public forecast; operators manage terrain.",
         weather="Balkan winter: storms from the Adriatic, then sun.",
         links={}),
    dest(id="pirin", name="Pirin & Bansko", category="touring", tags=["daytour", "huts"],
         country="Bulgaria", region="Pirin National Park", zone="balkans", lat=41.77, lon=23.40, elev=[1000, 2914], refElev=2000,
         season=[12, 4], best=[2, 3], snowpack="continental", crowds=2, crowdNote="Bansko is lively; the tours are quiet.",
         cost=1, guide="recommended", airport="Sofia (SOF), 2.5 h",
         pitch="Alpine limestone peaks up to 2,914 m Vihren above a cheap, lively resort town: tour by day, lifts as backup.",
         avalanche="Bulgarian mountain rescue publishes avalanche info; marble and limestone slabs.",
         weather="Mediterranean-influenced: big snows, then sunny spells.",
         children=[{"name": "Bansko ski area", "lat": 41.80, "lon": 23.45, "note": "75 km of pistes; the backup for stormy days.", "url": "https://www.banskoski.com"}],
         links={}),
    dest(id="julianalps", name="Julian Alps (Kanin & Triglav)", category="touring", tags=["daytour", "huts"],
         country="Slovenia", region="Triglav National Park", zone="eastalps", lat=46.37, lon=13.65, elev=[500, 2864], refElev=1800,
         season=[12, 4], best=[2, 3], snowpack="maritime-influenced", crowds=2, crowdNote="Busy weekends with locals.",
         cost=2, guide="recommended", airport="Ljubljana (LJU) or Venice (VCE)",
         pitch="Limestone karst peaks above emerald rivers: day tours from Kanin's lifts and a hut traverse around Triglav.",
         avalanche="Slovenian forecast (ARSO); limestone gullies and cornices.",
         weather="Big Adriatic storms; sunny clear spells.",
         children=[{"name": "Kanin – Sella Nevea", "lat": 46.36, "lon": 13.48, "note": "Cross-border lift access to high karst terrain."},
                   {"name": "Triglav traverse", "lat": 46.38, "lon": 13.84, "note": "Hut-to-hut circuit around Slovenia's highest peak.", "kind": "bc"}],
         links={"website": "https://www.soca-valley.com/en/in-search-of-adventure/activities/winter-activities/2021020214013271/ski-touring/",
                "avalanche": "https://meteo.arso.gov.si/met/en/app/webmet/"}),
    dest(id="corsica", name="Corsica: Alta Strada", category="touring", tags=["huts", "traverse", "novelty"],
         country="France", region="Corsica", zone="medislands", lat=42.25, lon=9.05, elev=[1000, 2706], refElev=1800,
         season=[1, 5], best=[3], snowpack="Mediterranean maritime", crowds=1, crowdNote="A few guided groups per season.",
         cost=2, guide="recommended", airport="Bastia (BIA) or Ajaccio (AJA)",
         pitch="The GR20 on skis: a week-long haute route along the granite spine of a Mediterranean island, with sea views.",
         avalanche="Météo-France bulletin for Corsica; variable cover year to year.",
         weather="Snow comes and goes fast; March is usually best.",
         links={"website": "https://www.visit-corsica.com/en/Best-offers-and-trip-ideas/As-your-wishes-dictate/Alta-Strada-ski-touring-on-the-GR20-with-Altre-Cime",
                "avalanche": "https://meteofrance.com/meteo-montagne"}),
    dest(id="maira", name="Valle Maira", category="touring", tags=["daytour"],
         country="Italy", region="Piedmont (Cuneo)", zone="westalps", lat=44.48, lon=6.98, elev=[1000, 3100], refElev=1900,
         season=[12, 4], best=[2, 3], snowpack="intermountain", crowds=2, crowdNote="Popular with Europeans, but spread across hundreds of tours.",
         cost=2, guide="optional", airport="Turin (TRN), 2 h",
         pitch="An Occitan valley with no lifts and hundreds of mapped tours, stone hamlets and some of the best food in the Alps.",
         avalanche="Piedmont regional bulletin (Arpa Piemonte).",
         weather="Southern Alps: sunnier than the north side, snow from Mediterranean storms.",
         links={"website": "https://vallemaira.org/en/ski-mountaineering", "avalanche": "https://bollettini.aineva.it"}),
    dest(id="hunza", name="Hunza & Naltar", category="touring", tags=["daytour", "expedition"],
         country="Pakistan", region="Gilgit-Baltistan", zone="pamir", lat=36.24, lon=74.42, elev=[2000, 5000], refElev=3000,
         season=[12, 4], best=[2, 3], snowpack="continental high alpine", crowds=1, crowdNote="Almost no foreign skiers.",
         cost=2, guide="required", airport="Gilgit (GIL) or Islamabad (ISB) + Karakoram Highway",
         pitch="Ski touring under 7,000 m Karakoram giants, with Hunza's apricot-orchard villages and legendary hospitality.",
         avalanche="No public forecast; big terrain, local guides essential.",
         weather="Cold, dry winters; flights to Gilgit are weather-dependent.",
         advisory="Several governments advise against travel to parts of Pakistan; Gilgit-Baltistan is generally treated differently from border regions. Check your government's current advice and use a registered local operator.",
         children=[{"name": "Naltar ski area", "lat": 36.16, "lon": 74.18, "note": "Small lift area run by the Pakistan Air Force; touring above."},
                   {"name": "Hunza (Karimabad)", "lat": 36.32, "lon": 74.66, "note": "Village base for touring in the valley."}],
         links={}),
    dest(id="mongoliaaltai", name="Altai Tavan Bogd", category="touring", tags=["daytour", "expedition"],
         country="Mongolia", region="Bayan-Ölgii", zone="altai", lat=49.15, lon=87.82, elev=[2500, 4374], refElev=3000,
         season=[1, 6], best=[3, 4, 5], snowpack="cold continental", crowds=1, crowdNote="Kazakh herders and eagle hunters; few skiers.",
         cost=2, guide="required", airport="Ölgii (ULG) via Ulaanbaatar",
         pitch="Yurt-based ski touring on Mongolia's highest glaciers, hosted by Kazakh eagle-hunting families.",
         avalanche="No forecast service; glacier travel.",
         weather="Brutally cold in winter; spring is the touring season.",
         links={}),
    dest(id="manali", name="Manali Heli (Himachal)", category="touring", tags=["heli"],
         country="India", region="Himachal Pradesh", zone="himalaya", lat=32.30, lon=77.15, elev=[2000, 4500], refElev=3200,
         season=[1, 4], best=[2, 3], snowpack="continental high alpine", crowds=1, crowdNote="One operator, small groups.",
         cost=5, guide="required", airport="Kullu-Manali (KUU) via Delhi",
         pitch="Long-running heli skiing in the Pir Panjal and Dhauladhar ranges, with 1,000 m-plus runs from Himalayan ridges.",
         avalanche="No public forecast; operator-managed.",
         weather="Storms from the west, then clear cold spells.",
         links={}),
    dest(id="fuji", name="Mount Fuji (spring)", category="touring", tags=["daytour", "volcano", "spring", "novelty"],
         country="Japan", region="Yamanashi / Shizuoka", zone="honshu", lat=35.36, lon=138.73, elev=[2000, 3776], refElev=3000,
         season=[4, 6], best=[5], snowpack="volcanic spring snow", crowds=2, crowdNote="A few dozen skiers on good May weekends.",
         cost=2, guide="recommended", airport="Tokyo (HND/NRT), 2.5 h",
         pitch="Ski Japan's sacred volcano from the crater rim in late spring: a 1,500 m run with the whole country at your feet.",
         avalanche="Slush avalanches and hard icy slopes; falls are the main danger. Climbing plan required off-season.",
         weather="Wind and ice early; corn snow in May–June.",
         links={"permits": {"url": "https://www.mt-compass.com", "label": "File a climbing plan (Compass)"},
                "website": "https://www.fujisan-climb.jp/en/"}),
    dest(id="scotland", name="Scottish Highlands (Cairngorms & Glencoe)", category="touring", tags=["daytour", "novelty"],
         country="UK", region="Scotland", zone="scotland", lat=56.95, lon=-4.2, elev=[300, 1345], refElev=900,
         season=[12, 4], best=[2, 3], snowpack="maritime, wind-hammered", crowds=2, crowdNote="Busy with locals when it's good.",
         cost=2, guide="optional", airport="Inverness (INV) or Glasgow (GLA)",
         pitch="Wild, wind-scoured Highland plateaus and gullies, with whisky and bothies after; brilliant when it's on.",
         avalanche="Scottish Avalanche Information Service: cornices and wind slab.",
         weather="Famously fickle: storms, thaws and a few perfect days.",
         children=[{"name": "CairnGorm Mountain", "lat": 57.13, "lon": -3.64, "note": "Lift access to the plateau.", "url": "https://www.cairngormmountain.co.uk"},
                   {"name": "Glencoe Mountain", "lat": 56.63, "lon": -4.83, "note": "Steep, characterful ski area.", "url": "https://www.glencoemountain.co.uk"},
                   {"name": "Nevis Range", "lat": 56.85, "lon": -4.98, "note": "Gondola to Aonach Mòr's freeride gullies.", "url": "https://www.nevisrange.co.uk"}],
         links={"avalanche": "https://www.sais.gov.uk"}),
    # ----- North America backcountry -----
    dest(id="shasta", name="Mount Shasta", category="touring", tags=["daytour", "volcano", "spring"],
         country="USA", region="Northern California", zone="pnw", lat=41.41, lon=-122.19, elev=[2100, 4322], refElev=2600,
         season=[1, 7], best=[5, 6], snowpack="maritime volcano", crowds=3, crowdNote="Avalanche Gulch is busy on spring weekends; other sides are quiet.",
         cost=2, guide="optional", airport="Redding (RDD) or Sacramento (SMF)",
         pitch="A lone 4,322 m volcano with 2,000 m spring corn runs on every side, plus Lassen's volcano park 90 minutes away.",
         avalanche="Mount Shasta Avalanche Center; ice and rockfall high up.",
         weather="Corn cycles from April; summit wind and lenticular clouds.",
         children=[{"name": "Lassen Peak", "lat": 40.49, "lon": -121.51, "note": "Spring volcano skiing once the park road opens.", "kind": "bc", "url": "https://www.nps.gov/lavo/"}],
         links={"avalanche": "https://www.shastaavalanche.org",
                "permits": {"url": "https://www.fs.usda.gov/r05/shasta-trinity/recreation/mt-shasta-wilderness", "label": "Summit pass & wilderness permit (USFS)"}}),
    dest(id="bclodges", name="BC Backcountry Lodges (Selkirks & Kootenays)", category="touring", tags=["huts", "daytour"],
         country="Canada", region="British Columbia", zone="interiorbc", lat=50.4, lon=-117.4, elev=[1500, 3000], refElev=1900,
         season=[12, 4], best=[1, 2, 3], snowpack="transitional interior", crowds=1, crowdNote="One group per lodge, per week.",
         cost=3, guide="optional", airport="Castlegar (YCG) or Calgary (YYC), then helicopter",
         pitch="Fly in by helicopter to a timber lodge at treeline, then tour from the door for a week of Interior BC powder.",
         avalanche="Avalanche Canada; persistent weak layers are common.",
         weather="Cold interior storms, stable high-pressure spells.",
         children=[{"name": "Valhalla Range", "lat": 49.85, "lon": -117.62, "note": "Several lodges in the West Kootenay.", "kind": "bc"},
                   {"name": "Battle Range (Selkirks)", "lat": 51.05, "lon": -117.6, "note": "Remote Selkirk lodges.", "kind": "bc"},
                   {"name": "Kokanee & Kaslo area", "lat": 49.8, "lon": -117.15, "note": "Lodges reached from Nelson and Kaslo.", "kind": "bc"}],
         links={"avalanche": "https://avalanche.ca", "website": "https://www.hellobc.com/things-to-do/backcountry-skiing/"}),
    dest(id="wapass", name="Washington Pass (North Cascades)", category="touring", tags=["daytour", "spring"],
         country="USA", region="Washington", zone="pnw", lat=48.52, lon=-120.65, elev=[1100, 2700], refElev=1700,
         season=[3, 6], best=[4, 5], snowpack="transitional", crowds=2, crowdNote="Opening weekend of Hwy 20 is a party; quiet after.",
         cost=2, guide="optional", airport="Seattle (SEA), 4 h",
         pitch="Each spring the North Cascades Highway reopens onto a week's worth of granite couloirs and glacier lines.",
         avalanche="NWAC; wet slides and cornices in spring.",
         weather="Spring corn, with sun and storms in equal measure.",
         links={"avalanche": "https://nwac.us", "website": "https://wsdot.com/travel/real-time/mountainpasses/north-cascades"}),
    dest(id="grosmorne", name="Gros Morne & Humber Valley", category="touring", tags=["daytour"],
         country="Canada", region="Newfoundland", zone="northeast", lat=49.55, lon=-57.85, elev=[0, 814], refElev=500,
         season=[1, 4], best=[2, 3], snowpack="maritime", crowds=1, crowdNote="A small, friendly local scene.",
         cost=2, guide="recommended", airport="Deer Lake (YDF)",
         pitch="Fjords, tablelands and treeless bowls in a UNESCO park, with Marble Mountain's lifts for stormy days.",
         avalanche="No regional forecast; Parks Canada info for Gros Morne.",
         weather="Atlantic maritime: lots of snow, lots of wind.",
         children=[{"name": "Marble Mountain", "lat": 48.97, "lon": -57.83, "note": "Lift area near Corner Brook.", "url": "https://www.skimarble.com"},
                   {"name": "Gros Morne backcountry", "lat": 49.47, "lon": -57.9, "note": "Tablelands, Bonne Bay and the Long Range.", "kind": "bc"}],
         links={"website": "https://parks.canada.ca/pn-np/nl/grosmorne"}),
]

for n in NEW:
    if n["id"] in D:
        D[n["id"]].update(n)
    else:
        J["destinations"].append(n); D[n["id"]] = n

# ---------- sub-spots on existing pins ----------
def add_child(pid, child):
    d = D[pid]; d.setdefault("children", [])
    if not any(c["name"] == child["name"] for c in d["children"]):
        d["children"].append(child)

add_child("hakkoda", {"name": "Gassan", "lat": 38.55, "lon": 140.03, "note": "Spring-only ski area (Apr–Jul) with famous touring.", "kind": "bc"})
add_child("hakkoda", {"name": "Chōkai", "lat": 39.10, "lon": 140.05, "note": "Coastal volcano; long spring runs to the Sea of Japan.", "kind": "bc"})
add_child("niseko", {"name": "Mt Yōtei", "lat": 42.83, "lon": 140.81, "note": "Hokkaido's 'Fuji': crater and bowl skiing.", "kind": "bc"})
add_child("chilevolcanoes", {"name": "Corralco (Lonquimay)", "lat": 38.38, "lon": -71.57, "note": "Lifts plus 3,000 ha of volcano backcountry.", "url": "https://www.corralco.com"})
add_child("tresvalles", {"name": "Cajón del Maipo", "lat": -33.75, "lon": -70.1, "note": "Lift-free backcountry valley near Santiago.", "kind": "bc"})
add_child("kebnekaise", {"name": "Kungsleden (winter)", "lat": 68.0, "lon": 18.6, "note": "Hut-to-hut classic; Sarek is the wild step up.", "kind": "bc"})
for c in [("Donner Summit", 39.32, -120.33), ("Carson Pass", 38.69, -119.99), ("Mt Rose backcountry", 39.31, -119.90),
          ("Desolation Wilderness", 38.90, -120.15)]:
    add_child("tahoe", {"name": c[0], "lat": c[1], "lon": c[2], "note": "Well-documented backcountry.", "kind": "bc"})
add_child("whistler", {"name": "Spearhead Traverse", "lat": 50.05, "lon": -122.87, "note": "Classic hut traverse that starts from the lifts.", "kind": "bc"})
add_child("whistler", {"name": "Duffey Lake Road", "lat": 50.40, "lon": -122.40, "note": "Roadside touring an hour north.", "kind": "bc"})
add_child("alyeska", {"name": "Turnagain Pass", "lat": 60.79, "lon": -149.18, "note": "Alaska's busiest human-powered zone.", "kind": "bc"})
add_child("alyeska", {"name": "Hatcher Pass", "lat": 61.78, "lon": -149.27, "note": "Talkeetna Mountains touring near Palmer.", "kind": "bc"})

# Resort/freeride pins with big, documented backcountry from the same base
for pid in ["tahoe", "cottonwoods", "whistler", "alyeska", "chamonix"]:
    if "daytour" not in D[pid]["tags"]:
        D[pid]["tags"].append("daytour")

# Shasta moves to its own pin
cv = D["cascadevolcanoes"]
cv["name"] = "Cascade Volcanoes (Hood, Rainier, Baker, Adams)"
cv["pitch"] = cv["pitch"].replace("Shasta, ", "").replace(", Shasta", "")

# ---------- traverses ----------
for pid in ["hautroute", "bernese", "vanoise", "pyreneeshr", "wapta", "sierrahr"]:
    if pid in D and "traverse" not in D[pid]["tags"]:
        D[pid]["tags"].append("traverse")

# ---------- 5-step cost scale ----------
FIVE = ["bcheli", "chugach", "haines", "antarctica", "westgreenland", "eastgreenland", "kamchatka", "nzheli"]
for pid in FIVE:
    if pid in D: D[pid]["cost"] = 5
for pid, c in {"lyngen": 3, "trollpeninsula": 3, "bernese": 3, "kackar": 4}.items():
    if pid in D: D[pid]["cost"] = c

J["_about"] = J["_about"].replace("cost 1 (cheap) - 4 (very expensive)",
    "cost 1-5 = rough all-in cost per day for the usual way people do it (1 <$150, 2 $150-300, 3 $300-600, 4 $600-1,200, 5 $1,200+/day or $10k+ trips); self-guided touring is rated self-guided").replace(
    "expedition, volcano", "expedition, traverse, volcano")
lines = ['{', '  "_about": ' + json.dumps(J["_about"], ensure_ascii=False) + ',', '  "macros": ' + json.dumps(J["macros"], ensure_ascii=False) + ',', '  "zones": {',
         ",\n".join(f'    "{z}": ' + json.dumps(v, ensure_ascii=False) for z, v in J["zones"].items()), '  },', '  "destinations": [',
         ",\n".join("    " + json.dumps(d, ensure_ascii=False) for d in J["destinations"]), '  ]', '}']
open(P, "w").write("\n".join(lines) + "\n")
missing = [p for p in FIVE + ["hautroute", "bernese", "vanoise", "pyreneeshr", "wapta", "sierrahr", "trollpeninsula"] if p not in D]
print("destinations:", len(J["destinations"]), "| ids not found:", missing)
