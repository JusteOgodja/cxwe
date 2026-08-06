# INCIDENT RESPONSE

Principes : **contenir d'abord, corriger ensuite, prouver enfin**. Ne jamais appliquer un correctif
base non testé directement en production ; répéter sur pile locale/staging. Ne jamais logguer de
JWT, email, donnée de formulaire ou réponse Supabase sensible.

## Contacts / responsabilités
- Frontend/déploiement : mainteneur du dépôt (Netlify).
- Base/RLS : mainteneur Supabase (accès dashboard + `execute_sql`).
- Renseigner ici les personnes réelles : _(à compléter)_.

## 1. Incident RLS (fuite de données / écriture non autorisée)
1. **Contenir** : identifier la table/policy. Si une policy trop permissive est en cause, préparer
   une policy restrictive **par commande** (`TO authenticated ... is_admin()`), la tester en local
   (fixtures `security-audit/*/tests/local_stack`), puis l'appliquer via `execute_sql` dans une
   transaction à préconditions (rollback si l'état diffère). **Ne pas** utiliser la CLI Supabase.
2. **Prouver** : re-simuler le rôle (`set local role authenticated` + `request.jwt.claims`) en
   lecture seule pour confirmer la fermeture.
3. Documenter dans `security-audit/` (journal + avant/après).

## 2. Migration SQL manuelle échouée
- Les migrations sont **transactionnelles à préconditions** : un échec ⇒ `ROLLBACK` intégral,
  aucun état partiel. Vérifier via `pg_policies`/`has_*_privilege` que l'état est resté celui d'avant.
- Ne PAS rejouer à l'aveugle : relire la précondition qui a levé l'exception (état réel ≠ état
  audité), réaligner le script, retester en local, puis réappliquer.

## 3. Compromission d'une clé
- **anon key / URL** : publiques par conception (dans le bundle) — pas un secret. Une rotation
  reste possible côté Supabase (Settings → API) puis mise à jour de `VITE_SUPABASE_ANON_KEY` sur
  Netlify + rebuild.
- **service_role key / secret** : ne doit **jamais** être dans le frontend, Git ou la CI. En cas de
  fuite : la **révoquer/rotationner** dans Supabase Dashboard immédiatement (action manuelle),
  auditer `auth`/logs, invalider les sessions si nécessaire. Ne jamais committer la nouvelle.
- Vérifier qu'aucun secret n'est versionné : `git grep -nE 'sb_secret_|service_role'` (la CI le fait).

## 4. Panne Supabase
- Vérifier le statut Supabase (dashboard / status page). Le frontend dégrade : lectures publiques
  échouent → afficher l'état, ne pas boucler sur les retries.
- Aucune action destructive. Attendre le rétablissement ; si prolongé, communiquer.

## 5. Incident frontend (build cassé / régression visible)
- **Rollback Netlify** immédiat (voir DEPLOYMENT_ROLLBACK) puis corriger via Git + PR + Preview.

## Après tout incident
- Post-mortem court : cause, détection, confinement, correctif, prévention (test/CI ajouté).
- Ajouter un test de régression (E2E public ou régression sécurité locale) reproduisant l'incident.
