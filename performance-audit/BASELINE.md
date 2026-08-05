# Baseline — mesures avant optimisation

Mesures réelles prises le 2026-08-01 depuis la machine d'audit.
FCP/LCP/CLS/INP **non mesurables** avec les outils disponibles (voir README « Limites »).
On utilise DOMContentLoaded (DCL), poids transféré et compteurs de requêtes comme référence.

## Page d'accueil (`/`) — mesuré en production

| Métrique | Valeur mesurée | Cible | Verdict |
|---|---:|---:|---|
| TTFB HTML (curl, médiane) | ~830 ms | < 800 ms | ⚠️ limite (inclut distance réseau audit) |
| TTFB HTML (à froid) | 1 390 ms | — | ⚠️ démarrage |
| DOMContentLoaded | **4 943 ms** | — | 🔴 lent |
| load | 4 948 ms | — | 🔴 |
| Requêtes totales | 45 | — | — |
| **Requêtes Supabase** | **35** | ~4 | 🔴 N+1 |
| Poids transféré total | **2 870 Ko** | < 1 000 Ko | 🔴 |
| JS (1 chunk, Brotli) | 298 Ko | < 200 Ko | 🔴 |
| CSS (Brotli) | 9 Ko | — | ✅ |
| Images hero (statique) | ~2 000 Ko | — | 🔴 non optimisées |
| LCP / FCP / CLS / INP | non mesuré | — | ⛔ outil indisponible |

## Détail des requêtes Supabase sur l'accueil (durées observées)

| Requête | Durée |
|---|---:|
| `categories?select=*&is_active=eq.true&order=sort_order` | 972 ms |
| `products?select=*&count=exact` (head) | 900 ms |
| `brands?select=*&count=exact` (head) | 771 ms |
| `categories?select=*&count=exact` (head) | 720 ms |
| **31 × `products?select=image_url&category_id=eq.<uuid>&is_active=eq.true&limit=7`** | 200–600 ms chacune |

→ 4 requêtes « métier » + **31 requêtes image en N+1** (une par carte catégorie).

## Ressources les plus lourdes (accueil)

| Ressource | Poids | Durée | Type | Observation |
|---|---:|---:|---|---|
| `/hero/slide6.jpg` | 652 Ko | 7 577 ms | CSS bg | JPEG non optimisé, hors Image CDN |
| `/logo.png` | 495 Ko | 417 ms | img | **1254×1254 affiché en 56×56** |
| `/hero/slide2.jpg` | 387 Ko | 677 ms | CSS bg | idem |
| `/hero/slide5.jpg` | 347 Ko | 5 450 ms | CSS bg | idem |
| `/hero/slide1.jpg` | 298 Ko | 561 ms | CSS bg | idem |
| `/hero/slide3.jpg` | 296 Ko | 718 ms | CSS bg | idem |
| `/assets/index-*.js` | 298 Ko (br) | 598 ms | script | bundle unique |
| `/hero/slide4.jpg` | 95 Ko | 5 352 ms | CSS bg | idem |

## En-têtes / cache (✅ corrects)

| Ressource | Cache-Control | Compression |
|---|---|---|
| HTML | `public,max-age=0,must-revalidate` | Brotli |
| JS/CSS (hashés) | `public,max-age=31536000,immutable` | Brotli |

## Bundle (build local)

| Fichier | Brut | gzip |
|---|---:|---:|
| `dist/assets/index-*.js` | 1 173 Ko | 314 Ko |
| `dist/assets/index-*.css` | 62 Ko | 9,9 Ko |

Chunk unique (aucun code splitting). Durée build ~30 s.

## Parcours non mesurés

- Catalogue `/catalog`, fiche produit `/product/:id`, formulaire `/quote`, pages admin
  authentifiées : **non instrumentés** faute de Playwright/Lighthouse. Le code indique
  toutefois le même schéma N+1 (BrandCard/CategoryCard) sur `/catalog`.

---

## Après lot A (build local — voir lighthouse/COMPARISON.md)

Les mesures de production ci-dessus restent la référence (non modifiées). Ajout post-lot A
(mesures **locales**, confond Netlify Image CDN — voir COMPARISON.md) :

| Élément (accueil) | Avant (prod) | Après (lot A) | Écart | Fiabilité |
|---|--:|--:|--:|---|
| Logo servi | 495 Ko | 13 Ko (PNG) / 8,5 Ko (WebP) | −97 % | ✅ host-indépendant |
| Hero — slides au 1er rendu | 6 (2 074 Ko) | 1 prioritaire | — | ✅ host-indépendant |
| Hero — poids observé desktop | 2 074 Ko | 293 Ko | −86 % | ✅ |
| Hero — poids observé mobile | 2 074 Ko | 128 Ko | −94 % | ✅ |
| Poids retiré du chemin critique | — | ≈ 2,3 Mo | — | ✅ |
| home desktop Perf / LCP | 79 / 1935 ms | 90 / 1058 ms | +11 / −877 | ⚠️ confondu localhost |
| home mobile CLS | 0.0017 | 0.0017 | 0 | ✅ stable |
