# PRODUCTION READINESS — round 5 (baseline & audits)

## Phase 1 — baseline technique
| Élément | État |
|---|---|
| typecheck (`tsc`) | ✅ passe |
| build (`vite build`) | ✅ passe (bundle principal ~510 KB → cf. « next lot » perf) |
| lint | 21 erreurs → **20** (scoping `.remember`/scripts/supabase, aucune règle désactivée) + 11 warnings |
| tests existants | **aucun** avant ce lot → Playwright ajouté |
| couverture | n/a (aucun test avant) |
| dépendances vulnérables | 21 → **8** après `npm audit fix` (0 critique ; 2 hautes = dev/build, majeures reportées) |
| fichiers sensibles versionnés | **aucun** (`.env` ignoré ; seul `.env.example`) |
| monitoring | **aucun** avant ce lot → stub inerte ajouté |
| sauvegardes | non prouvées (voir BACKUP_AND_RESTORE) |

### Dette lint inventoriée (20 erreurs, à traiter par petits lots ciblés)
- **17× `@typescript-eslint/no-explicit-any`** — dans `src/pages/admin/*` (Analytics, Brands,
  Categories, Dashboard, DataQuality, Products, Quotes, Suppliers), `AuthContext`, `useSEO`,
  `BrandPage`, `Home`, `QuoteRequest`. Correction = typer précisément → **non purement mécanique**
  (risque métier) → reporté.
- **3× `@typescript-eslint/no-unused-expressions`** — motifs `cond && expr()` volontaires ; conversion
  en `if` possible mais fichier par fichier → reporté (faible valeur).
- **11 warnings** `react-hooks/exhaustive-deps` (10) + `react-refresh/only-export-components` (1) —
  auto-fix **risqué** (boucles/regressions) → reporté.
- ✅ Corrigé ici : fichier temporaire `.remember/tmp/last-ndc.ts` sorti du périmètre lint (−1 erreur).

## Phase 5 — dépendances
- `npm audit fix` (sans `--force`) : **21 → 8** (2 low, 4 moderate, 2 high, 0 critical). Build/typecheck OK.
- Restant = **dev/build uniquement** (esbuild/vite/babel/brace-expansion) nécessitant des **majeures**
  (vite 5→8, eslint 9→10, typescript-eslint) → **reportées** (pas de mise à jour majeure automatique).
- `npm outdated` majeures notables (reportées) : React 18→19, react-router 6→7, tailwind 3→4,
  vite 5→8, typescript 5→7, lucide-react 0.344→1, @supabase/supabase-js 2.57→2.112 (minor, candidat
  à un patch bump ultérieur). Aucune mise à jour majeure appliquée ici.
- Packages inutilisés : non prouvé de manière fiable dans ce lot → à traiter avec un outil dédié
  (depcheck) dans un lot séparé.

## Phase 6 — monitoring (préparé, inactif)
- `src/lib/monitoring.ts` : capture erreurs JS, rejets de promesses (dont erreurs Supabase remontées),
  **erreurs de chargement de chunk lazy**, Web Vitals (LCP), et `reportFormRejection()` pour les
  rejets de formulaire. **Redaction** systématique (JWT/email/clés) ; ne journalise aucune donnée de
  formulaire ni réponse Supabase.
- **Désactivé par défaut** : no-op tant que `VITE_MONITORING_DSN` n'est pas défini. Aucun compte créé,
  aucun secret committé. **Activation = action manuelle** (définir `VITE_MONITORING_DSN` + option
  `VITE_COMMIT_SHA` côté Netlify, pointant vers un collecteur choisi).

## Phase 8 — staging (audit — actions manuelles requises)
Aucun staging séparé n'existe. Pour en disposer (aucun service payant créé sans validation) :
1. **Projet Supabase staging** distinct (nouveau ref) — peut engendrer un **coût** selon le plan.
2. **Site Netlify staging** (ou branche deploy dédiée) avec **variables distinctes**
   (`VITE_SUPABASE_URL`/`ANON_KEY` du staging).
3. **Sous-domaine** dédié (ex. `staging.…`) — optionnel.
4. **Utilisateurs & données synthétiques** uniquement (jamais de données réelles).
5. **Synchronisation du schéma sans données** : rejouer les SQL archivés `security-audit/**` +
   fixtures `tests/local_stack` sur le staging (jamais `db push`/`reset` tant que l'historique n'est
   pas réconcilié).
→ **Toutes ces étapes sont manuelles** (création de projet/compte, variables) et **non réalisées** ici.

## Phase 9 — test de charge raisonnable (local, non-production)
- Cible : **`vite preview` local** (jamais la production/Supabase prod).
- Résultat statique (accueil) : 200 requêtes, concurrence 20 → **0 erreur**, p50 **196 ms**,
  p95 **497 ms**, ~80 rps. (Serveur de dev local mono-thread — **pas** représentatif du CDN Netlify ;
  sert d'indicateur de stabilité sans erreur sous charge modérée.)
- **Charge côté données (Supabase)** : non testée — nécessite un **staging** (Phase 8) pour ne pas
  viser la production. Reporté.

## Phase 7 — sauvegardes : voir `BACKUP_AND_RESTORE.md` (statut non prouvé, actions manuelles listées).
