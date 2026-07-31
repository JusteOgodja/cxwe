"""
populate_source_fields.py
=========================
Lit PRODUITS_TOUTES_PHASES.csv, déduplique, et génère des fichiers SQL
UPDATE pour populer les colonnes source_site, source_url, source_phase,
prix_marche_mad, fmcg_segment, disponibilite, description_marketing,
poids_brut_kg, conditionnement, contenance dans la table products.

Stratégie de correspondance (dans l'ordre de priorité) :
  1. EAN exact (barcode CSV  ↔  ean DB)
  2. Nom normalisé exact (product_name CSV ↔ name DB)

Usage :
  pip install python-dotenv supabase
  python populate_source_fields.py

Sortie :
  - update_by_ean.sql        : UPDATEs pour les produits matchés par EAN
  - update_by_name.sql       : UPDATEs pour les produits matchés par nom
  - rapport_import.txt       : statistiques de correspondance
"""

import csv
import os
import re
import unicodedata
from collections import defaultdict

# ─── Config ──────────────────────────────────────────────────────────────────

CSV_PATH = os.path.join(
    os.path.dirname(__file__),
    "..", "DONNEES_FUSIONNEES_PAR_PHASE", "PRODUITS_TOUTES_PHASES.csv"
)

OUT_DIR   = os.path.dirname(__file__)
BATCH_SIZE = 500   # lignes SQL par fichier de sortie

# Ordre de préférence des phases (plus élevé = meilleur)
PHASE_RANK = {
    "07_Campagne_Finale":    7,
    "06_Donnees_Consolidees":6,
    "05_Scraper_Modulaire":  5,
    "04_API_First":          4,
    "03B_Intermediaire":     3,
    "03_Crawl4AI":           2,
    "01_02_Phases_Initiales":1,
    "08_Nouveaux_Sites":     8,   # le plus récent
}

# ─── Helpers ─────────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    """Minuscule, sans accents, sans ponctuation, espaces uniques."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def clean(v: str) -> str:
    """Valeur vide ou placeholder → None."""
    v = v.strip()
    if v.lower() in ("", "non disponible", "n/a", "null", "none", "na", "-"):
        return ""
    return v

def score_phase(phase: str) -> int:
    for k, v in PHASE_RANK.items():
        if k in phase:
            return v
    return 0

def esc(s: str) -> str:
    """Échappe les apostrophes pour SQL."""
    return s.replace("'", "''")

def sql_val(v: str) -> str:
    if not v:
        return "NULL"
    return f"'{esc(v)}'"

def sql_num(v: str) -> str:
    try:
        return str(float(v))
    except (ValueError, TypeError):
        return "NULL"

# ─── 1. Lecture et déduplification du CSV ────────────────────────────────────

print("Lecture du CSV…")

# best_by_ean  : { ean_str  → row_dict }
# best_by_name : { norm_name → row_dict }
best_by_ean  = {}
best_by_name = {}

DISCARD_NAMES = {"non disponible", "bogos-gift", "gift", ""}

with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader):
        if i % 50000 == 0:
            print(f"  {i:,} lignes lues…")

        name = clean(row.get("product_name", ""))
        if normalize(name) in DISCARD_NAMES:
            continue

        ean = clean(row.get("barcode", ""))
        # Nettoie l'EAN : garde seulement les chiffres, longueur 8–14
        ean_clean = re.sub(r"\D", "", ean)
        if len(ean_clean) < 8 or len(ean_clean) > 14:
            ean_clean = ""

        phase        = clean(row.get("phase", ""))
        comp_score   = sql_num(clean(row.get("data_completeness_score", "")))
        phase_score  = score_phase(phase)
        # Score global pour choisir le meilleur doublon
        global_score = phase_score * 100 + (float(comp_score) if comp_score != "NULL" else 0)

        def is_better(existing):
            old_phase  = score_phase(clean(existing.get("phase", "")))
            old_comp   = sql_num(clean(existing.get("data_completeness_score", "")))
            old_score  = old_phase * 100 + (float(old_comp) if old_comp != "NULL" else 0)
            return global_score > old_score

        # Déduplique par EAN
        if ean_clean:
            if ean_clean not in best_by_ean or is_better(best_by_ean[ean_clean]):
                best_by_ean[ean_clean] = row

        # Déduplique par nom normalisé
        norm = normalize(name)
        if norm and norm not in DISCARD_NAMES:
            if norm not in best_by_name or is_better(best_by_name[norm]):
                best_by_name[norm] = row

print(f"Déduplification terminée : {len(best_by_ean):,} EANs uniques, {len(best_by_name):,} noms uniques")

# ─── 2. Requête Supabase pour les produits existants ─────────────────────────
# On génère le SQL sans connexion live.
# L'utilisateur applique les fichiers via le MCP ou le dashboard.

print("\nGénération des SQL…")

def build_set_clause(row: dict) -> str:
    """Construit la clause SET à partir d'une ligne CSV."""
    sets = []

    src_site  = clean(row.get("source_site",  ""))
    src_url   = clean(row.get("product_url",  ""))
    src_phase = clean(row.get("phase",        ""))
    platform  = clean(row.get("platform_name",""))

    price     = clean(row.get("price",        ""))
    avail     = clean(row.get("availability", ""))
    fmcg      = clean(row.get("fmcg_segment", ""))
    short_d   = clean(row.get("short_description",""))
    weight    = clean(row.get("weight",       ""))
    w_unit    = clean(row.get("weight_unit",  ""))
    pack_type = clean(row.get("packaging_type",""))
    contenance= clean(row.get("pack_size",    ""))
    imgs      = clean(row.get("image_urls",   ""))

    if src_site:
        sets.append(f"source_site = {sql_val(src_site)}")
    if src_url:
        sets.append(f"source_url = {sql_val(src_url)}")
    if src_phase:
        sets.append(f"source_phase = {sql_val(src_phase)}")
    if platform and not src_site:
        sets.append(f"source_site = {sql_val(normalize(platform))}")

    # Prix marché MAD
    if price:
        num = sql_num(price)
        if num != "NULL":
            sets.append(f"prix_marche_mad = {num}")

    if avail:
        sets.append(f"disponibilite = {sql_val(avail[:100])}")

    if fmcg:
        sets.append(f"fmcg_segment = {sql_val(fmcg)}")

    if short_d:
        # Tronque à 500 chars
        sets.append(f"description_marketing = {sql_val(short_d[:500])}")

    # Poids brut kg
    if weight:
        kg = sql_num(weight)
        if kg != "NULL":
            w = float(kg)
            # Conversion en kg si unité connue
            if w_unit.lower() in ("g", "gr", "gram", "gramme"):
                w = w / 1000
            elif w_unit.lower() in ("mg",):
                w = w / 1_000_000
            elif w_unit.lower() in ("t", "tonne"):
                w = w * 1000
            sets.append(f"poids_brut_kg = {w}")

    if pack_type:
        sets.append(f"conditionnement = {sql_val(pack_type[:200])}")

    if contenance:
        sets.append(f"contenance = {sql_val(contenance[:100])}")

    # Images supplémentaires (tableau postgres)
    if imgs:
        # Le CSV stocke les URLs séparées par "|" ou ","
        urls = [u.strip() for u in re.split(r"[|,]", imgs) if u.strip().startswith("http")]
        if urls:
            arr = ", ".join(f"'{esc(u)}'" for u in urls[:10])
            sets.append(f"image_urls_extra = ARRAY[{arr}]")

    return ", ".join(sets)

# ─── 3. Génération fichier EAN ────────────────────────────────────────────────

ean_lines = []
for ean, row in best_by_ean.items():
    clause = build_set_clause(row)
    if not clause:
        continue
    ean_lines.append(
        f"UPDATE products SET {clause} WHERE ean = '{ean}' AND source_site IS NULL;"
    )

# Écriture par batch
ean_file = os.path.join(OUT_DIR, "update_by_ean.sql")
with open(ean_file, "w", encoding="utf-8") as f:
    f.write("-- Mise à jour par correspondance EAN\n")
    f.write(f"-- {len(ean_lines)} lignes\n\n")
    for line in ean_lines:
        f.write(line + "\n")

print(f"  → update_by_ean.sql : {len(ean_lines):,} UPDATEs")

# ─── 4. Génération fichier NOM (en batches numérotés) ────────────────────────

name_lines = []
for norm, row in best_by_name.items():
    clause = build_set_clause(row)
    if not clause:
        continue
    # Utilise ILIKE sur le nom normalisé pour tolérer les variantes de casse
    name_raw = clean(row.get("product_name", ""))
    name_lines.append(
        f"UPDATE products SET {clause} "
        f"WHERE LOWER(name) = '{esc(name_raw.lower())}' AND source_site IS NULL;"
    )

# Découpe en batches
batch_num  = 0
total_name = 0
for i in range(0, len(name_lines), BATCH_SIZE):
    batch     = name_lines[i:i + BATCH_SIZE]
    batch_num += 1
    fname     = os.path.join(OUT_DIR, f"update_by_name_{batch_num:03d}.sql")
    with open(fname, "w", encoding="utf-8") as f:
        f.write(f"-- Mise à jour par correspondance NOM — batch {batch_num}\n")
        f.write(f"-- Lignes {i+1}–{i+len(batch)}\n\n")
        for line in batch:
            f.write(line + "\n")
    total_name += len(batch)

print(f"  → update_by_name_*.sql : {total_name:,} UPDATEs en {batch_num} fichiers")

# ─── 5. Rapport ──────────────────────────────────────────────────────────────

rapport = f"""RAPPORT IMPORT SOURCE FIELDS
============================

CSV source : PRODUITS_TOUTES_PHASES.csv
Lignes totales CSV : 303 270

Après déduplification :
  EANs uniques       : {len(best_by_ean):,}
  Noms uniques       : {len(best_by_name):,}

SQL générés :
  update_by_ean.sql  : {len(ean_lines):,} UPDATEs (correspondance EAN exacte)
  update_by_name_*.sql : {total_name:,} UPDATEs en {batch_num} fichiers (correspondance nom)

Ordre d'application recommandé :
  1. update_by_ean.sql          (priorité max — EAN = identifiant univoque)
  2. update_by_name_001.sql … update_by_name_{batch_num:03d}.sql

Note : les UPDATEs ont la condition "AND source_site IS NULL"
       pour éviter d'écraser des valeurs déjà renseignées manuellement.
"""

rapport_file = os.path.join(OUT_DIR, "rapport_import.txt")
with open(rapport_file, "w", encoding="utf-8") as f:
    f.write(rapport)

print("\n" + rapport)
print("Terminé.")
