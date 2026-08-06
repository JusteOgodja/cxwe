-- RESTAURATION — réactive UNIQUEMENT les 114 produits désactivés, sans supprimer ni
-- recréer aucune dépendance (images / tarifs / lots restent intacts, jamais touchés).
--
-- Source de vérité = l'export local des IDs actifs pris AVANT modification
-- (.local-audit/product-cleanup/deactivated_active_ids.csv), pour ne réactiver QUE ce
-- qui a réellement été désactivé par l'opération (et rien qui était déjà inactif avant).
BEGIN;

CREATE TEMP TABLE _restore_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
\copy _restore_ids(id) FROM '.local-audit/product-cleanup/deactivated_active_ids.csv' WITH CSV HEADER;

DO $r$
DECLARE n_src int; cnt int;
BEGIN
  SELECT count(*) INTO n_src FROM _restore_ids;
  IF n_src <> 114 THEN RAISE EXCEPTION 'Aborted: restore set = %, expected 114', n_src; END IF;

  -- Réactive uniquement celles actuellement inactives (idempotent : une 2e exécution ne fait rien).
  UPDATE public.products p SET is_active = true
  FROM _restore_ids r
  WHERE p.id = r.id AND p.is_active = false;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'reactivated=%', cnt;   -- 114 au premier passage, 0 ensuite
END $r$;

REFRESH MATERIALIZED VIEW CONCURRENTLY public.category_product_counts;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_product_counts;

COMMIT;
-- Aucune ligne product_images / product_pricing_tiers / product_lots n'est modifiée.
