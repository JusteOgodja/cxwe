-- Ajoute les champs de prix (prix_marche_mad surtout) au retour de
-- search_products() : le back-office affiche désormais une colonne "Prix marché"
-- qui restait vide car la fonction ne renvoyait pas prix_marche_mad.

DROP FUNCTION IF EXISTS public.search_products(text, uuid, uuid, boolean, integer, integer);

CREATE FUNCTION public.search_products(
  p_query text DEFAULT ''::text,
  p_category uuid DEFAULT NULL::uuid,
  p_brand uuid DEFAULT NULL::uuid,
  p_active boolean DEFAULT true,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, name text, description text, image_url text,
  category_id uuid, marque_id uuid, statut text, is_active boolean,
  ean text, hs_code text, sort_order integer, created_at timestamptz,
  prix_marche_mad numeric, prix_depart_usine numeric, prix_indicatif numeric,
  source_url text, source_platform text,
  prix_ancien numeric, remise_pct numeric, poids numeric, poids_unite text, devise text,
  temperature text, duree_conservation integer, colisage integer, commande_min integer,
  allergenes text[], certifications text[], incoterms_dispo text[], regimes text[],
  ingredients_texte text, note_moyenne numeric, nb_avis integer,
  is_new boolean, is_promo boolean, est_sponsored boolean,
  total_count bigint
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    p.id, p.name, p.description, p.image_url,
    p.category_id, p.marque_id, p.statut, p.is_active,
    p.ean, p.hs_code, p.sort_order, p.created_at,
    p.prix_marche_mad, p.prix_depart_usine, p.prix_indicatif,
    p.source_url, p.source_platform,
    p.prix_ancien, p.remise_pct, p.poids, p.poids_unite, p.devise,
    p.temperature, p.duree_conservation, p.colisage, p.commande_min,
    p.allergenes, p.certifications, p.incoterms_dispo, p.regimes,
    p.ingredients_texte, p.note_moyenne, p.nb_avis,
    p.is_new, p.is_promo, p.est_sponsored,
    COUNT(*) OVER () AS total_count
  FROM products p
  WHERE
    (p_active IS NULL OR p.is_active = p_active)
    AND (p_category IS NULL OR p.category_id = p_category)
    AND (p_brand    IS NULL OR p.marque_id   = p_brand)
    AND (
      p_query = ''
      OR to_tsvector('french', p.name || ' ' || coalesce(p.description,'') || ' ' || coalesce(p.ean,''))
         @@ plainto_tsquery('french', p_query)
      OR p.name ILIKE '%' || p_query || '%'
    )
  ORDER BY
    CASE WHEN p_query != '' THEN
      ts_rank(to_tsvector('french', p.name || ' ' || coalesce(p.description,'')), plainto_tsquery('french', p_query))
    ELSE 0 END DESC,
    p.sort_order, p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$;

GRANT EXECUTE ON FUNCTION public.search_products(text, uuid, uuid, boolean, integer, integer) TO anon, authenticated;
