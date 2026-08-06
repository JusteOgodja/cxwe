# DEPLOYMENT & ROLLBACK

Frontend = Vite/React sur **Netlify** (`morocco-foodexport.netlify.app`, build `vite build`,
publish `dist`). Base = **Supabase** (projet `fknxppuvpdmcfhtfrjcx`). Aucun CI ne déclenche de
commande base au déploiement.

## Déploiement normal
- Merge sur `main` → Netlify build & deploy automatiques.
- Chaque PR obtient une **Deploy Preview** (`deploy-preview-<n>--morocco-foodexport.netlify.app`).
- Vérifier la Preview (accueil, catalogue, formulaires, console, headers) **avant** merge.

## Rollback frontend Netlify (le plus rapide — sans Git)
1. Netlify → Site → **Deploys**.
2. Repérer le dernier deploy sain (avant l'incident).
3. **Publish deploy** (ou « Rollback to this deploy »).
→ Restauration immédiate, sans rebuild. Aucune incidence base.

## Rollback via Git (source de vérité)
```bash
git checkout main && git pull
git revert <commit_fautif>        # crée un commit inverse (préféré à reset sur main)
git push origin main              # Netlify redéploie automatiquement
```
- Ne PAS `push --force` sur `main`.
- Pour revenir sur plusieurs commits : `git revert <ancien>..<HEAD>`.

## Ce qu'un rollback frontend NE corrige PAS
- Les changements **base de données** (policies/grants/RPC) : ils vivent dans Supabase, pas dans
  le déploiement Netlify. Voir INCIDENT_RESPONSE pour un incident RLS.
- **Interdit tant que l'historique des migrations n'est pas réconcilié** :
  `supabase db push`, `migration repair`, `db reset --linked`, `migration up`
  (voir `supabase/migrations/README.md`). Les changements DB validés s'appliquent via `execute_sql`
  d'une migration archivée à préconditions, jamais via la CLI.

## Vérification post-rollback
- Accueil + catalogue se chargent, 4 requêtes Supabase de l'accueil OK, aucune erreur console.
- `is_admin()` : anon bloqué / ordinaire false / admin true (non régressé).
