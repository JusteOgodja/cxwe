-- Fixture (LOCAL only) mirroring the PRE-lot production state for the remaining
-- MEDIUM/LOW hardening: buyer_profiles, categories, products, brands, quote/collab,
-- the application RPCs (with pre-M3 EXECUTE = anon+authenticated), and wide anon grants.
-- RPC bodies are minimal stubs sufficient to test EXECUTE privileges (not correctness).

begin;

-- ── site_settings + is_admin() ───────────────────────────────────────────────
create table if not exists public.site_settings (key text primary key, value text);
insert into public.site_settings(key,value) values ('admin_emails','admin@synthetic.test')
  on conflict (key) do update set value=excluded.value;
create or replace function public.is_admin()
 returns boolean language sql stable security definer set search_path to '' as $fn$
  select (select auth.uid()) is not null and (auth.jwt() ->> 'email') is not null
    and exists (select 1 from public.site_settings s
      cross join lateral pg_catalog.regexp_split_to_table(coalesce(s.value,''), ',') as ce
      where s.key='admin_emails'
        and pg_catalog.lower(pg_catalog.btrim(ce)) = pg_catalog.lower(pg_catalog.btrim(auth.jwt() ->> 'email')));
$fn$;
revoke execute on function public.is_admin() from public;      -- prod hotfix: anon cannot execute
grant execute on function public.is_admin() to authenticated;

-- ── tables ───────────────────────────────────────────────────────────────────
create table if not exists public.buyer_profiles (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, company_name text, country text);
create table if not exists public.categories (id uuid primary key default gen_random_uuid(), name text, is_active boolean default true);
create table if not exists public.products (id uuid primary key default gen_random_uuid(), name text, is_active boolean default true, source_url text);
create table if not exists public.brands (id uuid primary key default gen_random_uuid(), name text, is_active boolean default true);
create table if not exists public.quote_requests (id uuid primary key default gen_random_uuid(), company_name text, email text);
create table if not exists public.collaboration_requests (id uuid primary key default gen_random_uuid(), company text, email text);
-- tables catalogue également touchées par la boucle M4 (grants anon à révoquer)
create table if not exists public.suppliers (id uuid primary key default gen_random_uuid(), name text, is_active boolean default true);
create table if not exists public.product_pricing_tiers (id uuid primary key default gen_random_uuid(), product_id uuid);
create table if not exists public.product_images (id uuid primary key default gen_random_uuid(), product_id uuid);
create table if not exists public.product_lots (id uuid primary key default gen_random_uuid(), product_id uuid);
create table if not exists public.media (id uuid primary key default gen_random_uuid(), url text);

do $g$ declare t text; begin
  foreach t in array array['buyer_profiles','categories','products','brands','quote_requests','collaboration_requests',
    'suppliers','product_pricing_tiers','product_images','product_lots','media']
  loop
    execute format('grant select,insert,update,delete,truncate,references,trigger on public.%I to anon', t);
    execute format('grant select,insert,update,delete on public.%I to authenticated', t);
    execute format('grant select,insert,update,delete on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $g$;

-- ── buyer_profiles : policies ACTUELLES (pré-lot, dupliquées + admin_read public) ──
create policy "Buyers can insert their own profile" on public.buyer_profiles for insert to public with check (auth.uid() = user_id);
create policy "buyer_profiles_insert_own"          on public.buyer_profiles for insert to public with check (user_id = auth.uid());
create policy "Buyers can read their own profile"  on public.buyer_profiles for select to public using (auth.uid() = user_id);
create policy "buyer_profiles_select_own"          on public.buyer_profiles for select to public using (user_id = auth.uid());
create policy "buyer_profiles_admin_read"          on public.buyer_profiles for select to public using (public.is_admin());
create policy "Buyers can update their own profile" on public.buyer_profiles for update to public using (auth.uid() = user_id);

-- ── categories/products : policies ACTUELLES (admin write TO public) ──────────
create policy "Anyone can view active categories"       on public.categories for select to public using (is_active = true);
create policy "Authenticated users can view all categories" on public.categories for select to authenticated using (true);
create policy categories_admin_insert on public.categories for insert to public with check (is_admin());
create policy categories_admin_update on public.categories for update to public using (is_admin());
create policy categories_admin_delete on public.categories for delete to public using (is_admin());
create policy "Anyone can view active products"         on public.products for select to public using (is_active = true);
create policy "Authenticated users can view all products" on public.products for select to authenticated using (true);
create policy products_admin_insert on public.products for insert to public with check (is_admin());
create policy products_admin_update on public.products for update to public using (is_admin());
create policy products_admin_delete on public.products for delete to public using (is_admin());

-- ── brands (regression) : lecture publique active + admin par commande ───────
create policy "Anyone can view active brands" on public.brands for select to public using (is_active = true);
create policy brands_admin_insert on public.brands for insert to authenticated with check ((select public.is_admin()));
create policy brands_admin_update on public.brands for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy brands_admin_delete on public.brands for delete to authenticated using ((select public.is_admin()));
create policy brands_admin_select on public.brands for select to authenticated using ((select public.is_admin()));

-- ── quote/collaboration : INSERT public (formulaires) ────────────────────────
create policy "Anyone can submit quote requests"         on public.quote_requests for insert to public with check (true);
create policy quote_requests_admin_select on public.quote_requests for select to authenticated using ((select public.is_admin()));
create policy "Anyone can submit collaboration requests" on public.collaboration_requests for insert to public with check (true);
create policy collaboration_admin_select on public.collaboration_requests for select to authenticated using ((select public.is_admin()));

-- ── catalogue : lecture (miroir) ─────────────────────────────────────────────
create policy "Anyone can view active suppliers" on public.suppliers for select to public using (is_active = true);
create policy "Anyone can view product pricing"   on public.product_pricing_tiers for select to public using (true);
create policy "Anyone can view product images"    on public.product_images for select to public using (true);
create policy "Anyone can view media"             on public.media for select to public using (true);
create policy "Authenticated users can view lots" on public.product_lots for select to authenticated using (true);

-- ── RPC stubs (EXECUTE pré-M3 = anon+authenticated via PUBLIC par défaut) ────
create or replace function public.get_quality_stats() returns table(total int) language sql stable as $$ select 0 $$;
create or replace function public.get_products_with_issues(p_limit integer default 300) returns table(id uuid) language sql stable as $$ select null::uuid where false $$;
create or replace function public.count_brands_no_active_products() returns integer language sql stable as $$ select 0 $$;
create or replace function public.count_categories_no_active_products() returns integer language sql stable as $$ select 0 $$;
create or replace function public.search_products(p_query text default '', p_category uuid default null, p_brand uuid default null, p_active boolean default true, p_limit integer default 100, p_offset integer default 0)
  returns table(id uuid) language sql stable as $$ select id from public.products limit p_limit $$;
create or replace function public.list_source_sites() returns table(site text) language sql stable as $$ select distinct source_url from public.products where source_url is not null $$;
create or replace function public.refresh_product_counts() returns trigger language plpgsql as $$ begin return null; end $$;
-- EXECUTE par défaut = PUBLIC (donc anon+authenticated) : on laisse tel quel (état pré-lot).

-- ── seed ─────────────────────────────────────────────────────────────────────
insert into public.categories(name,is_active) values ('Huiles',true),('Inactive',false);
insert into public.products(name,is_active,source_url) values ('Huile Argan',true,'https://siteA.example/p1'),('Draft',false,null);
insert into public.brands(name,is_active) values ('BrandActive',true),('BrandInactive',false);

commit;
