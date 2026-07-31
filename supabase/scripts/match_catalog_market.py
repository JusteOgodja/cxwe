#!/usr/bin/env python3
"""
Analyse de correspondance entre le catalogue Supabase (products) et le
tableau marche (data/market_prices_clean.csv).

But : estimer combien de produits du catalogue pourraient etre enrichis
(prix_marche_mad) grace aux prix scrapes, via matching flou des noms.

Sortie : data/catalog_market_matches.csv + statistiques.
"""
import os, csv, re, unicodedata, sys
import psycopg
from rapidfuzz import process, fuzz

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    sys.exit("DATABASE_URL non defini")

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_IN = os.path.join(HERE, "..", "data", "market_prices_clean.csv")
OUT = os.path.join(HERE, "..", "data", "catalog_market_matches.csv")

def norm(s):
    """Normalise en GARDANT les tailles/formats (1l, 500g...) car ils
    distinguent les produits. Accents/ponctuation retires."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def ntokens(s):
    return len(s.split())

def qtys(s):
    """Extrait les quantites par dimension : volume(ml), poids(g),
    portions, taille. Sert a rejeter les faux matchs (1,5L vs 1L...)."""
    if not s:
        return {}
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    d = {}
    for num, unit in re.findall(r"(\d+[.,]?\d*)\s*(l|cl|ml)\b", s):
        v = float(num.replace(",", "."))
        ml = v * 1000 if unit == "l" else v * 10 if unit == "cl" else v
        d.setdefault("vol", set()).add(round(ml))
    for num, unit in re.findall(r"(\d+[.,]?\d*)\s*(kg|gr|grs|g)\b", s):
        v = float(num.replace(",", "."))
        d.setdefault("wt", set()).add(round(v * 1000 if unit == "kg" else v))
    for num in re.findall(r"(\d+)\s*portions?\b", s):
        d.setdefault("port", set()).add(int(num))
    for num in re.findall(r"\bt\s?(\d{1,2})\b", s):
        d.setdefault("taille", set()).add(int(num))
    return d

def compatible(qa, qb):
    """False si une dimension presente des DEUX cotes est contradictoire."""
    for dim in ("vol", "wt", "port", "taille"):
        if dim in qa and dim in qb and qa[dim] != qb[dim]:
            return False
    return True

# --- charge le marche ---
market = []
with open(CSV_IN, encoding="utf-8-sig") as fh:
    for r in csv.DictReader(fh):
        if r["prix_mad"] == "":
            continue
        nm = norm(r["nom"])
        if len(nm) < 4:
            continue
        market.append({
            "norm": nm, "nom": r["nom"], "prix": r["prix_mad"],
            "enseigne": r["enseigne"], "type": r["type_prix"], "marque": r["marque"],
        })
market_norm = [m["norm"] for m in market]
print(f"Lignes marche avec prix (normalisees) : {len(market)}")

# --- charge le catalogue ---
with psycopg.connect(DB_URL, connect_timeout=30) as conn, conn.cursor() as cur:
    cur.execute("SELECT id, name, prix_marche_mad FROM products WHERE name IS NOT NULL;")
    products = cur.fetchall()
print(f"Produits catalogue : {len(products)}")

T_SURE = 90     # correspondance fiable
T_MAYBE = 82    # correspondance probable

matches = []
n_sure = n_maybe = 0
n_sure_noprice = 0
for pid, name, prix_actuel in products:
    q = norm(name)
    # exige un nom un minimum descriptif (evite 'thym', 'sel'...)
    if len(q) < 8 or ntokens(q) < 2:
        continue
    qq = qtys(name)
    # top candidats, on retient le 1er compatible (quantite + longueur)
    cands = process.extract(q, market_norm, scorer=fuzz.token_sort_ratio,
                            score_cutoff=T_MAYBE, limit=8)
    m = score = None
    for _, sc, idx in cands:
        cand = market[idx]
        lr = len(q) / max(len(cand["norm"]), 1)
        if not (0.55 <= lr <= 1.8):
            continue
        if not compatible(qq, qtys(cand["nom"])):
            continue
        m, score = cand, sc
        break
    if m is None:
        continue
    niveau = "sure" if score >= T_SURE else "maybe"
    if niveau == "sure":
        n_sure += 1
        if prix_actuel is None:
            n_sure_noprice += 1
    else:
        n_maybe += 1
    matches.append({
        "product_id": pid, "catalogue_nom": name,
        "prix_actuel": prix_actuel if prix_actuel is not None else "",
        "marche_nom": m["nom"], "marche_prix_mad": m["prix"],
        "enseigne": m["enseigne"], "type_prix": m["type"],
        "score": score, "niveau": niveau,
    })

matches.sort(key=lambda x: -x["score"])
with open(OUT, "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(matches[0].keys()) if matches else ["product_id"])
    w.writeheader()
    w.writerows(matches)

print("\n===== RESULTATS =====")
print(f"Correspondances fiables (>= {T_SURE}) : {n_sure}")
print(f"  dont produits SANS prix actuel      : {n_sure_noprice}  <- enrichissables")
print(f"Correspondances probables ({T_MAYBE}-{T_SURE-1}) : {n_maybe}")
print(f"Fichier : {OUT}")
print("\n--- Apercu 15 correspondances fiables ---")
shown = 0
for m in matches:
    if m["niveau"] == "sure":
        print(f"  [{m['score']:.0f}] {m['catalogue_nom'][:38]:38s} <-> {m['marche_nom'][:38]:38s} | {m['marche_prix_mad']} MAD ({m['enseigne']})")
        shown += 1
        if shown >= 15:
            break
