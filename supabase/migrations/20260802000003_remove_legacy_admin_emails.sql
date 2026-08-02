-- =============================================================================
-- Phase B (2/2) — Retire la donnée d'autorité héritée. À appliquer APRÈS la
-- bascule des policies (20260802000002) et la confirmation qu'un admin valide
-- existe dans app_private.administrators.
--
-- Après cette migration, l'autorité admin ne dépend plus d'aucune donnée
-- présente dans public.site_settings.
-- =============================================================================

DELETE FROM public.site_settings WHERE key = 'admin_emails';
