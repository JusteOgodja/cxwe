#!/usr/bin/env python3
"""
Nettoie les exports bruts de supabase/Scraping_brute/ et produit un tableau
propre : supabase/data/market_prices_clean.csv

Colonnes de sortie :
  enseigne, categorie, nom, marque, prix_mad, prix_barre_mad, type_prix,
  vendeur, image_url, source_url
"""
import csv, glob, os, re

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Scraping_brute")
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
os.makedirs(OUT_DIR, exist_ok=True)
OUT = os.path.join(OUT_DIR, "market_prices_clean.csv")

PRICE_RE = re.compile(r"(\d[\d\s]*[.,]?\d*)\s*(?:DH|MAD|Dhs)", re.I)

def to_float(txt):
    """'23,95DH' -> 23.95 ; '1 250 DH' -> 1250.0 ; '55.00 Dhs' -> 55.0"""
    if not txt:
        return None
    m = PRICE_RE.search(txt)
    if not m:
        return None
    num = m.group(1).replace(" ", "").replace(" ", "")
    # separateur decimal : virgule OU point ; on garde le dernier comme decimal
    num = num.replace(",", ".")
    if num.count(".") > 1:  # ex '1.250.00' improbable, on nettoie
        parts = num.split(".")
        num = "".join(parts[:-1]) + "." + parts[-1]
    try:
        v = round(float(num), 2)
        return v if 0 < v < 1_000_000 else None
    except ValueError:
        return None

def split_brand(title):
    """'Fromage 200g - KIRI' -> ('Fromage 200g', 'KIRI')"""
    if " - " in title:
        head, tail = title.rsplit(" - ", 1)
        # marque = segment final court, majoritairement en majuscules
        if 1 < len(tail) <= 30 and tail.upper() == tail:
            return head.strip(), tail.strip()
    return title.strip(), ""

def cat_from_name(fname):
    base = os.path.basename(fname)
    base = re.sub(r"^(marjane-ma-|carrefour-ma-|jumia-ma-|souk-maroc-com-|marjanemall-ma-|matajiressafa-ma-)", "", base)
    base = re.sub(r"[-_]?\d{4}-\d{2}-\d{2}.*", "", base)
    base = base.replace(".csv", "").replace("-", " ").strip()
    return base or ""

def cat_from_url(url):
    if not url:
        return ""
    m = re.search(r"//[^/]+/([^/?]+)", url)
    return (m.group(1).replace("-", " ") if m else "")

rows_out = []

def add(enseigne, categorie, nom, marque, prix, prix_barre, vendeur, image, url):
    nom = (nom or "").strip()
    if len(nom) < 3:
        return
    rows_out.append({
        "enseigne": enseigne,
        "categorie": (categorie or "").strip()[:60],
        "nom": nom[:200],
        "marque": (marque or "").strip()[:60],
        "prix_mad": prix if prix is not None else "",
        "prix_barre_mad": prix_barre if prix_barre is not None else "",
        "type_prix": "grossiste" if enseigne == "matajiressafa" else "detail",
        "vendeur": (vendeur or "").strip()[:80],
        "image_url": (image or "").strip()[:300] if (image or "").startswith("http") else "",
        "source_url": (url or "").strip()[:300],
    })

for f in glob.glob(os.path.join(BASE, "**", "*.csv"), recursive=True):
    src = os.path.basename(os.path.dirname(f)).replace("Scraping ", "")
    with open(f, encoding="utf-8-sig", newline="") as fh:
        reader = list(csv.DictReader(fh))

    if src == "Marjane":
        cat = cat_from_name(f)
        for r in reader:
            nom, marque = split_brand(r.get("title") or "")
            add("Marjane", cat, nom, marque, to_float(r.get("price")),
                None, "", r.get("image"), r.get("web_scraper_start_url"))

    elif src == "matajiressafa":
        for r in reader:
            add("matajiressafa", "", r.get("data"), "",
                to_float(r.get("data2")), None, "",
                r.get("image"), r.get("web_scraper_start_url"))

    elif src == "Marjanemall":
        for r in reader:
            # prix courant = data2 + '.' + data8 (centimes) ; fallback data4
            e = (r.get("data2") or "").strip()
            c = (r.get("data8") or "").strip()
            prix = None
            if e.isdigit():
                prix = to_float(f"{e}.{c if c.isdigit() else '0'} DH")
            prix = prix or to_float(r.get("data4"))
            prix_barre = to_float(r.get("data4"))
            add("Marjanemall", cat_from_url(r.get("web_scraper_start_url")),
                r.get("data"), "", prix, prix_barre if prix_barre != prix else None,
                r.get("data3"), r.get("image"), r.get("item_page_link") or r.get("web_scraper_start_url"))

    elif src == "Jumia":
        for r in reader:
            nom = r.get("name") or r.get("item_page_title") or r.get("title") or ""
            # prix : 1er champ contenant un motif prix
            prix = None
            for v in r.values():
                prix = to_float(v)
                if prix:
                    break
            brand = r.get("brand") or ""
            add("Jumia", r.get("category") or "", nom, brand, prix, None,
                "", r.get("image"), r.get("item_page_link") or r.get("web_scraper_start_url"))

    elif src == "Carrefour":
        cat = cat_from_name(f)
        for r in reader:
            add("Carrefour", cat, r.get("title"), "", None, None, "",
                r.get("image"), r.get("web_scraper_start_url"))

    elif src == "Soukmaroc":
        for r in reader:
            add("Soukmaroc", r.get("category") or "", r.get("data"), "",
                None, None, "", "", r.get("web_scraper_start_url"))

# --- dedup (enseigne + nom + prix) ---
seen = set()
final = []
for r in rows_out:
    key = (r["enseigne"], r["nom"].lower(), str(r["prix_mad"]))
    if key in seen:
        continue
    seen.add(key)
    final.append(r)

cols = ["enseigne", "categorie", "nom", "marque", "prix_mad", "prix_barre_mad",
        "type_prix", "vendeur", "image_url", "source_url"]
with open(OUT, "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=cols)
    w.writeheader()
    w.writerows(final)

# --- stats ---
from collections import Counter
by_src = Counter(r["enseigne"] for r in final)
with_price = Counter(r["enseigne"] for r in final if r["prix_mad"] != "")
print(f"Tableau propre ecrit : {OUT}")
print(f"Total lignes : {len(final)} (apres dedup)\n")
print(f"{'ENSEIGNE':15s} {'lignes':>7s} {'avec prix':>10s}")
for s in sorted(by_src):
    print(f"{s:15s} {by_src[s]:7d} {with_price[s]:10d}")
print(f"{'TOTAL':15s} {len(final):7d} {sum(with_price.values()):10d}")
print("\n--- Apercu 12 lignes avec prix ---")
shown = 0
for r in final:
    if r["prix_mad"] != "":
        print(f"  [{r['enseigne']:12s}] {r['nom'][:45]:45s} | {r['prix_mad']:>8} MAD | {r['marque'][:15]}")
        shown += 1
        if shown >= 12:
            break
