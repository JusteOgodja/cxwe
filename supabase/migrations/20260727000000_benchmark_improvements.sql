-- Benchmark improvements: missing product fields, product_images, supplier trust fields

DO $$
BEGIN
  -- Product: shelf life for export (months)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'dluo') THEN
    ALTER TABLE products ADD COLUMN dluo integer;
  END IF;

  -- Product: indicative price (FOB, per unit)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'prix_indicatif') THEN
    ALTER TABLE products ADD COLUMN prix_indicatif numeric(12,4);
  END IF;

  -- Product: nutriscore
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'nutriscore') THEN
    ALTER TABLE products ADD COLUMN nutriscore text CHECK (nutriscore IN ('A','B','C','D','E'));
  END IF;

  -- Product: downloadable technical datasheet URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'fiche_technique_url') THEN
    ALTER TABLE products ADD COLUMN fiche_technique_url text;
  END IF;

  -- Supplier trust fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'is_verified') THEN
    ALTER TABLE suppliers ADD COLUMN is_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'annee_creation') THEN
    ALTER TABLE suppliers ADD COLUMN annee_creation integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'marches_export') THEN
    ALTER TABLE suppliers ADD COLUMN marches_export text[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'capacite_production') THEN
    ALTER TABLE suppliers ADD COLUMN capacite_production text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'politique_qc') THEN
    ALTER TABLE suppliers ADD COLUMN politique_qc text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'effectif') THEN
    ALTER TABLE suppliers ADD COLUMN effectif text;
  END IF;
END $$;

-- Product images gallery table
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  alt_text text DEFAULT '',
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS product_images_product_id_idx ON product_images(product_id);
CREATE INDEX IF NOT EXISTS product_images_ordre_idx ON product_images(product_id, ordre);

CREATE POLICY IF NOT EXISTS "Anyone can view product images" ON product_images FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Authenticated users can manage product images" ON product_images FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes for filter performance
CREATE INDEX IF NOT EXISTS products_certifications_idx ON products USING GIN (certifications);
CREATE INDEX IF NOT EXISTS products_pays_origine_idx ON products(pays_origine);
CREATE INDEX IF NOT EXISTS products_dluo_idx ON products(dluo);
CREATE INDEX IF NOT EXISTS products_commande_min_idx ON products(commande_min);
