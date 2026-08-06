-- =============================================================================
-- PROPOSÉ — NON APPLIQUÉ. Désactivation RÉVERSIBLE des produits bébé/puériculture
-- hors périmètre (HIGH confidence). Aucune suppression physique. Images/tarifs/lots
-- conservés. Transaction à précondition sur le nombre de lignes (rollback si écart).
--
-- À exécuter via execute_sql (jamais db push/CLI). AVANT exécution : exporter localement
-- les lignes affectées (voir CLEANUP_PLAN.md, étape « export avant modification »).
--
-- Règle HIGH = marque de puériculture pure OU accessoire/aliment bébé explicite dans le
-- nom, en excluant le bonbon « baby pop ». Identique au validateur src/lib/productScope.ts.
-- Audit du <à dater> : 131 produits HIGH (114 actifs). expected_active ci-dessous = 114.
-- =============================================================================
BEGIN;

-- Sélection cible (actifs uniquement — la désactivation ne concerne que is_active=true).
CREATE TEMP TABLE _oos_target ON COMMIT DROP AS
SELECT p.id
FROM public.products p
LEFT JOIN public.brands b ON b.id = p.marque_id
WHERE p.is_active = true
  AND lower(coalesce(p.name,'')||' '||coalesce(p.description,'')||' '||coalesce(p.description_marketing,'')) !~ '(big )?baby ?pop'
  AND (
        lower(coalesce(b.name,'')) ~ '\y(nuk|mam ?baby|n[uû]by|suavinex|farlin|miniland|babybio|organix|dodie|avent|chicco|tommee|b[ée]b[ée] ?confort|bambino|b[ée]b[ée]dor|notre ?b[ée]b[ée])\y'
     OR lower(coalesce(p.name,'')) ~ '(couche[- ]?culotte|couches? b[ée]b[ée]|\ydiapers?\y|lingettes? b[ée]b[ée]|lait infantile|lait de croissance|lait 1er ?[aâ]ge|infant formula|c[ée]r[ée]ales? infantiles?|petit pot|biberon|feeding bottle|t[ée]tine|pacifier|st[ée]rilisateur|poussette|si[èe]ge[- ]?auto|pu[ée]riculture|grignoteur|nibber|tasse d.?apprentissage|d[èe]s [0-9] ?mois|[0-9]m\+|sucette.{0,30}(0-6|6-18|6-36|[0-9] ?mois|[0-9]\s?er ?[aâ]ge|anatomique|orthodon|physio))'
      );

-- Précondition : nombre attendu (revérifier/mettre à jour après un nouvel audit).
DO $chk$
DECLARE n int; expected_active int := 114;
BEGIN
  SELECT count(*) INTO n FROM _oos_target;
  IF n <> expected_active THEN
    RAISE EXCEPTION 'Aborted: % active target rows, expected % (données modifiées depuis l''audit — re-auditer avant d''appliquer).', n, expected_active;
  END IF;
END $chk$;

-- Désactivation (réversible).
UPDATE public.products SET is_active = false
WHERE id IN (SELECT id FROM _oos_target);

-- Contrôle post-update : plus aucune cible active.
DO $post$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining FROM public.products p WHERE p.is_active AND p.id IN (SELECT id FROM _oos_target);
  IF remaining <> 0 THEN RAISE EXCEPTION 'Aborted: % rows still active after update', remaining; END IF;
END $post$;

-- Rafraîchir les compteurs (matviews) — sinon les cartes catégorie restent périmées.
REFRESH MATERIALIZED VIEW CONCURRENTLY public.category_product_counts;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_product_counts;

COMMIT;

-- ── ROLLBACK MANUEL (réversibilité) ─────────────────────────────────────────
-- Réactiver précisément ces lignes se fait à partir de l'export CSV pris avant
-- modification (liste d'ids) :
--   UPDATE public.products SET is_active = true WHERE id IN (<ids exportés>);
-- (Ne pas réactiver « à l'aveugle » par la règle : certains ids étaient déjà inactifs
--  avant l'opération.)
