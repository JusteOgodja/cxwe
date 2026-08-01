-- Liste des sites web sources (domaines distincts extraits de source_url)
-- avec le nombre de produits rattachés. Alimente l'onglet "Sources" du back-office.

CREATE OR REPLACE FUNCTION public.list_source_sites()
RETURNS TABLE(site text, nb_produits bigint)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    regexp_replace(substring(source_url from 'https?://([^/]+)'), '^www\.', '') AS site,
    COUNT(*) AS nb_produits
  FROM products
  WHERE source_url IS NOT NULL AND source_url <> ''
  GROUP BY 1
  HAVING regexp_replace(substring(source_url from 'https?://([^/]+)'), '^www\.', '') IS NOT NULL
  ORDER BY nb_produits DESC, site;
$function$;

GRANT EXECUTE ON FUNCTION public.list_source_sites() TO anon, authenticated;
