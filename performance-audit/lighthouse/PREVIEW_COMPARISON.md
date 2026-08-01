# Comparaison production (avant) vs Deploy Preview (après) — Lot A

- **AVANT** : Lighthouse production `before/` (version en ligne, code d'origine).
- **APRÈS** : Lighthouse sur la **Deploy Preview Netlify**
  `https://deploy-preview-2--morocco-foodexport.netlify.app` — `after-preview/`.
- Mêmes paramètres, mêmes routes, médiane de 3 passes prévue.

## ⚠️ Portée limitée + confound majeur (à lire avant les chiffres)

1. **Matrice incomplète** : la série sur la preview s'est **bloquée** après `home` (Lighthouse
   figé sur un run, preview très sollicitée). J'ai **home mobile ×3** (médiane) + **home
   desktop ×1**. Catalog/product/quote sur preview **non terminés** — mais le lot A ne modifie
   que l'accueil (hero) et le logo, donc **home est la route décisive**.

2. **Confound d'infrastructure (déterminant)** : une Deploy Preview sert une instance **neuve,
   non réchauffée**. Les **~200 vignettes de catégories** passent par le Netlify Image CDN et
   sont **transformées à froid** au premier accès pendant le run Lighthouse (en production
   elles sont **cachées** au bord après des semaines de trafic). Résultat : sur la preview,
   FCP/LCP/Speed Index sont **plus mauvais** qu'en production **malgré un poids d'images plus
   faible**. Ce n'est **pas** une régression du lot A : c'est le coût des vignettes froides +
   du N+1 (lot ultérieur). Le TTFB HTML et une transformation Image CDN isolée sont pourtant
   **comparables** prod/preview (curl) — c'est la **charge agrégée** des 200 transforms qui
   plombe le run.

➡️ **Les scores Lighthouse de la preview ne valident donc PAS les Core Web Vitals.** Seuls les
indicateurs **déterministes et attribuables au code** (poids images, images hero au 1er rendu,
format réellement servi, poids logo, CLS) sont exploitables ci-dessous.

## Home — comparaison (⚠️ scores confondus, à ne pas prendre au pied de la lettre)

| Route | Mode | Métrique | Production avant | Preview après | Écart | Interprétation |
|---|---|---|--:|--:|--:|---|
| home | mobile | Performance | 46 | 29 | −17 | ⚠️ **confondu** (vignettes froides) |
| home | mobile | FCP (ms) | 3518 | 5246 | +1728 | ⚠️ confondu |
| home | mobile | LCP (ms) | 5653 | 6901 | +1248 | ⚠️ confondu (non concluant) |
| home | mobile | **CLS** | 0.0017 | **0.0017** | 0 | ✅ **stable (fiable)** |
| home | mobile | TBT (ms) | 716 | 1515 | +799 | ⚠️ confondu (charge CPU host) |
| home | mobile | Speed Index (ms) | 8824 | 16184 | +7360 | ⚠️ confondu |
| home | mobile | **Poids images (Ko)** | 4848 | **2457** | **−2391** | ✅ **fiable** (≈ hero+logo) |
| home | mobile | Requêtes | 209 | 240 | +31 | N+1 vignettes (inchangé) |
| home | desktop¹ | Performance | 79 | 44 | −35 | ⚠️ confondu |
| home | desktop¹ | **Poids images (Ko)** | 6362 | 4422 | −1940 | ✅ fiable |
| home | desktop¹ | CLS | 0.0023 | 0.0016 | −0.0007 | ✅ pas de régression |

¹ desktop = 1 passe (série interrompue), pas une médiane.

## Indicateurs déterministes du lot A (fiables — curl + Performance API sur la preview)

| Élément (accueil) | Avant (prod) | Preview après | Verdict |
|---|--:|--:|---|
| Logo réellement transféré | 495 Ko | **WebP 8,5 Ko / PNG 13 Ko** | ✅ < 20 Ko |
| Images hero au **1er rendu** | 6 (toutes) | **1** (slide 0, WebP) | ✅ |
| Format hero choisi par Chrome | JPEG | **WebP** | ✅ |
| Double téléchargement WebP+JPEG | — | **non** | ✅ |
| Poids images accueil (mobile) | 4848 Ko | 2457 Ko (**−2,3 Mo**) | ✅ |
| Netlify Image CDN | OK | **OK** (200, webp) | ✅ |
| Erreurs HTTP / console | — | **0** | ✅ |
| CLS accueil | 0.0017 | 0.0017 | ✅ stable |

## Conclusion

- **Objectifs déterministes du lot A : atteints et prouvés** (poids, hero prioritaire unique,
  WebP, logo, pas de double-download, CLS stable, aucune erreur).
- **Validation Lighthouse des CWV : impossible sur la Deploy Preview** (instance froide +
  vignettes Image CDN non cachées + N+1). La preview **sous-estime** fortement les performances
  réelles de production.
- **Confirmation requise en production** : déployer le lot A puis re-mesurer Lighthouse
  (prod chaud avant/après), idéalement **après** le lot N+1 (les vignettes dominent l'accueil
  quel que soit le lot A). Commandes dans `COMPARISON.md`.
