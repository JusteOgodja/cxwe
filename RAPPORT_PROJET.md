# Morocco Food Export — Rapport de projet

**Plateforme catalogue B2B de produits alimentaires marocains destinés à l'export.**

| | |
|---|---|
| **Dépôt** | github.com/JusteOgodja/cxwe |
| **Site en ligne** | https://morocco-foodexport.netlify.app |
| **Stack** | Vite · React · TypeScript · Tailwind CSS · Supabase (PostgreSQL, Auth, RLS) · Netlify |
| **Date du rapport** | 10 juillet 2026 |
| **Périmètre** | Mise en ligne, ingestion & nettoyage de données, refonte UX, audit qualité |

---

## Sommaire

1. [Résumé exécutif (lecture commerciale)](#1-résumé-exécutif)
2. [Architecture technique](#2-architecture-technique)
3. [Déroulé du projet — journal des travaux](#3-déroulé-du-projet)
4. [Qualité des données — méthodologie & résultats](#4-qualité-des-données)
5. [État actuel du catalogue (chiffres)](#5-état-actuel-du-catalogue)
6. [Points de vigilance & sécurité](#6-points-de-vigilance--sécurité)
7. [Ce qui reste à faire](#7-ce-qui-reste-à-faire)
8. [Annexe technique — scripts & reproductibilité](#8-annexe-technique)

---

## 1. Résumé exécutif

**Le point de départ.** Un jeu de ~33 500 produits issus du **scraping de sites e-commerce marocains** (retail), destiné à alimenter un catalogue B2B « produits alimentaires marocains pour l'export ».

**Le problème de fond identifié.** La *source* (ce qui se vend au Maroc) ne correspondait pas à l'*objectif* (produits marocains à exporter) : présence massive de non-alimentaire (cosmétique, hygiène, puériculture), de produits importés (jambon espagnol, whisky japonais…), de doublons et d'erreurs de données.

**Ce qui a été livré.**
- ✅ **Site en ligne et fonctionnel** (catalogue, recherche, pages catégories/marques, demande de devis).
- ✅ **Catalogue chargé, nettoyé et recentré** sur l'alimentaire marocain : de 33 500 produits bruts à **16 843 produits actifs pertinents**.
- ✅ **Qualité de données fortement relevée** : textes, images, prix, catégories, marques, conservation — voir §4.
- ✅ **Performance & UX** : pagination, filtres, recherche produits, images optimisées (−93 % de poids).
- ✅ **Traçabilité totale** : chaque opération est réversible et scriptée (aucune donnée détruite).

**La valeur pour le business.** Le catalogue est passé d'un dump de scraping hétérogène à une **base crédible et présentable**, cohérente avec un positionnement « FMCG alimentaire marocain export ». Les limites restantes sont **documentées et honnêtes** (voir §7) : les données réglementaires/export (EAN, certifications, incoterms…) nécessitent un vrai sourcing fournisseur — elles ne peuvent pas être inventées sans risque de crédibilité.

---

## 2. Architecture technique

### Stack
- **Frontend** : Vite + React 18 + TypeScript, Tailwind CSS, React Router.
- **Backend / données** : Supabase — PostgreSQL managé, Auth (JWT), Row-Level Security (RLS).
- **Hébergement** : Netlify (build automatique sur `git push` vers `main`), CDN edge, **Netlify Image CDN** pour l'optimisation d'images.
- **CI/CD** : déploiement continu GitHub → Netlify.

### Modèle de données (principales tables)
- `products` — fiche produit (nom, description, image, catégorie, marque, prix via `product_pricing_tiers`, température, durée de conservation, `is_active`, + ~40 champs B2B/export).
- `categories` (32) · `brands` (1 875) · `product_pricing_tiers` (prix par palier) · `suppliers`, `quote_requests`, `collaboration_requests` (structurés, à alimenter).

### Sécurité applicative
- **RLS activé** : lecture publique des produits actifs ; écriture réservée aux utilisateurs authentifiés.
- **Back-office** `/admin` protégé par Supabase Auth.
- ⚠️ Voir §6 pour un point de sécurité à corriger (inscription publique).

### Principe de réversibilité
Aucune donnée n'est supprimée lors du nettoyage : les produits hors-périmètre sont **masqués** (`is_active=false`) et réactivables à tout moment. Un **backup complet** de la table produits a été réalisé avant les opérations destructives.

---

## 3. Déroulé du projet

### Phase A — Mise en route & ingestion
- Diagnostic du dépôt, configuration de l'environnement (`.env`), connexion à Supabase.
- Création du schéma (migrations SQL consolidées).
- **Ingestion de 33 546 produits** + 32 catégories + paliers de prix, via un script d'import idempotent avec mode `--dry-run`.
- Déduplication « même source » : **−1 688 doublons** → 31 858 produits.

### Phase B — Correction des corruptions de données
- **9 953 produits** : correction d'entités HTML (`&#039;`, `&amp;amp;`), balises HTML résiduelles, mojibake d'encodage (`Ã©`→`é`), espaces parasites.
- **1 848 URLs d'images** malformées (fragments JSON-LD) réparées ou vidées.
- **5 018 noms** tout en majuscules normalisés en casse propre (en préservant unités et marques).
- **2 753 prix** d'origine EUR convertis en MAD (taux 10,8).

### Phase C — Refonte UX & performance
- **Pagination** des pages catégories (24/produits par page) puis **pagination côté serveur** (suppression du plafond de 1 000, ex. Chocolate = 3 250 produits navigables).
- **Onglet Marques** enrichi : pagination, barre alphabétique A-Z, filtre par catégorie, **recherche de produits** (autocomplétion sur tout le catalogue).
- **Optimisation des images** via Netlify Image CDN (redimensionnement + WebP + cache edge) + lazy-loading : **−93 % de poids** (ex. 155 Ko → 11,5 Ko par image).
- Correctifs TypeScript, build de production validé.

### Phase D — Audit qualité & recentrage périmètre
Audit systématique de ~20 points de vigilance, puis nettoyage validé point par point (voir §4).

Chaque étape a suivi le même protocole : **rapport (lecture seule) → validation → `--dry-run` → application → vérification**.

---

## 4. Qualité des données

### Méthodologie
Toutes les corrections reposent sur des **règles déterministes et traçables**, avec un principe strict : **ne jamais inventer de donnée non vérifiable**. Trois familles de traitement :

- **Corrigeable** depuis les données existantes (texte, catégorisation, prix aberrants).
- **Estimable** et marqué comme tel (température/conservation par catégorie).
- **Non inventable** → laissé vide et documenté (EAN, certifications, ingrédients…).

### Opérations réalisées

| Traitement | Volume | Nature |
|---|---|---|
| Doublons « même source » supprimés | 1 688 | même produit listé 2× sur un même site |
| Corrections texte (entités/mojibake/balises) | 9 953 | lisibilité |
| URLs d'images réparées | 1 848 | affichage |
| Noms normalisés (casse) | 5 018 | présentation |
| Prix EUR → MAD convertis | 2 753 | cohérence tarifaire |
| **Hors-périmètre / mal catégorisés masqués** | 1 192 | Essential Oils + intrus dans catégories food |
| **Prix aberrants masqués** | 190 | ex. « Riz Cigala 25 844 MAD » (erreur source) |
| **Imports étrangers masqués** | 401 | jambon espagnol, whisky japonais… (hors « export marocain ») |
| **Non-food « Hygiene & Paper » masqué** | 13 232 | cosmétique, soins, puériculture (le nom était trompeur : 1 % de papier réel) |
| Marques douteuses désactivées | 62 | 50 vides + 12 enseignes (Carrefour, Bienmanger…) |
| Produits déliés de fausses marques-enseignes | 374 | `marque_id` remis à NULL (honnête) |
| Température & durée de conservation estimées par catégorie | 17 528 | fin du tout-« Ambiante / 365 jours » |

### Exemple de rigueur méthodologique
- Les **prix aberrants** ont été **croisés avec le prix d'origine du fichier source** pour distinguer une erreur de scraping d'une erreur de conversion.
- Les **certifications** (Halal, Bio…) n'ont **pas** été renseignées automatiquement : un label de conformité déduit d'un mot du nom n'est pas vérifiable et constituerait un risque légal/commercial à l'export.
- La **température** n'a été modifiée que là où c'est **factuel** (surgelés → Surgelé, fromages → Réfrigéré) ; les produits secs restent « Ambiante » (correct).

---

## 5. État actuel du catalogue

| Indicateur | Valeur |
|---|---|
| Produits **actifs** (visibles) | **16 843** |
| Produits masqués (réversibles) | ~15 000 |
| Catégories actives | 31 |
| Marques actives | 1 813 |
| Produits avec prix | 80 % |
| Produits avec image | 98 % |
| Produits avec description | 76 % |
| Produits avec marque | 42 % |
| Devise | MAD (homogène) |

**Lecture :** le catalogue actif est désormais **quasi 100 % alimentaire** (+ 206 articles papier/entretien FMCG conservés), cohérent avec le positionnement « Morocco Food Export ».

---

## 6. Points de vigilance & sécurité

### 🔴 Sécurité — à corriger avant mise en avant commerciale
- **Inscription publique ouverte** sur Supabase Auth. Or l'app accorde l'accès `/admin` à **tout utilisateur authentifié** → n'importe qui pourrait s'inscrire et obtenir des droits d'administration.
- **Action requise** (côté propriétaire) : désactiver « Allow new users to sign up » dans Supabase → Authentication, puis créer manuellement le(s) compte(s) admin.

### 🟠 Données non vérifiables (honnêteté intellectuelle)
- `pays_origine = Morocco` reste une **hypothèse par défaut** pour les produits sans signal d'origine (la donnée n'a jamais été collectée à la source). Les imports manifestes ont été retirés, ce qui fiabilise le reste sans le garantir.
- Les champs B2B/réglementaires sont **vides à 100 %** (voir §7) — assumé et documenté.

---

## 7. Ce qui reste à faire

### Données à **sourcer** (non inventables — nécessitent un vrai flux fournisseur / API)
| Champ | Source recommandée |
|---|---|
| `ean` (code-barres) | Open Food Facts / GS1 Maroc |
| `hs_code` (code douanier) | Système Harmonisé — déductible par catégorie (indicatif) |
| `certifications` (Halal, Bio, ISO 22000, HACCP…) | Fournisseur / organisme certificateur |
| `ingredients_texte`, `nutrition_texte`, `allergenes` | Étiquette produit / Open Food Facts |
| `commande_min` (MOQ), `colisage` réels | Fiche commerciale fournisseur |
| `incoterms_dispo`, `pays_export_autorises` | Politique commerciale export |
| `dimensions_carton`, `palettisation` | Fiche logistique fournisseur |
| `fournisseur` | Référencement fournisseurs réels |

> **Sans ces champs, la base reste un *catalogue produit* de qualité, mais pas encore une *base d'export* pleinement exploitable par un acheteur international.** Leur ajout est la prochaine étape à forte valeur.

### Améliorations produit optionnelles
- Compléter les descriptions manquantes (génération factuelle à partir de nom + catégorie + origine).
- Réviser les ~560 marques à un seul produit (risque de faux positifs de scraping).
- Distinguer les offres multi-plateformes du même produit (doublons commerciaux restants).

---

## 8. Annexe technique

### Reproductibilité
L'ensemble du nettoyage est **scripté, idempotent et testable à blanc** (`--dry-run`). Scripts versionnés dans `supabase/` :

| Script | Rôle |
|---|---|
| `seed.mjs` | Ingestion complète du catalogue |
| `fix_text.mjs` | Entités HTML / mojibake / balises |
| `fix_images.mjs` | URLs d'images malformées |
| `fix_case.mjs` | Normalisation de casse |
| `dedup.mjs` / `dedup_samesource.mjs` | Déduplication |
| `fix_prices.mjs` | Conversion EUR → MAD |
| `seed_brands.mjs` | Création & rattachement des marques |
| `scope_report.mjs` / `apply_scope.mjs` | Détection & masquage hors-périmètre |
| `price_outliers.mjs` / `apply_price_outliers.mjs` | Prix aberrants |
| `apply_conservation.mjs` | Température & durée de conservation par catégorie |
| `apply_brands.mjs` | Nettoyage des marques |
| `apply_origin.mjs` | Masquage des imports étrangers |
| `apply_hygiene.mjs` / `apply_hygiene_rest.mjs` | Recentrage de la catégorie hygiène |
| `export_db.mjs` | Export complet de la base (JSON) |

### Gouvernance des données
- **Secrets** (`.env`, clés service) et **données volumineuses** (exports, backups, jeu source) sont exclus du dépôt Git (`.gitignore`).
- **Backup** de la table produits réalisé avant les suppressions/masquages.
- Toutes les opérations de masquage sont **réversibles** (`is_active`).

---

*Document généré le 10 juillet 2026. Chiffres issus de la base de production Supabase.*
