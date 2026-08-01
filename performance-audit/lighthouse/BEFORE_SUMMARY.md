# Lighthouse BEFORE — production (avant lot A)

- **Cible** : https://morocco-foodexport.netlify.app (version en ligne, images d'origine)
- **Outil** : `lighthouse@11` via `npx` (non ajouté au dépôt), Chrome headless.
- **Catégorie** : `performance` uniquement (pour tenir le budget temps ; accessibilité/SEO
  non requis par ce tableau).
- **Paramètres** : mobile = preset par défaut (Slow-4G + CPU×4 simulés) ; desktop =
  `--preset=desktop`. **3 passes par route×mode, médiane retenue.**
- **Date** : 2026-08-01. Rapports JSON+HTML dans `performance-audit/lighthouse/before/`.
- **Fiche produit testée** : `/product/9a8f89dd-430d-4e17-845c-fc9fbc3c9509` (produit réel actif).

| Route | Mode | Perf | FCP (ms) | LCP (ms) | CLS | TBT (ms) | Speed Index (ms) | TTFB (ms) | Poids (Ko) | Requêtes | Images (Ko) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| home | mobile | **46** | 3518 | **5653** | 0.002 | 716 | **8824** | 89 | 5240 | 209 | **4848** |
| home | desktop | **79** | 1302 | 1935 | 0.002 | 16 | 3689 | 80 | 6754 | 292 | **6362** |
| catalog | mobile | 60 | 3565 | **8194** | 0.003 | 194 | 6582 | 111 | 3619 | 236 | 3135 |
| catalog | desktop | 71 | 1455 | 2561 | 0.002 | 24 | 2759 | 111 | 4015 | 282 | 3531 |
| product | mobile | 52 | 3059 | 5291 | **1.026** | 389 | 4802 | 76 | 859 | 8 | 495 |
| product | desktop | 89 | 790 | 1151 | **0.187** | 6 | 1151 | 94 | 859 | 8 | 495 |
| quote | mobile | 69 | 3018 | 5304 | 0.026 | 199 | 3652 | 80 | 859 | 8 | 495 |
| quote | desktop | 90 | 720 | 1022 | 0.187 | 0 | 1143 | 77 | 859 | 8 | 495 |

## Lecture

- **Accueil = page la plus lourde** : 5–6 Mo d'images, 200–290 requêtes, LCP mobile 5,6 s,
  Speed Index mobile 8,8 s. C'est la cible du lot A (hero + logo) — mais une grande part du
  poids vient aussi des **vignettes de catégories** (N+1, hors lot A).
- **CLS accueil excellent (0,002)** → le lot A ne doit **pas** le dégrader (pas de gain CLS
  attendu sur l'accueil, il est déjà bon).
- **CLS élevé ailleurs** : fiche produit **1,026** (mobile) / 0,187 (desktop), quote 0,187
  (desktop). Cause probable : image produit et/ou logo sans dimensions. **Hors périmètre du
  lot A** (qui ne touche que l'accueil). Le logo recevant désormais des dimensions pourrait
  aider marginalement product/quote ; l'image produit reste à traiter dans un lot ultérieur.
- **Catalogue** : LCP mobile 8,2 s → très lent (N+1 + vignettes), lot ultérieur.

## Limites

- Catégorie performance seulement (pas de scores Accessibility/BestPractices/SEO ici).
- Mesures prises depuis la machine d'audit (la simulation Lighthouse atténue l'effet de la
  distance réseau, mais le TTFB réel d'un utilisateur marocain peut différer).
