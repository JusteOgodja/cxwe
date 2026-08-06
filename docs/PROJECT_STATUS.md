# État du projet — sécurité & base de données

_Résumé sobre de l'état courant. Mis à jour à la mise en pause du chantier de réconciliation._

## Sécurité (appliqué en production)
- **Hotfix de sécurité appliqué** : l'escalade de privilèges via `site_settings` est fermée
  (policy permissive `site_settings_authenticated_all` supprimée ; `public.is_admin()` durcie —
  `SECURITY DEFINER`, `search_path=''`, comparaison d'email exacte).
- **Gel de `admin_emails` appliqué** : la ligne historique `admin_emails` n'est plus modifiable par
  aucun rôle client (y compris admin) — INSERT/UPDATE gardés par `key <> 'admin_emails'`, aucun
  DELETE client. La ligne reste lisible pour le fonctionnement transitoire de `is_admin()`.
- **Frontend** : plus aucune gestion de `admin_emails` ; autorité admin déterminée côté serveur
  (`is_admin()`). Validé en production.

## Audit RLS global (TERMINÉ — appliqué en production)
- **Terminé.** Audit lecture seule de toutes les tables/fonctions/RPC, corrections classées et
  appliquées en production, vérifiées par tests **vrais JWT** sur pile Supabase locale.
- **brands** (PR #10) : lecture publique rétablie, écriture admin-only. Appliqué.
- **Durcissement RLS global** (PR #11, `security-audit/global-rls/`) : `quote_requests`,
  `collaboration_requests`, `suppliers`, `product_pricing_tiers`, `product_images`, `product_lots`,
  `media` — fin de l'écriture par utilisateur ordinaire ; demandes en admin-only ; lecture publique
  du catalogue conservée ; `suppliers` anon-401 corrigé. Appliqué + vérifié.
- **Lot MEDIUM/LOW + 1 HIGH** (PR #12, `security-audit/remaining-rls/`) : `buyer_profiles`
  (accès propriétaire strict, admin `TO authenticated`, doublons supprimés) ; `EXECUTE` des RPC
  admin/recherche retiré à anon + `search_path` fixe ; `refresh_product_counts` (trigger) EXECUTE
  révoqué ; grants anon réduits à une whitelist (SELECT public + INSERT formulaires) ; policies
  admin `categories`/`products` `TO authenticated`. Appliqué + vérifié.
- **Reporté** (nécessite changement de modèle/donnée, hors périmètre) : espace acheteur
  « mes demandes » (ownership sur `quote_requests`/`collaboration_requests`).

## Actions manuelles restantes
1. **Supprimer manuellement le compte de test jetable** créé pendant la validation du fix brands,
   via **Supabase Dashboard → Authentication → Users** (voir
   `security-audit/global-rls/PRODUCTION_TEST_ACCOUNT_CLEANUP.md`). Ne pas supprimer via
   `service_role` ni script.
2. **Ne lancer aucun `supabase db push` / `migration repair` / `db reset` (ni `migration up`)**
   lié à la base tant que la **réconciliation de l'historique des migrations** n'est pas réalisée
   (voir avertissement `supabase/migrations/README.md`).

## Historique des migrations
- **Scripts manuels archivés** hors du dossier de migrations actives, sous
  `security-audit/applied-manual-sql/` (hotfix + gel), avec empreintes et manifeste
  (`security-audit/APPLIED_MANUAL_DATABASE_CHANGES.md`). **Ne jamais les rejouer.**
- **Historique Supabase divergent** : `supabase_migrations.schema_migrations` (6 versions) ne
  correspond pas aux 15 fichiers locaux (0 EXACT_MATCH, 5 semantic-match à timestamp différent,
  8 UNKNOWN, 1 version distante orpheline). Voir `migration-reconciliation/`.
- **Commandes Supabase INTERDITES jusqu'à réconciliation** (voir `supabase/migrations/README.md`) :
  `supabase db push`, `supabase migration up`, `supabase migration repair`, `supabase db reset --linked`.

## Répétition de baseline (validée localement, pas en production)
- **Baseline candidate reconstruite sur la vraie pile Supabase locale** (CLI temporaire via `npx`,
  Docker, projet **non lié**, données **synthétiques**). Baseline conservée **hors**
  `supabase/migrations` (`migration-reconciliation/baseline-rehearsal/candidate/`).
- **`db reset --local` réussi deux fois** ; `migration list` local cohérent, aucun rejeu accidentel.
- **Auth réelle (JWT GoTrue) et PostgREST testés** : `is_admin()` = true/false correct ; anon et
  utilisateur ordinaire bloqués ; admin gère le catalogue ; `admin_emails` gelé (update 0 / insert
  403).
- **Ancienne escalade bloquée** (rejouée : impossible).

## Limites connues (baseline pas encore prête)
- **Trois RPC manquantes** dans la baseline (bloquant) : `search_products`, `list_source_sites`,
  `get_quality_stats`. À intégrer depuis les sources autorisées avant staging.
- **Parité complète colonnes/index encore non prouvée** — nécessite `supabase db pull` en staging.

## Statut
**Chantier de réconciliation en pause** jusqu'au **staging** ou **avant la prochaine migration DB**.
Aucune action distante sur la base tant que la réconciliation contrôlée n'est pas réalisée.
