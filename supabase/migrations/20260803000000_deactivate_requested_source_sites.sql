-- Désactive les produits issus de sources explicitement exclues de la plateforme.
-- L'app publique filtre déjà products.is_active = true, donc ces lignes ne seront
-- plus affichées dans le catalogue, les fiches produit, devis, etc.

WITH inactive_sources(site) AS (
  VALUES
    ('livkech.com'),
    ('yammy.ma'),
    ('goffa.ma'),
    ('aiguebelle.com'),
    ('naturabeldi.ma'),
    ('animalmarket.ma'),
    ('cartiersaada.com'),
    ('jibal.ma'),
    ('lepanier.ma'),
    ('sweetnorthfood.com'),
    ('petzy.ma'),
    ('fatlaanimalerie.ma'),
    ('petiz.ma'),
    ('babyandmom.ma'),
    ('greenmarketmaroc.com'),
    ('allobebe.ma'),
    ('bebemaman.ma'),
    ('bringo.ro'),
    ('aswakassalam.com')
),
matched_products AS (
  SELECT p.id
  FROM public.products p
  JOIN inactive_sources s
    ON lower(regexp_replace(coalesce(substring(p.source_url from 'https?://([^/]+)'), ''), '^www\.', '')) = s.site
    OR lower(regexp_replace(coalesce(p.source_site, ''), '^www\.', '')) = s.site
)
UPDATE public.products p
SET
  is_active = false,
  statut = 'inactif'
FROM matched_products m
WHERE p.id = m.id;

-- Expose l'état des sources dans le back-office. La signature change, donc il
-- faut retirer l'ancienne fonction avant de la recréer.
DROP FUNCTION IF EXISTS public.list_source_sites();

CREATE OR REPLACE FUNCTION public.list_source_sites()
RETURNS TABLE(
  site text,
  nb_produits bigint,
  nb_actifs bigint,
  nb_inactifs bigint,
  is_active boolean
)
LANGUAGE sql
STABLE
AS $function$
  WITH source_products AS (
    SELECT
      regexp_replace(substring(source_url from 'https?://([^/]+)'), '^www\.', '') AS site,
      is_active
    FROM public.products
    WHERE source_url IS NOT NULL AND source_url <> ''
  )
  SELECT
    site,
    COUNT(*) AS nb_produits,
    COUNT(*) FILTER (WHERE is_active) AS nb_actifs,
    COUNT(*) FILTER (WHERE NOT is_active) AS nb_inactifs,
    COUNT(*) FILTER (WHERE is_active) > 0 AS is_active
  FROM source_products
  WHERE site IS NOT NULL
  GROUP BY site
  ORDER BY is_active DESC, nb_produits DESC, site;
$function$;

GRANT EXECUTE ON FUNCTION public.list_source_sites() TO anon, authenticated;
