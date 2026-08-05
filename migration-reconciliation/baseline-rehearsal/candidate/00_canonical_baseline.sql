-- =============================================================================
-- BASELINE CANONIQUE CANDIDATE (RÉPÉTITION) — état final consolidé.
-- Dérivée : (a) des 15 migrations locales pour la STRUCTURE applicative, et
-- (b) de l'état de sécurité FINAL vérifié en production (hotfix + gel + is_admin
-- durci). Elle N'inclut PAS les états intermédiaires vulnérables.
--
-- NON destinée à supabase/migrations. Aucune donnée métier, aucune adresse admin.
-- Parité colonne-par-colonne vs production à confirmer par `supabase db pull` en
-- staging (voir SCHEMA_PARITY_REPORT / STAGING_RESULTS).
--
-- Le contexte Supabase (rôles, schéma auth, auth.uid()/jwt()/role()) est fourni
-- séparément par le harness local (répétition) ou par la CLI Supabase (staging).
-- =============================================================================

-- ---------- CATÉGORIES ----------
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ---------- PRODUITS (colonnes consolidées #1+#2+#6+#10+#11) ----------
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  details text[] DEFAULT '{}',
  image_url text DEFAULT '',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  marque_id uuid,
  fournisseur_id uuid,
  ean text UNIQUE,
  hs_code text,
  sous_categories_ids uuid[],
  temperature text DEFAULT 'Ambiante' CHECK (temperature IN ('Ambiante','Réfrigéré','Frais','Surgelé')),
  photos_unite uuid[],
  photos_carton uuid[],
  videos uuid[],
  commande_min integer DEFAULT 1,
  colisage integer DEFAULT 1,
  palettisation jsonb,
  dimensions_unite jsonb,
  dimensions_carton jsonb,
  dimensions_palette jsonb,
  devise text DEFAULT 'EUR',
  incoterms_dispo text[],
  ingredients_texte text,
  ingredients_photo_id uuid,
  nutrition_texte text,
  nutrition_photo_id uuid,
  allergenes text[],
  regimes text[],
  duree_conservation integer DEFAULT 365,
  pays_origine text DEFAULT 'Morocco',
  pays_export_autorises text[],
  certifications text[],
  note_moyenne numeric(3,2) DEFAULT 0 CHECK (note_moyenne >= 0 AND note_moyenne <= 5),
  nb_avis integer DEFAULT 0,
  is_new boolean DEFAULT false,
  is_promo boolean DEFAULT false,
  est_sponsored boolean DEFAULT false,
  statut text DEFAULT 'actif' CHECK (statut IN ('actif','inactif','brouillon','archivé')),
  dluo integer,
  prix_indicatif numeric(12,4),
  nutriscore text CHECK (nutriscore IN ('A','B','C','D','E')),
  fiche_technique_url text,
  source_site text,
  source_url text,
  source_phase text,
  prix_marche_mad numeric(10,2),
  disponibilite text,
  poids_brut_kg numeric(10,3),
  tva_pct numeric(5,2),
  description_marketing text,
  fmcg_segment text,
  conditionnement text,
  contenance text,
  image_urls_extra text[],
  prix_depart_usine numeric(10,2),
  delai_fabrication text,
  emballage_export text,
  prix_marche_source text
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_ean_idx ON products(ean);
CREATE INDEX IF NOT EXISTS products_statut_idx ON products(statut);
CREATE INDEX IF NOT EXISTS products_hs_code_idx ON products(hs_code);
CREATE INDEX IF NOT EXISTS products_source_site_idx ON products(source_site);

-- ---------- MARQUES / FOURNISSEURS / MÉDIAS (colonnes représentatives) ----------
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text,
  logo_url text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  is_verified boolean DEFAULT false,
  annee_creation integer,
  marches_export text[],
  capacite_production text,
  politique_qc text,
  effectif text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text,
  type text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS product_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  min_qty integer,
  price numeric(12,4),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE product_pricing_tiers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS product_pricing_tiers_product_id_idx ON product_pricing_tiers(product_id);

CREATE TABLE IF NOT EXISTS product_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  lot_code text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE product_lots ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS product_lots_product_id_idx ON product_lots(product_id);

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  url text,
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS product_images_product_id_idx ON product_images(product_id);

-- ---------- DEVIS / COLLABORATION ----------
CREATE TABLE IF NOT EXISTS quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  country text NOT NULL,
  products_interested text NOT NULL,
  quantity_notes text DEFAULT '',
  message text DEFAULT '',
  status text DEFAULT 'new' CHECK (status IN ('new','in_review','responded','closed')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS collaboration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  contact_name text,
  email text,
  message text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE collaboration_requests ENABLE ROW LEVEL SECURITY;

-- ---------- PROFILS ACHETEURS ----------
CREATE TABLE IF NOT EXISTS buyer_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name text NOT NULL,
  company_name text NOT NULL,
  country text NOT NULL,
  phone text,
  sector text,
  role text,
  message text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE buyer_profiles ENABLE ROW LEVEL SECURITY;

-- ---------- PARAMÈTRES DU SITE ----------
CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- AUTORITÉ ADMIN — FONCTION DURCIE (état FINAL, pas la version ILIKE d'origine)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND (auth.jwt() ->> 'email') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.site_settings AS s
      CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(COALESCE(s.value, ''), ',') AS configured_email
      WHERE s.key = 'admin_emails'
        AND pg_catalog.lower(pg_catalog.btrim(configured_email))
            = pg_catalog.lower(pg_catalog.btrim(auth.jwt() ->> 'email'))
    );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- =============================================================================
-- POLICIES — état FINAL
-- =============================================================================
-- Catégories : lecture publique (actives) + admin en écriture
CREATE POLICY "Anyone can view active categories" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can view all categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_admin_insert" ON categories FOR INSERT WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "categories_admin_update" ON categories FOR UPDATE USING ((SELECT public.is_admin()));
CREATE POLICY "categories_admin_delete" ON categories FOR DELETE USING ((SELECT public.is_admin()));

-- Produits : lecture publique (actifs) + admin en écriture
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can view all products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_admin_insert" ON products FOR INSERT WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "products_admin_update" ON products FOR UPDATE USING ((SELECT public.is_admin()));
CREATE POLICY "products_admin_delete" ON products FOR DELETE USING ((SELECT public.is_admin()));

-- Marques / Fournisseurs : lecture publique (actifs) + admin ALL
CREATE POLICY "Anyone can view active brands" ON brands FOR SELECT USING (is_active = true);
CREATE POLICY "brands_admin_write" ON brands FOR ALL USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Anyone can view active suppliers" ON suppliers FOR SELECT USING (is_active = true);
CREATE POLICY "suppliers_admin_write" ON suppliers FOR ALL USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- Devis : soumission publique + gestion authentifiée
CREATE POLICY "Anyone can submit quote requests" ON quote_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can view quote requests" ON quote_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update quote requests" ON quote_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Collaboration : soumission publique + gestion authentifiée
CREATE POLICY "Anyone can submit collaboration requests" ON collaboration_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can manage collaboration requests" ON collaboration_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Profils acheteurs : propres lignes + lecture admin
CREATE POLICY "buyer_profiles_insert_own" ON buyer_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "buyer_profiles_select_own" ON buyer_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "buyer_profiles_admin_read" ON buyer_profiles FOR SELECT USING ((SELECT public.is_admin()));

-- Médias / pricing / lots / images : lecture publique + gestion authentifiée
CREATE POLICY "Anyone can view media" ON media FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert media" ON media FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can view product pricing" ON product_pricing_tiers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage pricing" ON product_pricing_tiers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view lots" ON product_lots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage lots" ON product_lots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can view product images" ON product_images FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage product images" ON product_images FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- site_settings : ADMIN-ONLY GELÉ (état final hotfix + gel). Pas de authenticated_all.
REVOKE ALL ON TABLE public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.site_settings TO authenticated;
CREATE POLICY site_settings_admin_select ON public.site_settings
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY site_settings_admin_insert ON public.site_settings
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) AND key <> 'admin_emails');
CREATE POLICY site_settings_admin_update ON public.site_settings
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) AND key <> 'admin_emails')
  WITH CHECK ((SELECT public.is_admin()) AND key <> 'admin_emails');
-- Aucune policy DELETE (aucun DELETE client).

-- Grants applicatifs (comme Supabase : authenticated obtient le DML, la RLS
-- restreint l'écriture aux admins ; anon reste en lecture + soumission publique).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  categories, products, brands, suppliers, media, product_pricing_tiers,
  product_lots, product_images, quote_requests, collaboration_requests, buyer_profiles
  TO authenticated;
GRANT SELECT ON
  categories, products, brands, suppliers, media, product_pricing_tiers, product_images
  TO anon;
GRANT INSERT ON quote_requests, collaboration_requests TO anon;
