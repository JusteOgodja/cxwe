#!/usr/bin/env python3
"""
Applique prix_marche_mad depuis data/catalog_market_matches.csv
sur les correspondances FIABLES (niveau=sure) dont le produit n'a
PAS encore de prix. Reversible, trace via prix_marche_source,
garde WHERE prix_marche_mad IS NULL (aucun ecrasement).
"""
import os, csv, sys
import psycopg

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    sys.exit("DATABASE_URL non defini")

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_IN = os.path.join(HERE, "..", "data", "catalog_market_matches.csv")

# 1 produit peut matcher plusieurs lignes marche -> on garde le PRIX LE PLUS BAS
best = {}  # product_id -> (prix, enseigne, marche_nom)
with open(CSV_IN, encoding="utf-8-sig") as fh:
    for r in csv.DictReader(fh):
        if r["niveau"] != "sure":
            continue
        if r["prix_actuel"] != "":       # deja un prix -> on ne touche pas
            continue
        try:
            prix = round(float(r["marche_prix_mad"]), 2)
        except (ValueError, TypeError):
            continue
        pid = r["product_id"]
        if pid not in best or prix < best[pid][0]:
            best[pid] = (prix, r["enseigne"], r["marche_nom"])

print(f"Produits a enrichir (sure, sans prix) : {len(best)}")

rows = [(pid, prix, f"marche_scrape:{ens}") for pid, (prix, ens, _) in best.items()]

conn = psycopg.connect(DB_URL, autocommit=True, connect_timeout=30)
try:
    # desactive le trigger de refresh matview (inutile pour un simple prix)
    with conn.cursor() as cur:
        cur.execute("ALTER TABLE products DISABLE TRIGGER trg_refresh_product_counts;")
    # update en une transaction (trigger off -> pas d'accumulation de verrous)
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.executemany(
            "UPDATE products SET prix_marche_mad = %s, prix_marche_source = %s "
            "WHERE id = %s AND prix_marche_mad IS NULL",
            [(prix, src, pid) for (pid, prix, src) in rows],
        )
    conn.commit()
    conn.autocommit = True
finally:
    # reactive TOUJOURS le trigger, puis rafraichit la vue une fois
    with conn.cursor() as cur:
        cur.execute("ALTER TABLE products ENABLE TRIGGER trg_refresh_product_counts;")
    try:
        with conn.cursor() as cur:
            cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY category_product_counts;")
    except Exception as e:
        print(f"(refresh matview: {e})")

with conn:
    # verification post-update
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM products WHERE prix_marche_source LIKE 'marche_scrape:%';")
        traces = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM products WHERE prix_marche_mad IS NOT NULL;")
        avec_prix = cur.fetchone()[0]

print(f"Lignes envoyees   : {len(rows)}")
print(f"Traces marche_scrape en base : {traces}")
print(f"Total produits avec prix_marche_mad : {avec_prix}")
