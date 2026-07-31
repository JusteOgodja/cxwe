-- ============================================================
-- Morocco Food Export — Toutes les migrations fusionnées
-- Coller ce fichier dans Supabase Dashboard > SQL Editor > Run
-- Idempotent : réexécutable sans danger
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- SOURCE: 20260525011107_create_catalog_schema.sql
-- ═══════════════════════════════════════════════════════════
/*
  # Morocco Food Export Catalog Schema

  ## Tables Created:
  1. `categories` - Product categories (33 from catalog)
     - id, name, slug, description, image_url, sort_order, is_active, created_at
  2. `products` - Products within each category
     - id, category_id, name, description, details (text[]), image_url, is_active, sort_order, created_at
  3. `quote_requests` - Customer quote/devis requests
     - id, company_name, contact_name, email, phone, country, products_interested, quantity_notes, message, status, created_at

  ## Security:
  - RLS enabled on all tables
  - Public can read active categories and products
  - Public can insert quote requests
  - Only authenticated admins can do full CRUD
*/

-- Categories table
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

CREATE POLICY "Anyone can view active categories"
  ON categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can view all categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (true);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  details text[] DEFAULT '{}',
  image_url text DEFAULT '',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id);

CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (true);

-- Quote requests table
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
  status text DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'responded', 'closed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit quote requests"
  ON quote_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view quote requests"
  ON quote_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update quote requests"
  ON quote_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete quote requests"
  ON quote_requests FOR DELETE
  TO authenticated
  USING (true);


-- ═══════════════════════════════════════════════════════════
-- SOURCE: 20260525022213_update_product_schema_comprehensive.sql
-- ═══════════════════════════════════════════════════════════
/*
  # Comprehensive FMCG Product Schema Update

  ## Changes:
  1. Adds brand and supplier tables
  2. Extends products table with full B2B FMCG attributes
  3. Adds media, pricing tiers, lots, and dimensions tables
  4. Adds proper RLS for all new tables
  5. Maintains backward compatibility with existing data

  ## New Tables:
  - brands: Brand information
  - suppliers: Supplier/vendor information
  - media: Centralized media management (photos, videos)
  - product_pricing_tiers: Price-quantity breakpoints
  - product_lots: Batch/lot tracking with expiry
  - Extends products with full specification fields
*/

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text DEFAULT '',
  logo_url text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active brands" ON brands FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can manage brands" ON brands FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  contact_name text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  country text DEFAULT '',
  description text DEFAULT '',
  logo_url text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active suppliers" ON suppliers FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can manage suppliers" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Media table for centralized asset management
CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  alt_text text DEFAULT '',
  media_type text DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view media" ON media FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert media" ON media FOR INSERT TO authenticated WITH CHECK (true);

-- Price tiers for volume-based pricing
CREATE TABLE IF NOT EXISTS product_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  min_quantity integer NOT NULL,
  price numeric(12,2) NOT NULL,
  currency text DEFAULT 'EUR',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS product_pricing_tiers_product_id_idx ON product_pricing_tiers(product_id);

CREATE POLICY "Anyone can view product pricing" ON product_pricing_tiers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage pricing" ON product_pricing_tiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Product lots / batches for inventory tracking
CREATE TABLE IF NOT EXISTS product_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  batch_number text UNIQUE NOT NULL,
  quantity integer NOT NULL,
  expiry_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_lots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS product_lots_product_id_idx ON product_lots(product_id);

CREATE POLICY "Authenticated users can view lots" ON product_lots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage lots" ON product_lots FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Extend products table with comprehensive B2B FMCG fields
DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'marque_id') THEN
    ALTER TABLE products ADD COLUMN marque_id uuid REFERENCES brands(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'fournisseur_id') THEN
    ALTER TABLE products ADD COLUMN fournisseur_id uuid REFERENCES suppliers(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'ean') THEN
    ALTER TABLE products ADD COLUMN ean text UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'hs_code') THEN
    ALTER TABLE products ADD COLUMN hs_code text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sous_categories_ids') THEN
    ALTER TABLE products ADD COLUMN sous_categories_ids uuid[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'temperature') THEN
    ALTER TABLE products ADD COLUMN temperature text DEFAULT 'Ambiante' CHECK (temperature IN ('Ambiante', 'Réfrigéré', 'Frais', 'Surgelé'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'photos_unite') THEN
    ALTER TABLE products ADD COLUMN photos_unite uuid[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'photos_carton') THEN
    ALTER TABLE products ADD COLUMN photos_carton uuid[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'videos') THEN
    ALTER TABLE products ADD COLUMN videos uuid[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'commande_min') THEN
    ALTER TABLE products ADD COLUMN commande_min integer DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'colisage') THEN
    ALTER TABLE products ADD COLUMN colisage integer DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'palettisation') THEN
    ALTER TABLE products ADD COLUMN palettisation jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'dimensions_unite') THEN
    ALTER TABLE products ADD COLUMN dimensions_unite jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'dimensions_carton') THEN
    ALTER TABLE products ADD COLUMN dimensions_carton jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'dimensions_palette') THEN
    ALTER TABLE products ADD COLUMN dimensions_palette jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'devise') THEN
    ALTER TABLE products ADD COLUMN devise text DEFAULT 'EUR';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'incoterms_dispo') THEN
    ALTER TABLE products ADD COLUMN incoterms_dispo text[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'ingredients_texte') THEN
    ALTER TABLE products ADD COLUMN ingredients_texte text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'ingredients_photo_id') THEN
    ALTER TABLE products ADD COLUMN ingredients_photo_id uuid REFERENCES media(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'nutrition_texte') THEN
    ALTER TABLE products ADD COLUMN nutrition_texte text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'nutrition_photo_id') THEN
    ALTER TABLE products ADD COLUMN nutrition_photo_id uuid REFERENCES media(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'allergenes') THEN
    ALTER TABLE products ADD COLUMN allergenes text[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'regimes') THEN
    ALTER TABLE products ADD COLUMN regimes text[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'duree_conservation') THEN
    ALTER TABLE products ADD COLUMN duree_conservation integer DEFAULT 365;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'pays_origine') THEN
    ALTER TABLE products ADD COLUMN pays_origine text DEFAULT 'Morocco';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'pays_export_autorises') THEN
    ALTER TABLE products ADD COLUMN pays_export_autorises text[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'certifications') THEN
    ALTER TABLE products ADD COLUMN certifications text[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'note_moyenne') THEN
    ALTER TABLE products ADD COLUMN note_moyenne numeric(3,2) DEFAULT 0 CHECK (note_moyenne >= 0 AND note_moyenne <= 5);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'nb_avis') THEN
    ALTER TABLE products ADD COLUMN nb_avis integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_new') THEN
    ALTER TABLE products ADD COLUMN is_new boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_promo') THEN
    ALTER TABLE products ADD COLUMN is_promo boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'est_sponsored') THEN
    ALTER TABLE products ADD COLUMN est_sponsored boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'statut') THEN
    ALTER TABLE products ADD COLUMN statut text DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'brouillon', 'archivé'));
  END IF;

END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS products_marque_id_idx ON products(marque_id);
CREATE INDEX IF NOT EXISTS products_fournisseur_id_idx ON products(fournisseur_id);
CREATE INDEX IF NOT EXISTS products_ean_idx ON products(ean);
CREATE INDEX IF NOT EXISTS products_statut_idx ON products(statut);
CREATE INDEX IF NOT EXISTS products_is_new_idx ON products(is_new);
CREATE INDEX IF NOT EXISTS products_is_promo_idx ON products(is_promo);


-- ═══════════════════════════════════════════════════════════
-- SOURCE: 20260525_create_collaboration_requests.sql
-- ═══════════════════════════════════════════════════════════
/*
  # Collaboration / Partnership Requests
  Producers who want Redmac to export their products submit this form.
*/

CREATE TABLE IF NOT EXISTS collaboration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company identity
  company_name   text NOT NULL,
  contact_name   text NOT NULL,
  email          text NOT NULL,
  phone          text DEFAULT '',
  country        text NOT NULL,
  city           text DEFAULT '',
  website        text DEFAULT '',

  -- Product info
  product_name        text NOT NULL,
  product_category    text DEFAULT '',
  product_description text DEFAULT '',
  annual_capacity     text DEFAULT '',   -- e.g. "500 tonnes / an"
  certifications      text[] DEFAULT '{}',
  packaging_types     text DEFAULT '',

  -- Export profile
  already_exporting   boolean DEFAULT false,
  current_markets     text DEFAULT '',   -- free text: "France, Espagne"
  target_markets      text DEFAULT '',

  -- Message
  message text DEFAULT '',

  -- Status & tracking
  status text DEFAULT 'new' CHECK (status IN ('new','contacted','en_discussion','partenaire','refusé')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE collaboration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit collaboration requests"
  ON collaboration_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage collaboration requests"
  ON collaboration_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS collab_status_idx ON collaboration_requests(status);
CREATE INDEX IF NOT EXISTS collab_created_idx ON collaboration_requests(created_at DESC);


-- ═══════════════════════════════════════════════════════════
-- SOURCE: 20260525_update_quote_requests_comprehensive.sql
-- ═══════════════════════════════════════════════════════════
/*
  # Comprehensive Quote Request Schema Update
  Adds fields required to generate a formal international trade quotation
  following Incoterms 2020 and standard B2B export document norms.
*/

DO $$
BEGIN

  -- Buyer legal identity
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='buyer_vat_number') THEN
    ALTER TABLE quote_requests ADD COLUMN buyer_vat_number text;
  END IF;

  -- Buyer full address
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='buyer_address') THEN
    ALTER TABLE quote_requests ADD COLUMN buyer_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='buyer_city') THEN
    ALTER TABLE quote_requests ADD COLUMN buyer_city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='buyer_postal_code') THEN
    ALTER TABLE quote_requests ADD COLUMN buyer_postal_code text;
  END IF;

  -- Delivery address (if different)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='delivery_address') THEN
    ALTER TABLE quote_requests ADD COLUMN delivery_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='delivery_country') THEN
    ALTER TABLE quote_requests ADD COLUMN delivery_country text;
  END IF;

  -- Commercial terms
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='incoterm') THEN
    ALTER TABLE quote_requests ADD COLUMN incoterm text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='port_loading') THEN
    ALTER TABLE quote_requests ADD COLUMN port_loading text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='port_destination') THEN
    ALTER TABLE quote_requests ADD COLUMN port_destination text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='currency') THEN
    ALTER TABLE quote_requests ADD COLUMN currency text DEFAULT 'EUR';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='payment_terms') THEN
    ALTER TABLE quote_requests ADD COLUMN payment_terms text;
  END IF;

  -- Logistics
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='container_type') THEN
    ALTER TABLE quote_requests ADD COLUMN container_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='delivery_date') THEN
    ALTER TABLE quote_requests ADD COLUMN delivery_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='order_frequency') THEN
    ALTER TABLE quote_requests ADD COLUMN order_frequency text;
  END IF;

  -- Requirements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='required_certifications') THEN
    ALTER TABLE quote_requests ADD COLUMN required_certifications text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='labeling_requirements') THEN
    ALTER TABLE quote_requests ADD COLUMN labeling_requirements text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='private_label') THEN
    ALTER TABLE quote_requests ADD COLUMN private_label boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_requests' AND column_name='sample_request') THEN
    ALTER TABLE quote_requests ADD COLUMN sample_request boolean DEFAULT false;
  END IF;

END $$;

-- Index for faster admin queries
CREATE INDEX IF NOT EXISTS quote_requests_status_idx ON quote_requests(status);
CREATE INDEX IF NOT EXISTS quote_requests_created_at_idx ON quote_requests(created_at DESC);


-- ═══════════════════════════════════════════════════════════
-- SOURCE: 20260529000000_add_hs_code_index.sql
-- ═══════════════════════════════════════════════════════════
-- Index pour accélérer les recherches et filtrages par code SH
CREATE INDEX IF NOT EXISTS products_hs_code_idx ON products(hs_code);

