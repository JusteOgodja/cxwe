# Supabase — Base de données & pipeline de données

Documentation du dossier `supabase/` : structure, schéma, pipeline d'enrichissement
et état actuel du catalogue. **À lire avant de reprendre le travail sur les données.**

Projet Supabase : `fknxppuvpdmcfhtfrjcx` (région eu-west-1).
L'application (Vite/React) lit **uniquement la base Supabase** — jamais les fichiers de ce dossier.

---

## 1. Arborescence

```
supabase/
├── migrations/       Schéma de la base (VITAL, versionné). Source de vérité du modèle.
├── functions/        Edge functions Supabase.
├── scripts/          Outils réutilisables (Python/PowerShell) — voir §3.
│   └── legacy/       Scripts one-shot d'anciennes sessions (historique, non maintenus).
├── data/             Exports & sauvegardes CSV produits par les analyses (§4).
└── README.md         Ce fichier.
```

Les **données sources lourdes** (784 Mo) ont été déplacées **hors du dépôt** dans :
`../_archive_supabase/` (à côté du repo). Voir §5.

---

## 2. Schéma (migrations/)

Table centrale : **`products`** (~68 colonnes). Tables liées : `categories`, `brands`
(`marques`), `suppliers`, `product_pricing_tiers`, `product_lots`, `product_images`,
`quote_requests`, `buyer_profiles`, `site_settings`.

Points d'attention :
- Un trigger **`trg_refresh_product_counts`** rafraîchit la vue matérialisée
  `category_product_counts` à chaque écriture sur `products`. Pour les gros batchs,
  le désactiver puis le réactiver + `REFRESH MATERIALIZED VIEW CONCURRENTLY ...`
  (sinon erreur `out of shared memory`). Les scripts §3 le gèrent déjà.
- L'app filtre **`is_active = true`** sur toutes les requêtes publiques (catalogue,
  recherche, fiche produit). Un produit `is_active = false` est invisible côté site.

Appliquer les migrations : via le SQL editor Supabase ou `supabase db push`.

---

## 3. Pipeline d'enrichissement (scripts/)

**Prérequis commun** : variable d'environnement `DATABASE_URL` (chaîne Postgres directe,
pooler eu-west-1, port 5432). Le mot de passe DB (pas la clé service_role). Exemple :

```bash
$env:DATABASE_URL = "postgresql://postgres.fknxppuvpdmcfhtfrjcx:MDP@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

Aucun script ne contient de secret en dur — tous lisent `DATABASE_URL`.

| Script | Rôle |
|---|---|
| `run_all_enrichment.py` (ou `.ps1`) | Applique les fichiers `update_by_*.sql` (archivés, §5) sur la base, en batch robuste (1 aller-retour/fichier, keepalives, reconnexion). Idempotent grâce à la garde `AND source_site IS NULL`. |
| `clean_market_prices.py` | Consolide les scrapes bruts (`../_archive_supabase/Scraping_brute/`) en un tableau propre `data/market_prices_clean.csv` (nom, marque, prix, enseigne). |
| `match_catalog_market.py` | Rapproche le catalogue du tableau marché par matching flou de noms (avec contrôle de quantité), produit `data/catalog_market_matches.csv`. |
| `apply_market_prices.py` | Applique `prix_marche_mad` sur les correspondances fiables sans prix. Trace l'origine via `prix_marche_source = 'marche_scrape:<enseigne>'`. Réversible. |
| `populate_source_fields.py` | (Génération d'origine) produit les `update_by_*.sql` depuis le CSV source fusionné. |

**Ordre historique d'application des UPDATE** (cf. `scripts/rapport_import.txt`) :
1. `update_by_ean.sql` (priorité — EAN = identifiant univoque)
2. `update_by_name_001.sql` … `update_by_name_232.sql` (correspondance par nom)

Ces `.sql` sont **archivés** (§5), pas dans le dépôt (89 Mo). Régénérables via
`populate_source_fields.py` à partir du CSV source.

---

## 4. Exports d'analyse (data/)

Fichiers dérivés, régénérables, produits par les scripts §3 :

| Fichier | Contenu |
|---|---|
| `market_prices_clean.csv` | ~3 500 produits marché consolidés (veille prix). |
| `catalog_market_matches.csv` | Correspondances catalogue ↔ marché (score, niveau). |
| `produits_sans_prix.csv` | Produits du catalogue sans prix. |
| `completude_catalogue.csv` | Taux de remplissage par colonne. |
| `backup/` | Sauvegardes des lignes modifiées/supprimées (restauration). |

---

## 5. Archive des données sources (hors dépôt)

`../_archive_supabase/` (~784 Mo, à côté du repo, **non versionné**) :

| Dossier | Contenu |
|---|---|
| `DONNEES_FUSIONNEES_PAR_PHASE/` | `PRODUITS_TOUTES_PHASES.csv` (657 Mo) — source fusionnée déjà chargée en base. |
| `scripts_sql/` | Les 232 `update_by_name_*.sql` + `update_by_ean.sql` (SQL d'enrichissement déjà appliqués). |
| `Scraping_brute/` | Scrapes bruts des enseignes marocaines (Marjane, Carrefour, Jumia, etc.). |
| `analysis/` | Anciens rapports CSV. |

Rien n'y est nécessaire au fonctionnement de l'app : ce sont des matières premières
déjà consommées par la base. Conservées pour re-générer ou re-jouer un enrichissement.

---

## 6. État actuel du catalogue (juillet 2026)

- **15 854 produits** au total.
- **10 653 actifs** (`is_active = true`) — affichés en ligne (fiches avec prix **et** source).
- **5 201 inactifs** — masqués car sans prix ou sans source (réversibles ; IDs sauvegardés
  dans `data/backup/desactives_fiche_incomplete.csv`).
- **11 493** ont un `prix_marche_mad` ; dont **840** issus du scraping marché
  (traçés `prix_marche_source = 'marche_scrape:*'`).
- **2 753** produits non marocains ont été **supprimés** (sauvegarde :
  `data/backup/deleted_products_full.csv`).

Champs encore vides (à alimenter via les fournisseurs, pas via le scraping retail) :
`ean`, `hs_code`, `pays_origine`, `prix_depart_usine`, `incoterms_dispo`,
`ingredients_texte`, `allergenes`, `nutriscore`.

---

## 7. Reprendre le travail — checklist rapide

1. Définir `DATABASE_URL` (§3).
2. Pour ré-enrichir : récupérer les `.sql` depuis `../_archive_supabase/scripts_sql/`
   puis `python scripts/run_all_enrichment.py` (idempotent).
3. Pour la veille prix : `clean_market_prices.py` → `match_catalog_market.py` →
   `apply_market_prices.py`.
4. Toujours vérifier le trigger `trg_refresh_product_counts` (réactivé) après un gros batch.
