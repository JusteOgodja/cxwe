-- is_admin() function: checks JWT email against site_settings.admin_emails
-- Add emails comma-separated in site_settings where key='admin_emails'

INSERT INTO site_settings (key, value)
VALUES ('admin_emails', 'ogodjajusteluc@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM site_settings
    WHERE key = 'admin_emails'
      AND ',' || value || ',' ILIKE '%,' || (auth.jwt() ->> 'email') || ',%'
  );
$$;

-- buyer_profiles: replace over-permissive policy with admin-only
DROP POLICY IF EXISTS "buyer_profiles_admin_select" ON buyer_profiles;
CREATE POLICY "buyer_profiles_admin_read" ON buyer_profiles
  FOR SELECT USING (is_admin());

-- categories: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON categories;
CREATE POLICY "categories_admin_insert" ON categories FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "categories_admin_update" ON categories FOR UPDATE USING (is_admin());
CREATE POLICY "categories_admin_delete" ON categories FOR DELETE USING (is_admin());

-- products: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON products;
CREATE POLICY "products_admin_insert" ON products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "products_admin_update" ON products FOR UPDATE USING (is_admin());
CREATE POLICY "products_admin_delete" ON products FOR DELETE USING (is_admin());

-- brands & suppliers: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated users can insert brands" ON brands;
DROP POLICY IF EXISTS "Authenticated users can update brands" ON brands;
DROP POLICY IF EXISTS "Authenticated users can delete brands" ON brands;
CREATE POLICY "brands_admin_write" ON brands FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "suppliers_admin_write" ON suppliers FOR ALL USING (is_admin()) WITH CHECK (is_admin());
