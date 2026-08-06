# BACKUP & RESTORE

> ⚠️ **Aucune sauvegarde n'est affirmée « fonctionnelle » ici sans preuve.** Ce document décrit
> l'état **connu** et les **actions manuelles** requises pour l'établir. Les champs marqués
> _(à confirmer)_ n'ont pas pu être vérifiés depuis ce dépôt (nécessitent l'accès dashboard).

## Périmètres à sauvegarder
| Élément | Emplacement | Statut sauvegarde | Restauration testée |
|---|---|---|---|
| **Code frontend** | Git (GitHub `JusteOgodja/cxwe`) | ✅ versionné + historique | ✅ via `git revert` / Netlify redeploy |
| **Base Postgres (Supabase)** | projet `fknxppuvpdmcfhtfrjcx` | _(à confirmer : PITR/backups selon le plan Supabase)_ | ❌ non testée |
| **Schéma / policies / RPC** | `security-audit/**` (SQL archivé appliqué) + migrations locales | ✅ SQL archivé dans Git (rejouable en staging) | partiellement (rejoué en local) |
| **Storage (buckets)** | Supabase Storage | **aucun bucket** (audit RLS) → rien à sauvegarder actuellement | n/a |
| **Variables Netlify** | Netlify UI (`VITE_*` publiques) | _(à confirmer : non versionnées ; noter les valeurs hors Git)_ | n/a |
| **Variables Supabase** | Supabase dashboard | _(à confirmer)_ | n/a |

## Sauvegarde base Supabase (à établir — action manuelle)
1. Dashboard Supabase → **Database → Backups** : relever la **fréquence** et la **rétention**
   réelles offertes par le plan (souvent quotidien + PITR sur les plans payants). _(à confirmer)_
2. Si PITR indisponible sur le plan : planifier un `pg_dump` logique régulier vers un stockage
   privé (action manuelle, hors Git ; ne jamais committer le dump ni les identifiants).
3. **Tester une restauration** dans un projet/staging séparé (jamais en production) et consigner la
   date du dernier test réussi ici : _dernier test = néant (à réaliser)_.

## Sauvegarde du schéma (déjà en place, versionnée)
- Tout changement DB appliqué est **archivé en SQL** sous `security-audit/**` avec journal
  d'application et préconditions → le schéma de sécurité est **reconstructible** sur une base neuve
  (démontré : reconstructions locales via `tests/local_stack`).
- Les migrations « actives » (`supabase/migrations`) sont **divergentes** de l'historique distant :
  ne pas s'en servir pour restaurer tant que la réconciliation n'est pas faite.

## Restauration — chemins
- **Frontend** : `git revert` + push, ou rollback Netlify (voir DEPLOYMENT_ROLLBACK).
- **Schéma sécurité** : rejouer les SQL archivés `security-audit/**` **sur un staging** puis, après
  validation, via `execute_sql` en production (transaction à préconditions). Jamais la CLI.
- **Données** : dépend du backup Supabase _(à confirmer)_ → restaurer dans un staging d'abord.

## Actions manuelles requises (résumé)
1. Confirmer fréquence/rétention/PITR des backups Supabase (dashboard).
2. Réaliser **un** test de restauration dans un staging et dater le résultat ici.
3. Consigner (hors Git) les variables Netlify/Supabase de production.
