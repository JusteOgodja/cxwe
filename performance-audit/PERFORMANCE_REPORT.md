# Rapport de performance — Morocco Food Export

Audit lecture seule, production, 2026-08-01.

## 1. Résumé exécutif

Le site est **fonctionnel et correctement configuré au niveau infrastructure** (CDN Netlify,
Brotli partout, cache immuable sur les assets hashés, HTTPS/HSTS, fallback SPA OK, base
Postgres très bien indexée). Les problèmes de performance sont **applicatifs** et concentrés
sur la **page d'accueil** :

1. **~2 Mo d'images hero JPEG non optimisées** chargées au premier rendu (une a mis 7,5 s).
2. **Anti-pattern N+1** : la page d'accueil déclenche **35 requêtes Supabase** (31 pour les
   images de catégories, une par carte) au lieu d'une seule requête groupée.
3. **Bundle JS unique de 298 Ko (Brotli)** sans code splitting : tout l'admin et la
   librairie `docx` (génération Word) sont livrés à chaque visiteur public.
4. **`logo.png` de 495 Ko** en 1254×1254 affiché en 56×56.
5. **Images sans `width`/`height`** → risque de décalage de mise en page (CLS).

Conséquence mesurée : **DOMContentLoaded ~5 s** et **2,87 Mo transférés** sur l'accueil.
Aucune de ces causes n'est liée à la latence géographique ni à la base de données.

## 2. Stack identifiée

- **Frontend** : Vite 5.4, React 18.3, TypeScript 5.5, react-router-dom 6.30, TailwindCSS 3.4.
- **i18n** : i18next / react-i18next (fr/en/ar).
- **Icônes** : lucide-react. **Export Word** : `docx` 9.7 + `file-saver` (admin uniquement).
- **Backend** : Supabase (Postgres) `eu-west-1`. Accès via `@supabase/supabase-js` avec la
  clé **anon** (RLS active). Auth : Supabase Auth, admin gaté par `VITE_ADMIN_EMAILS`.
- **Données** : requêtes directes PostgREST + 3 fonctions RPC (`search_products`,
  `get_quality_stats`, `list_source_sites`).
- **Pas** de Edge Functions, **pas** de Realtime, **pas** de Supabase Storage (les images
  produits sont des URLs externes servies via le Netlify Image CDN).
- Variables d'env (noms seulement) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_ADMIN_EMAILS`.

## 3. Environnement de test

Machine d'audit (Windows, Node 22.17). Latence TLS ~0,5 s observée vers la prod → distance
réseau réelle non négligeable ; les **volumes et compteurs** sont fiables, la latence absolue
non représentative d'un utilisateur marocain.

## 4. Résultats Lighthouse

**Non exécuté** : Lighthouse n'est pas installé et la règle d'audit interdit d'ajouter une
dépendance durant cette phase. À lancer en phase de correction depuis un poste équipé
(`npx lighthouse <url> --preset=desktop` et mobile), 3 passes, médiane.

## 5. Core Web Vitals

**FCP / LCP / CLS / INP non mesurés** : le navigateur intégré n'expose pas les entrées
`paint`/`largest-contentful-paint`. Indices indirects mesurés :
- DOMContentLoaded ~4,9 s (accueil) → **LCP très probablement > 2,5 s** (hypothèse forte,
  car l'image LCP est un hero JPEG de plusieurs centaines de Ko mettant plusieurs secondes).
- Images sans dimensions → **CLS probablement > 0,1** (hypothèse).
À confirmer par Lighthouse/CrUX.

## 6. Analyse du bundle

| Ressource | Taille brute | Compressé (Brotli) | Route | Observation |
|---|---:|---:|---|---|
| `assets/index-*.js` | 1 173 Ko | **298 Ko** | toutes | 🔴 chunk unique, > 200 Ko |
| `assets/index-*.css` | 62 Ko | 9 Ko | toutes | ✅ |
| `docx` (dans le JS) | ~1–2 Mo source | inclus ci-dessus | **admin only** | 🔴 livré au public |

- **Aucun `React.lazy` / `import()` dynamique** dans `src/`.
- `docx` importé statiquement par `src/lib/generateProforma.ts`, lui-même importé par
  `src/components/admin/ResponseModal.tsx` (admin). Comme rien n'est code-splitté, `docx`
  est dans le chunk que **tout visiteur public télécharge**.
- `lucide-react` : import par icône (tree-shakeable), pas d'inquiétude si les imports sont
  nommés (à vérifier qu'aucun `import * as` n'existe).

## 7. Analyse réseau (accueil, production)

- 45 requêtes, **2 870 Ko** transférés, **35 vers Supabase**.
- Compression Brotli active sur HTML/JS/CSS. Pas d'erreur HTTP. Pas de redirection superflue.
- Cascade : le JS doit d'abord s'exécuter, puis React monte, puis 4 requêtes initiales, puis
  31 requêtes image (déclenchées au montage de chaque `CategoryCard`). Les images hero (CSS)
  se chargent en parallèle mais sont lourdes.

## 8. Analyse Netlify

`netlify.toml` **bien configuré** :
- `/* → /index.html` (fallback SPA) ✅ — vérifié : `/catalog`, `/admin/sources` renvoient 200.
- Cache : assets hashés `immutable` 1 an ✅ ; HTML `max-age=0,must-revalidate` ✅.
- Netlify Image CDN autorisé pour les domaines produits ✅ (les vignettes produits passent
  par `?w=500&fit=cover&q=70`).
- **Manque** : les images statiques de `public/hero/*.jpg` et `public/logo.png` ne passent
  **pas** par l'Image CDN et ne sont ni redimensionnées ni converties en WebP/AVIF.

## 9. Analyse Supabase (inventaire des appels publics)

| Route / composant | Table / RPC | Type | Déclenchement | Données | Risque |
|---|---|---|---|---|---|
| `Home` | categories | select `*` | au montage | toutes colonnes | Faible (surface) |
| `Home` | products/brands/categories | count exact ×3 | au montage | count only | Moyen (~900 ms/ex.) |
| `CategoryCard` (×32) | products | select image_url | au montage de **chaque** carte | 7 images | 🔴 N+1 |
| `BrandCard` (×N) | products | select image_url | au montage de chaque carte | 7 images | 🔴 N+1 |
| `Catalog` | brands (paginé) | select `*` boucle range | au montage | toutes marques | Moyen |
| `Catalog` | brands count | count/head par marque manquante | après chargement | count | Moyen |
| `ProductDetail` | products + tiers + images | 3 requêtes parallèles | au montage | fiche | OK (parallèle) |
| `AuthContext` | buyer_profiles | select `*` | à chaque session | profil | Faible |

Points confirmés :
- **N+1** massif sur `CategoryCard`/`BrandCard` (une requête par carte).
- `select('*')` sur `categories` et `buyer_profiles` (colonnes inutiles transférées).
- **Comptages `count: 'exact'`** coûteux pour de simples statistiques d'affichage.
- Les `useEffect` publics ont des tableaux de dépendances corrects et une garde `cancelled` ;
  le double-appel éventuel en dev (StrictMode) **n'est pas** présent en prod.
- Filtres/tri réalisés **côté base** (bon) via `search_products` pour le catalogue.

## 10. Analyse SQL et index

La table `products` possède **24 index** — couverture **excellente** pour les requêtes
observées (rien à ajouter) :
- `idx_products_category_active (category_id) WHERE is_active` → couvre les requêtes
  `CategoryCard`. `idx_products_brand_active` → couvre `BrandCard`.
- `idx_products_fts` (GIN tsvector) + `idx_products_name_trgm` (GIN trigram) → recherche.
- `idx_products_sort (sort_order, created_at DESC)` → tri du catalogue.

**Aucun index manquant** pour les requêtes réelles. Le N+1 n'est donc **pas** un problème
d'index mais de **nombre d'allers-retours** : chaque requête est rapide, mais on en fait 31.

**Sur-indexation** (observation, pas une anomalie de lecture) : plusieurs index redondants —
`products_category_id_idx` double `idx_products_category_active` ; `products_ean_idx` double
la contrainte unique `products_ean_key` ; `products_statut_idx` recoupe `idx_products_statut`.
→ Coût inutile en écriture/stockage. À rationaliser hors chemin critique.

RLS : active (à conserver). Non désactivée. Complexité RLS non mesurée finement mais les
requêtes filtrées `is_active` restent indexées.

## 11. Images, polices, multimédia

- **Hero** `public/hero/slide1..6.jpg` : ~2 Mo cumulés, JPEG non optimisés, chargés en fond
  CSS → **hors** lazy-loading et **hors** Image CDN. C'est le poste le plus lourd de l'accueil
  et très probablement l'élément **LCP**.
- **`logo.png`** : 495 Ko, **1254×1254** affiché **56×56** (≈ 500× trop de pixels).
- **Vignettes produits** : correctement servies via Netlify Image CDN (`w=500&q=70`) ✅.
- **242 `<img>`** sur l'accueil, **sans `width`/`height`** → CLS. `loading="lazy"` présent
  sur les cartes (bien), mais les hero en CSS ne bénéficient pas de priorisation LCP.
- **Polices** : aucune police web personnalisée détectée (pile système / Tailwind) → pas de
  blocage de rendu lié aux polices. ✅

## 12. JavaScript et rendu

- Chunk unique → tout le JS (27 pages, admin, docx) est parsé au premier chargement.
- Carrousels : `BrandCard` fait défiler jusqu'à 7 images avec `setTimeout` par carte — 32+
  timers actifs simultanément sur le catalogue (charge CPU + réseau). À virtualiser/limiter.
- `useMemo` déjà utilisé à bon escient (filtrage catalogue). Pas de sur-mémorisation.
- Pas de virtualisation de longues listes (catalogue paginé côté client pour l'affichage,
  ce qui est acceptable vu la pagination serveur des produits).

## 13. Parcours Playwright

**Non exécutés** (Playwright absent). À implémenter en phase correction :
accueil → catalogue → filtre → fiche → recherche → formulaire, avec attente d'état réel
(pas de délai fixe). Dossier prévu : `performance-audit/playwright/`.

## 14. Erreurs détectées

- Aucune erreur console/HTTP bloquante observée sur l'accueil en production.
- Fallback SPA fonctionnel sur URLs profondes (`/catalog`, `/admin/sources` → 200).
- Tests d'expiration de session / redirections auth non réalisés (nécessitent un compte de
  test) — **non mesuré**.

## 15. Classement des problèmes

| Priorité | Problème | Preuve | Impact | Correction | Gain attendu | Effort |
|---|---|---|---|---|---|---|
| **Critique** | Hero ~2 Mo JPEG non optimisés au 1er rendu | slide6 652 Ko @7,5 s ; ~2 Mo cumulés | LCP élevé, accueil lent | WebP/AVIF + redimension + `fetchpriority` sur l'image LCP, précharger la 1ʳᵉ | Important (à confirmer) | Faible-Moyen |
| **Élevé** | N+1 : 31 requêtes image sur l'accueil | 35 requêtes Supabase mesurées | charge Supabase, rendu retardé | 1 requête groupée (RPC ou `in` + regroupement) pour les images par catégorie | Important | Moyen |
| **Élevé** | Bundle unique 298 Ko (br), docx+admin inclus | build : 1 chunk 1,17 Mo | TTI/parse plus longs | `React.lazy` par route + `import()` de `docx` | Modéré-Important | Moyen |
| **Élevé** | `logo.png` 495 Ko surdimensionné | 1254×1254 → 56×56 | poids inutile | export ~64×64 (ou 2×) WebP/PNG | Modéré | Faible |
| **Moyen** | Images sans `width`/`height` | `hasDims:false` | CLS | ajouter dimensions / ratio | Modéré (CLS) | Faible |
| **Moyen** | Comptages `count:'exact'` ×3 | 720–970 ms chacun | requêtes lentes | `head:true` + `count:'planned'`/estimé, ou RPC de stats mis en cache | Faible-Modéré | Faible |
| **Faible** | `select('*')` (categories, buyer_profiles) | inventaire | sur-transfert | sélectionner les colonnes utilisées | Faible | Faible |
| **Faible** | Sur-indexation (24 index, redondants) | `pg_indexes` | coût écriture | supprimer index redondants (hors audit) | Faible (écritures) | Faible |
| **Info** | Latence TLS ~0,5 s depuis la machine d'audit | curl | non applicable | mesurer depuis le Maroc / CrUX | — | — |

## 16. Première visite vs navigation interne

- **Première visite** : coûteuse (HTML → parse d'un gros JS → 35 requêtes Supabase → ~2 Mo
  d'images). C'est là que se concentrent tous les problèmes.
- **Navigation interne** : le bundle et les assets hashés sont en cache `immutable` (rechargés
  0 fois), donc les changements de route sont rapides côté JS ; mais chaque page relance ses
  requêtes Supabase (pas de cache de données type React Query) → les mêmes listes peuvent être
  refetchées. Recommandation préventive : cache de données côté client.

## 17. Constat vs hypothèse

- **Constats vérifiés (mesurés)** : 35 requêtes Supabase sur l'accueil ; N+1 CategoryCard ;
  ~2 Mo d'images hero non optimisées ; logo 495 Ko ; bundle 298 Ko br mono-chunk ; docx
  importé statiquement côté admin ; en-têtes cache/compression corrects ; 24 index products ;
  DOMContentLoaded ~5 s ; fallback SPA OK.
- **Hypothèses probables** : LCP > 2,5 s et CLS > 0,1 (déduits des images lourdes et de
  l'absence de dimensions, non mesurés directement).
- **Recommandations préventives** : cache de données client (React Query/SWR) ; rationalisation
  des index ; parcours Playwright et Lighthouse en CI.

## 18. Plan d'amélioration

Voir `ACTION_PLAN.md`. Priorité : (1) optimiser les images hero + logo, (2) regrouper les
requêtes images des cartes, (3) code splitting par route + `docx` dynamique.

---

## 19. Lot A — images hero, logo, stabilité visuelle (RÉALISÉ)

Périmètre strictement limité au lot A. **Non touchés** : schéma, migrations, RPC, RLS, auth,
variables d'env, appels Supabase, code splitting, `docx`, config Netlify.

### Modifications
- `public/logo.png` : 1254×1254 (495 Ko) → **256×256, 13 Ko** ; + `public/logo.webp` (8,5 Ko).
- `public/hero/slide1..6.jpg` : ré-encodés (JPEG optimisé, fallback) + **WebP 1600 px** et
  **WebP 900 px** (variante mobile) ajoutés.
- `src/pages/Home.tsx` (`HeroCarousel`) : les 6 slides ne sont plus des `background-image`
  chargées simultanément. Chaque slide est un `<picture>`/`<img>` ; **seule la slide 0** reçoit
  `fetchPriority="high"` + `loading="eager"`. Les autres sont `lazy`/`low` et ne sont chargées
  qu'à la demande (slide courante + suivante), avec préchargement de la 2ᵉ slide au ralenti.
  `srcSet`/`sizes` pour servir la variante mobile. Apparence, transitions, flèches, points,
  responsive et RTL **inchangés**.
- `src/components/Navbar.tsx` + `src/components/Footer.tsx` : logo en `<picture>` (WebP +
  fallback PNG) avec **dimensions explicites** (`width`/`height`) → réserve l'espace.

### Résultats (voir `lighthouse/COMPARISON.md`)
- **Prouvé, host-indépendant** : logo 495 Ko → 13 Ko ; hero au 1er rendu 6 slides (2 074 Ko)
  → 1 slide prioritaire ; **≈ 2,3 Mo retirés du chemin critique** de l'accueil ; CLS non
  dégradé (0,0016). Build/typecheck/lint OK.
- **Lighthouse (local, indicatif)** : desktop Perf 79→90, LCP 1935→1058 ms ; **confondu** par
  l'absence du Netlify Image CDN en local — à reconfirmer en production après déploiement.
  Mobile TBT/SI bruités (machine chargée) — non concluants.

### Sécurité (contrôle lecture seule, section 12) — CONCLUSION CORRIGÉE

> ⚠️ **Autorisation côté serveur présente, mais audit de sécurité complet encore nécessaire.**
> Ma conclusion précédente (« sécurité rassurante ») était **prématurée** : la vérification
> approfondie révèle une **faille d'escalade de privilèges**.

Preuves (fichiers / objets exacts, aucune valeur/email révélée) :

- ✅ **Frontend cosmétique** : `VITE_ADMIN_EMAILS` (utilisé dans `src/pages/admin/AdminLogin.tsx`
  et `src/pages/admin/AdminLayout.tsx`) ne fait que **masquer/afficher l'UI**.
- ✅ **Autorisation serveur** : `is_admin()` (migration `20260728000003_rls_admin_function.sql`)
  compare `auth.jwt() ->> 'email'` à `site_settings.admin_emails` ; les policies RLS
  `products_admin_*`, `categories_admin_*`, `brands_admin_write`, `suppliers_admin_write`,
  `buyer_profiles_admin_read` imposent `is_admin()` pour les écritures/lectures sensibles.
- ✅ **RPC** `search_products`, `list_source_sites`, `get_quality_stats` : `SECURITY INVOKER`
  (la RLS de l'appelant s'applique). Pas de Supabase Storage dans le projet.
- ⚠️ **`is_admin()` = `SECURITY DEFINER` sans `search_path` fixé** (`proconfig = null`) → faille
  de durcissement « search_path mutable » (à corriger : `SET search_path = public, pg_temp`).
- 🔴 **CRITIQUE — escalade de privilèges** : la table `site_settings` (qui contient
  `admin_emails`) a une policy RLS `site_settings_authenticated_all` en **`cmd = ALL`** avec
  `USING/CHECK = (auth.role() = 'authenticated')`. **N'importe quel utilisateur authentifié
  peut donc écrire dans `site_settings`**, s'ajouter à `admin_emails`, et devenir admin
  (`is_admin()` renvoie alors `true`). Le contrôle d'accès admin est donc **contournable**.

**À traiter dans un lot sécurité dédié** (hors lot A) : restreindre les écritures de
`site_settings` aux admins (ou service_role), et fixer le `search_path` de `is_admin()`.
Ne rien modifier pendant le lot A.

### Reste hors lot A (lots ultérieurs)
N+1 des vignettes (CategoryCard/BrandCard), code splitting + `docx` dynamique, comptages
exacts, **CLS élevé de la fiche produit (1,026 mobile)** et de la page quote.

---

## 20. Prochain lot recommandé : CLS de la fiche produit

**Ne rien modifier ici** — analyse seulement (aucun fichier touché pour ce CLS).

- **Preuve** : Lighthouse `before` — `product/mobile` **CLS = 1,026** (médiane 3 passes) ;
  `product/desktop` CLS 0,187 ; `quote/desktop` 0,187. L'accueil, lui, est bon (0,002).
  Le détail `layout-shift-elements` n'a pas été capturé (runs en `--only-categories=performance`).
- **Cause probable** : la fiche produit (`src/pages/ProductDetail.tsx`) affiche d'abord un
  **skeleton** (lignes ~133-140 : `aspect-square` + barres) puis remplace par le contenu réel
  chargé en asynchrone (produit + `product_pricing_tiers` + `product_images` + produits liés).
  Si la hauteur du skeleton ≠ hauteur finale (bloc prix, tableau de paliers, section « produits
  liés » avec images `loading="lazy"` sans dimensions ligne ~544), un **grand déplacement**
  survient à l'arrivée des données — d'où un CLS mobile très élevé. L'image principale (ligne
  ~189) est dans un conteneur `aspect-square` (espace réservé) → probablement **pas** la cause.
- **Fichiers probablement concernés** : `src/pages/ProductDetail.tsx` (skeleton, section prix,
  grille « produits liés »).
- **Investigations nécessaires** : relancer Lighthouse **toutes catégories** (ou avec
  diagnostics) pour capturer `layout-shift-elements` et les sélecteurs exacts ; comparer la
  hauteur du skeleton à celle du contenu final ; réserver l'espace (min-height / aspect-ratio)
  des blocs qui arrivent après la première peinture.
- **Présent dans la Deploy Preview ?** Le lot A ne touche pas cette page → le CLS produit
  **persiste** sur la preview (à confirmer par les mesures `after-preview`).
