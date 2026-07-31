#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère les fichiers SQL de seed pour le catalogue Morocco Food Export
à partir de PRODUITS_CIBLES.json (données scrapées).

Sortie:
  - seed_catalog.sql : catégories + produits + prix (une transaction, pour psql)

Choix appliqués (validés par l'utilisateur):
  - Périmètre : TOUS les produits (33 546)
  - Devise    : tout étiqueté en MAD
  - Prix      : intégrés dans product_pricing_tiers
"""
import json, re, uuid, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'PRODUITS_CIBLES.json')
OUT = os.path.join(HERE, 'seed_catalog.sql')
ND = 'Non disponible'
NS = uuid.UUID('12345678-1234-5678-1234-567812345678')  # namespace fixe -> ids déterministes
BATCH = 500

def clean(v):
    if v is None: return ''
    s = str(v).strip()
    return '' if s == ND else s

def q(v):
    """Échappe une valeur texte pour SQL, ou NULL."""
    s = clean(v)
    if s == '': return 'NULL'
    return "'" + s.replace("'", "''") + "'"

def qnn(v):
    """Texte non-null (chaîne vide si absent)."""
    s = clean(v).replace("'", "''")
    return "'" + s + "'"

def slugify(name):
    s = name.lower()
    s = re.sub(r'^\s*\d+\.\s*', '', s)          # retire "12. "
    s = s.replace('&', ' ').replace('/', ' ')
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def cat_name(raw):
    return re.sub(r'^\s*\d+\.\s*', '', raw).strip()

def cat_sort(raw):
    m = re.match(r'^\s*(\d+)\.', raw)
    return int(m.group(1)) if m else 999

def to_float(v):
    try: return float(clean(v))
    except: return None

def main():
    data = json.load(open(SRC, encoding='utf-8'))
    # --- Catégories distinctes ---
    cats = {}  # slug -> (name, sort)
    for x in data:
        raw = clean(x.get('target_category'))
        if not raw: continue
        slug = slugify(raw)
        if slug and slug not in cats:
            cats[slug] = (cat_name(raw), cat_sort(raw))

    lines = []
    lines.append('-- ============================================================')
    lines.append('-- SEED CATALOGUE — Morocco Food Export')
    lines.append('-- Généré automatiquement depuis PRODUITS_CIBLES.json')
    lines.append('-- Prérequis : ALL_MIGRATIONS.sql déjà exécuté (tables créées).')
    lines.append('-- Exécution recommandée : psql "<DATABASE_URL>" -f seed_catalog.sql')
    lines.append('-- ============================================================')
    lines.append('BEGIN;')
    lines.append('')
    lines.append('-- 1) CATÉGORIES')
    for slug, (name, sort) in sorted(cats.items(), key=lambda kv: kv[1][1]):
        lines.append(
            f"INSERT INTO categories (name, slug, sort_order, is_active) "
            f"VALUES ({qnn(name)}, {qnn(slug)}, {sort}, true) "
            f"ON CONFLICT (slug) DO NOTHING;"
        )
    lines.append('')
    lines.append('-- 2) PRODUITS (id déterministe) + PRIX')

    prod_vals = []
    price_vals = []
    seen_ids = set()
    for i, x in enumerate(data):
        raw = clean(x.get('target_category'))
        slug = slugify(raw)
        if not slug: continue
        name = clean(x.get('product_name'))
        if not name: continue
        # id déterministe (product_url + index pour éviter collisions)
        key = (clean(x.get('canonical_product_url')) or clean(x.get('product_url'))
               or clean(x.get('record_hash')) or str(i)) + f'|{i}'
        pid = str(uuid.uuid5(NS, key))
        if pid in seen_ids:  # sécurité
            pid = str(uuid.uuid5(NS, key + f'|dup{i}'))
        seen_ids.add(pid)

        desc = clean(x.get('full_description')) or clean(x.get('short_description'))
        img = clean(x.get('main_image_url'))
        origin = clean(x.get('origin_country')) or 'Morocco'

        prod_vals.append(
            f"('{pid}', (SELECT id FROM categories WHERE slug={qnn(slug)}), "
            f"{qnn(name)}, {qnn(desc)}, '{{}}', {qnn(img)}, NULL, NULL, "
            f"'MAD', {qnn(origin)}, 'actif', true)"
        )

        price = to_float(x.get('price'))
        if price is not None and price > 0:
            moq = to_float(x.get('minimum_order_quantity'))
            minq = int(moq) if (moq and moq >= 1) else 1
            price_vals.append(f"('{pid}', {minq}, {price}, 'MAD')")

    # écrire les produits par lots
    def flush(vals, header):
        for k in range(0, len(vals), BATCH):
            chunk = vals[k:k+BATCH]
            lines.append(header)
            lines.append(',\n'.join(chunk) + ';')

    flush(prod_vals,
        "INSERT INTO products (id, category_id, name, description, details, image_url, "
        "ean, hs_code, devise, pays_origine, statut, is_active) VALUES")
    lines.append('')
    lines.append('-- 3) PRIX (product_pricing_tiers)')
    flush(price_vals,
        "INSERT INTO product_pricing_tiers (product_id, min_quantity, price, currency) VALUES")

    lines.append('')
    lines.append('COMMIT;')
    lines.append(f"-- Produits: {len(prod_vals)} | Prix: {len(price_vals)} | Catégories: {len(cats)}")

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    size_mb = os.path.getsize(OUT) / 1e6
    print(f"OK -> {OUT}")
    print(f"Catégories : {len(cats)}")
    print(f"Produits   : {len(prod_vals)}")
    print(f"Prix       : {len(price_vals)}")
    print(f"Taille SQL : {size_mb:.1f} MB")

if __name__ == '__main__':
    main()
