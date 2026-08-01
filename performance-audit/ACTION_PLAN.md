# Plan d'action — performance

Ordre recommandé : d'abord ce qui a le meilleur rapport gain/risque (images), puis le réseau
(N+1), puis le structurel (code splitting). Chaque lot doit être validé (build + mesure +
comparaison à `BASELINE.md`) avant le suivant.

## STATUT DES LOTS

- **Lot A (images hero + logo + stabilité visuelle)** : ✅ **RÉALISÉ** (local, non déployé).
  Preuve host-indépendante : logo 495 Ko → 13 Ko ; hero 6 slides (2 074 Ko) → 1 prioritaire ;
  ≈ 2,3 Mo retirés du chemin critique accueil ; CLS non dégradé. Détails :
  `lighthouse/COMPARISON.md` et section « Lot A » du rapport. **À reconfirmer en production
  après déploiement.**
- Lots B/C (N+1, code splitting, docx, comptages, index) : **non commencés** (volontairement).

---

## A. Corrections rapides (faible risque, faible effort)

1. **Optimiser `logo.png`** — exporter en ~64×64 (ou 128×128 pour le 2×), WebP/PNG optimisé.
   - Fichier : `public/logo.png` + `<img>` dans `src/components/Navbar.tsx` (+ ajouter
     `width`/`height`).
   - Cible : poids logo 495 Ko → < 10 Ko. Gain : modéré. Risque : nul.

2. **Optimiser les images hero** — convertir `public/hero/slide1..6.jpg` en WebP/AVIF,
   redimensionner à la taille d'affichage réelle, ne charger en priorité que la 1ʳᵉ slide,
   différer les suivantes.
   - Fichiers : `public/hero/*`, composant hero de `src/pages/Home.tsx`.
   - Cible : ~2 Mo → < 400 Ko cumulés ; LCP à confirmer. Gain : important. Risque : faible.

3. **Ajouter `width`/`height` (ou aspect-ratio)** aux images de cartes et au hero pour
   supprimer le CLS.
   - Fichiers : `BrandCard.tsx`, `CategoryCard.tsx`, hero de `Home.tsx`.

4. **Remplacer `select('*')`** par les colonnes réellement utilisées.
   - Fichiers : `src/pages/Home.tsx` (categories), `src/contexts/AuthContext.tsx` (profil).

## B. Corrections structurantes (effort plus important)

5. **Supprimer le N+1 des images de cartes** — au lieu d'une requête par carte, faire **une
   seule** requête groupée renvoyant quelques images par catégorie/marque, puis distribuer.
   - Piste recommandée : une RPC `category_preview_images(limit_per int)` renvoyant N images
     par catégorie en une passe (utilise `idx_products_category_active`), consommée une fois
     par `Home`/`Catalog` puis passée en props aux cartes.
   - Fichiers : nouvelle migration RPC + `Home.tsx`, `Catalog.tsx`, `CategoryCard.tsx`,
     `BrandCard.tsx` (recevoir les images en props au lieu de fetch interne).
   - Cible : 35 → ~5 requêtes Supabase sur l'accueil. Gain : important. Risque : moyen
     (refactor de composants) — à couvrir par tests de rendu.

6. **Code splitting par route** — `React.lazy` + `Suspense` sur les pages, en isolant tout le
   dossier `admin/` et la fiche produit.
   - Fichier : `src/App.tsx` (imports → `lazy(() => import(...))`).
   - Cible : chunk public initial nettement < 200 Ko br. Gain : modéré-important. Risque :
     moyen (fallbacks de chargement à soigner).

7. **Charger `docx` dynamiquement** — `const { generateProforma } = await import(...)` au clic
   sur « générer la proforma », pas à l'import du module.
   - Fichiers : `src/components/admin/ResponseModal.tsx`, `src/lib/generateProforma.ts`.
   - Cible : sortir `docx` du chunk initial. Gain : modéré. Risque : faible.

8. **Remplacer les comptages `count:'exact'`** d'affichage par un comptage estimé/planifié ou
   une RPC de stats mise en cache (les compteurs d'accueil n'ont pas besoin d'être exacts).
   - Fichiers : `src/pages/Home.tsx`.

9. **(Préventif) Cache de données client** — introduire React Query ou SWR pour éviter de
   refetcher les mêmes listes à chaque navigation. Décision d'architecture, à isoler.

## C. Mesures à surveiller (suivi en production)

- Exécuter **Lighthouse** (mobile + desktop, 3 passes, médiane) sur `/`, `/catalog`,
  `/product/:id`, `/quote` depuis un poste équipé, et archiver dans
  `performance-audit/lighthouse/`.
- Mettre en place **Playwright** pour les parcours critiques (`performance-audit/playwright/`),
  avec attente d'état réel (pas de délai fixe).
- Suivre les **Core Web Vitals réels** via l'API `web-vitals` ou le rapport CrUX (utilisateurs
  marocains) — les mesures d'audit local ne reflètent pas la latence réelle.
- **Rationaliser les index** redondants de `products` (hors chemin critique, tester d'abord).
- Re-mesurer après chaque lot et consigner l'écart vs `BASELINE.md`.

## Méthode de validation par lot

1. `npm run build` (vérifier taille des chunks).
2. `npm run typecheck` / `npm run lint`.
3. Redéploiement **uniquement si demandé**.
4. Re-mesure (curl + Performance API) sur la ou les pages concernées.
5. Comparaison à `BASELINE.md`, documentation du résultat réel.

Une correction n'est validée que si la mesure après montre une amélioration (ou corrige une
erreur clairement identifiée).
