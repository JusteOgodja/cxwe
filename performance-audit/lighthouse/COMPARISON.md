# Comparaison avant / après — Lot A (hero + logo + stabilité visuelle)

- **AVANT** : Lighthouse **production** (version en ligne, images d'origine) — `before/`.
- **APRÈS** : Lighthouse **local** (`vite preview` du build modifié) — `after-local/`.
  Le déploiement n'était pas autorisé → mesures locales, **clairement étiquetées**.

## ⚠️ Confound à connaître (honnêteté méthodologique)

Le **Netlify Image CDN** (`/.netlify/images?...`) qui sert et transforme les **vignettes de
catégories** n'existe **pas** sur le preview localhost. En local, ces vignettes ne se
transfèrent donc pas de la même façon (endpoint absent). **Conséquence :** la baisse du *poids
total* et du *poids images* entre prod-avant et local-après est **partiellement un artefact**
et **ne doit pas** être attribuée au lot A.

➡️ On isole donc la **part réellement attribuable au lot A** : le **hero** et le **logo**, qui
sont des fichiers de `public/` servis **à l'identique** en local et en production. Ces chiffres
sont **host-indépendants et fiables**.

## Preuve déterministe du lot A (fiable, host-indépendante)

| Élément (accueil) | Avant | Après | Écart | Verdict |
|---|--:|--:|--:|---|
| **Logo servi** | 495 Ko | 13 Ko (PNG) / 8,5 Ko (WebP) | −97 % | ✅ < 20 Ko |
| **Hero — slides chargées au 1er rendu** | 6 (toutes) | **1 prioritaire** (slide 0) | — | ✅ |
| **Hero — poids total observé** (desktop) | 2 074 Ko (6 JPEG) | 293 Ko (WebP, chargées progressivement) | −86 % | ✅ |
| **Hero — poids total observé** (mobile) | 2 074 Ko | 128 Ko | −94 % | ✅ |
| **Format hero** | JPEG | WebP (+ fallback JPEG) | — | ✅ |
| **Poids retiré du chemin critique accueil (hero+logo)** | — | **≈ 2,3 Mo** | — | ✅ |

> Note : « slides chargées » = 4 sur la fenêtre de mesure Lighthouse (~30–40 s) car le
> carrousel avance tout seul (4 s/slide) et charge la suivante à la demande — mais **une seule**
> est prioritaire au **premier rendu**, et **jamais les 6 d'un coup**. Critère respecté.

## Lighthouse (indicatif — confondu par localhost, à reconfirmer après déploiement)

| Route | Mode | Métrique | Avant (prod) | Après (local) | Écart | Verdict |
|---|---|---|--:|--:|--:|---|
| home | desktop | Performance | 79 | 90 | +11 | ✅ mais confondu |
| home | desktop | LCP (ms) | 1935 | 1058 | −877 | ✅ (part réelle : hero prioritaire) |
| home | desktop | CLS | 0.0023 | 0.0016 | −0.0007 | ✅ pas de régression |
| home | desktop | Speed Index (ms) | 3689 | 3151 | −538 | ✅ |
| home | mobile | Performance | 46 | 47 | +1 | ⚠️ bruité |
| home | mobile | LCP (ms) | 5653 | 3948 | −1705 | ✅ (tendance) |
| home | mobile | CLS | 0.0017 | 0.0017 | 0 | ✅ stable |
| home | mobile | TBT (ms) | 716 | 1448 | +732 | ⚠️ **régression apparente** |
| home | mobile | Speed Index (ms) | 8824 | 10457 | +1633 | ⚠️ **régression apparente** |

### Interprétation prudente
- **Desktop** : nette amélioration (Perf, LCP, SI) — mais partiellement due à l'absence du
  Image CDN en local ; la **part réelle** vient du hero prioritaire + logo léger.
- **Mobile** : LCP en baisse (bon signe), mais **TBT et Speed Index se dégradent**. Ces deux
  métriques dépendent du CPU/rendu ; les mesures locales ont été prises sur une machine
  chargée (serveur preview + Chrome + parsing) avec throttle CPU ×4 → **forte variabilité,
  peu fiable**. De plus, les vignettes cassées (Image CDN absent en local) peuvent perturber
  le calcul du Speed Index. **On ne conclut pas** à une régression réelle sur cette base.
- **Conclusion** : les gains de **poids** (hero+logo) sont **prouvés et host-indépendants** ;
  les scores Lighthouse doivent être **reconfirmés en production après déploiement**.

## Reproduire les mesures après déploiement (production)

```bash
export CHROME_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"
for mode in mobile desktop; do P=""; [ "$mode" = desktop ] && P="--preset=desktop"; for p in 1 2 3; do
  npx --yes lighthouse@11 "https://morocco-foodexport.netlify.app/" --only-categories=performance $P \
    --output=json --output=html --output-path="performance-audit/lighthouse/after/home_${mode}_${p}" \
    --chrome-flags="--headless=new --no-sandbox --disable-gpu" --quiet ; done; done
node performance-audit/lighthouse/extract.cjs   # adapter le dossier 'after-local' -> 'after'
```
