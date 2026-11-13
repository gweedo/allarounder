"""PROTOTYPE (#189) -- generates fixtures.json with INVENTED data.

Every athlete, club, venue and score here is fictional. No World Gymnastics
or FGI data may be added to this prototype while #191 is open.

Run: python3 app/statistiche/_prototype/make_fixtures.py
"""

import json
import random
from pathlib import Path

random.seed(189)

WAG = ["VT", "UB", "BB", "FX"]
MAG = ["FX", "PH", "SR", "VT", "PB", "HB"]
APPARATUS = {"WAG": WAG, "MAG": MAG}

athletes = [
    # slug, name, nation, discipline, birthYear, club
    ("giulia-ferraresi", "Giulia Ferraresi", "ITA", "WAG", 2005, "Ginnastica Riva Chiara"),
    ("chiara-montanaro", "Chiara Montanaro", "ITA", "WAG", 2007, "Polisportiva Lagomare"),
    ("sofia-brambati", "Sofia Brambati", "ITA", "WAG", 2006, "Società Ginnastica Valdoria"),
    ("elena-corradi", "Elena Corradi", "ITA", "WAG", 2008, "Ginnastica Riva Chiara"),
    ("lea-duvernoy", "Léa Duvernoy", "FRA", "WAG", 2004, None),
    ("hanna-weidlich", "Hanna Weidlich", "GER", "WAG", 2006, None),
    ("ellie-marsden", "Ellie Marsden", "GBR", "WAG", 2005, None),
    ("tommaso-rinaldelli", "Tommaso Rinaldelli", "ITA", "MAG", 2002, "Pro Ginnastica Montebello"),
    ("davide-scoccia", "Davide Scoccia", "ITA", "MAG", 2003, "Polisportiva Lagomare"),
    ("pietro-valsecchi", "Pietro Valsecchi", "ITA", "MAG", 2004, "Società Ginnastica Valdoria"),
    ("filippo-mazzanti", "Filippo Mazzanti", "ITA", "MAG", 2005, "Pro Ginnastica Montebello"),
    ("jonas-achterberg", "Jonas Achterberg", "NED", "MAG", 2001, None),
    ("mateusz-wrona", "Mateusz Wrona", "POL", "MAG", 2003, None),
    ("alvaro-quesada", "Álvaro Quesada", "ESP", "MAG", 2002, None),
]

# Per-athlete "form" per apparatus: (D, E mean). Invented.
form = {}
for slug, _, nation, disc, _, _ in athletes:
    strength = random.uniform(-0.6, 0.6)
    for app in APPARATUS[disc]:
        spec = random.uniform(-0.5, 0.5)
        d = (5.4 if disc == "WAG" else 5.3) + strength + spec
        e = 8.0 + strength / 2 + random.uniform(-0.3, 0.3)
        form[(slug, app)] = (d, e)


def r1(x):
    return round(x, 1)


def r3(x):
    return round(x, 3)


def routine(slug, app, bonus=False):
    d0, e0 = form[(slug, app)]
    d = r1(d0 + random.uniform(-0.2, 0.2))
    e = r3(min(9.6, e0 + random.gauss(0, 0.35)))
    if random.random() < 0.08:
        e = r3(e - random.uniform(0.8, 1.3))  # a fall
    penalty = random.choice([0, 0, 0, 0, 0, 0.1, 0.3])
    b = random.choice([0, 0.1, 0.2, 0.3]) if bonus else 0
    total = r3(d + e + b - penalty)
    out = {"d": d, "e": e, "penalty": penalty, "total": total}
    if bonus:
        out["bonus"] = b
    return out


def rank(results, key="total"):
    results.sort(key=lambda r: -r[key])
    for i, r in enumerate(results, 1):
        r["rank"] = i
    return results


def aa_results(slugs, disc, bonus=False):
    res = []
    for s in slugs:
        parts = {app: routine(s, app, bonus)["total"] for app in APPARATUS[disc]}
        res.append({"athlete": s, "parts": parts, "total": r3(sum(parts.values()))})
    return rank(res)


def apparatus_final(slugs, disc, app):
    res = []
    for s in slugs:
        if app == "VT":
            v1, v2 = routine(s, "VT"), routine(s, "VT")
            v2["d"] = r1(v2["d"] - 0.4)
            v2["total"] = r3(v2["d"] + v2["e"] - v2["penalty"])
            res.append({"athlete": s, "vaults": [v1, v2], "total": r3((v1["total"] + v2["total"]) / 2)})
        else:
            res.append({"athlete": s, **routine(s, app)})
    return rank(res)


def by(disc, nations=None):
    return [a[0] for a in athletes if a[3] == disc and (nations is None or a[2] in nations)]


def top(results, n):
    return [r["athlete"] for r in results[:n]]


competitions = []

# 1. World Cup: apparatus finals only (a fictional venue).
phases = []
for disc in ("WAG", "MAG"):
    for app in APPARATUS[disc]:
        field = random.sample(by(disc), 6)
        phases.append({"round": "finale", "discipline": disc, "apparatus": app,
                       "results": apparatus_final(field, disc, app)})
competitions.append({
    "slug": "coppa-del-mondo-valdoria-2026",
    "name": "Coppa del Mondo di Valdoria 2026",
    "level": "internazionale", "tier": "Coppa del Mondo",
    "city": "Valdoria", "country": "ITA",
    "startDate": "2026-03-12", "endDate": "2026-03-15",
    "summary": "Prima tappa di Coppa del Mondo della stagione, solo finali di specialità. "
               "Testo segnaposto: qui la redazione scriverà due o tre righe sulla gara.",
    "phases": phases,
})

# 2. Europeans: qualification (AA), AA final, apparatus finals.
phases = []
for disc in ("WAG", "MAG"):
    q = aa_results(by(disc), disc)
    phases.append({"round": "qualifica", "discipline": disc, "apparatus": "AA", "results": q})
    phases.append({"round": "finale-aa", "discipline": disc, "apparatus": "AA",
                   "results": aa_results(top(q, 6), disc)})
    for app in APPARATUS[disc]:
        best = sorted(q, key=lambda r: -r["parts"][app])
        phases.append({"round": "finale", "discipline": disc, "apparatus": app,
                       "results": apparatus_final(top(best, 5), disc, app)})
competitions.append({
    "slug": "europei-lagomare-2026",
    "name": "Campionati Europei di Lagomare 2026",
    "level": "internazionale", "tier": "Europei",
    "city": "Lagomare", "country": "ITA",
    "startDate": "2026-04-22", "endDate": "2026-04-26",
    "summary": "Europei con qualificazioni, finale all-around e finali di specialità. "
               "Testo segnaposto: la narrazione della gara, scritta dalla redazione, va qui sopra le tabelle.",
    "phases": phases,
})

# 3. Serie A round: single session, Italians only, with bonuses.
phases = []
for disc in ("WAG", "MAG"):
    phases.append({"round": "prova", "discipline": disc, "apparatus": "AA",
                   "results": aa_results(by(disc, {"ITA"}), disc, bonus=True)})
competitions.append({
    "slug": "serie-a-montebello-2026",
    "name": "Serie A 2026 – 1ª prova, Montebello",
    "level": "nazionale", "tier": "Serie A",
    "city": "Montebello", "country": "ITA",
    "startDate": "2026-02-28", "endDate": "2026-02-28",
    "summary": "Prima prova del campionato a squadre. Nel prototipo mostriamo solo la classifica individuale. "
               "Testo segnaposto.",
    "phases": phases,
})

# 4. Italian championships: AA final + apparatus finals, Italians only.
phases = []
for disc in ("WAG", "MAG"):
    ita = by(disc, {"ITA"})
    phases.append({"round": "finale-aa", "discipline": disc, "apparatus": "AA",
                   "results": aa_results(ita, disc)})
    for app in APPARATUS[disc]:
        phases.append({"round": "finale", "discipline": disc, "apparatus": app,
                       "results": apparatus_final(ita, disc, app)})
competitions.append({
    "slug": "campionato-italiano-assoluto-2026",
    "name": "Campionato Italiano Assoluto 2026",
    "level": "nazionale", "tier": "Campionato Italiano",
    "city": "Riva Chiara", "country": "ITA",
    "startDate": "2026-06-05", "endDate": "2026-06-07",
    "summary": "Titoli italiani all-around e di specialità. Testo segnaposto.",
    "phases": phases,
})

data = {
    "prototype": True,
    "note": "DATI INVENTATI per il prototipo #189: atleti, società, sedi e punteggi sono fittizi.",
    "season": 2026,
    "updatedAt": "2026-11-13",
    "athletes": [
        {k: v for k, v in zip(("slug", "name", "nation", "discipline", "birthYear", "club"), a) if v is not None}
        for a in athletes
    ],
    "competitions": competitions,
}

out = Path(__file__).with_name("fixtures.json")
out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
print(f"wrote {out}")
