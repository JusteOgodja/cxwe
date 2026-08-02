-- =============================================================================
-- Phase A — Nouvelle autorité administrateur PRIVÉE, fondée sur l'UUID Supabase
-- (auth.users.id), et non plus sur une liste d'emails stockée dans une table
-- publique modifiable (site_settings.admin_emails).
--
-- ADDITIVE ET NON DESTRUCTIVE : l'ancienne autorité (public.is_admin() par email)
-- reste fonctionnelle. Aucune policy n'est basculée ici. Le déploiement peut
-- s'arrêter après cette migration + le bootstrap sans rien casser (voir
-- security-audit/ADMIN_AUTHORITY_DEPLOYMENT.md).
-- =============================================================================

-- 1) Schéma privé. NE PAS l'ajouter aux "Exposed schemas" de PostgREST
--    (Supabase n'expose que public/graphql_public par défaut -> app_private
--    reste inaccessible via l'API REST).
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon, authenticated;

-- 2) Table racine d'autorité : uniquement des UUID, jamais d'email.
--    Aucune policy => aucun accès direct via l'API pour anon/authenticated.
CREATE TABLE IF NOT EXISTS app_private.administrators (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.administrators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.administrators FROM PUBLIC, anon, authenticated;

-- 3) Fonction d'autorité. SECURITY DEFINER + search_path vide + objets qualifiés.
--    Compare auth.uid() à la table privée. Ne lit NI l'email du JWT NI site_settings.
--    N'accepte aucun paramètre (impossible de tester l'autorité d'un autre user).
CREATE OR REPLACE FUNCTION app_private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app_private.administrators a
    WHERE a.user_id = (SELECT auth.uid())
  );
$$;
-- auth.uid() NULL (anonyme / JWT invalide) => EXISTS faux => renvoie false.
-- Schéma scellé : anon/authenticated n'appellent JAMAIS cette fonction directement
-- (ils passent par les wrappers public.* SECURITY DEFINER ci-dessous, qui
-- s'exécutent en tant que propriétaire et franchissent le schéma privé).
REVOKE ALL ON FUNCTION app_private.is_admin() FROM PUBLIC, anon, authenticated;

-- 4) RPC booléenne minimale pour l'INTERFACE (indication d'affichage uniquement,
--    jamais une protection). Ne renvoie qu'un booléen : aucun email, aucun UUID,
--    aucune liste d'administrateurs.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_admin();
$$;
REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO anon, authenticated;

COMMENT ON TABLE app_private.administrators IS
  'Racine d''autorité admin (UUID). Jamais exposée via l''API. Écriture réservée au service_role / SQL privilégié.';
COMMENT ON FUNCTION app_private.is_admin() IS
  'Autorité admin : true si auth.uid() figure dans app_private.administrators. Ne dépend ni de l''email ni de site_settings.';
