-- Fixture: mirror of production public schema (RLS-relevant subset) for LOCAL testing only.
-- Reproduces: site_settings + is_admin(), the 7 audited tables (minimal columns),
-- production-wide grants (anon+authenticated DML), is_admin EXECUTE = authenticated only,
-- and the EXACT current production policies (pre-hardening).

begin;

-- ── site_settings + is_admin() (identical semantics to production) ───────────
create table if not exists public.site_settings (key text primary key, value text);
insert into public.site_settings(key,value) values ('admin_emails','admin@synthetic.test')
  on conflict (key) do update set value=excluded.value;

create or replace function public.is_admin()
 returns boolean language sql stable security definer set search_path to '' as $fn$
  select (select auth.uid()) is not null
    and (auth.jwt() ->> 'email') is not null
    and exists (
      select 1 from public.site_settings as s
      cross join lateral pg_catalog.regexp_split_to_table(coalesce(s.value,''), ',') as configured_email
      where s.key='admin_emails'
        and pg_catalog.lower(pg_catalog.btrim(configured_email))
            = pg_catalog.lower(pg_catalog.btrim(auth.jwt() ->> 'email')));
$fn$;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- ── tables (minimal columns needed for tests) ───────────────────────────────
create table if not exists public.suppliers (id uuid primary key default gen_random_uuid(), name text, email text, is_active boolean default true);
create table if not exists public.product_pricing_tiers (id uuid primary key default gen_random_uuid(), product_id uuid, min_quantity int, price numeric, currency text default 'MAD');
create table if not exists public.product_images (id uuid primary key default gen_random_uuid(), product_id uuid, url text, ordre int);
create table if not exists public.product_lots (id uuid primary key default gen_random_uuid(), product_id uuid, lot text, quantity int);
create table if not exists public.media (id uuid primary key default gen_random_uuid(), url text);
create table if not exists public.quote_requests (id uuid primary key default gen_random_uuid(), company_name text, contact_name text, email text, country text, status text default 'new', buyer_address text);
create table if not exists public.collaboration_requests (id uuid primary key default gen_random_uuid(), company text, email text, status text default 'new');

-- ── production-wide grants (RLS is the only gate) ───────────────────────────
do $g$
declare t text;
begin
  foreach t in array array['suppliers','product_pricing_tiers','product_images','product_lots','media','quote_requests','collaboration_requests']
  loop
    execute format('grant select,insert,update,delete on public.%I to anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $g$;

-- ── EXACT current production policies (pre-hardening) ───────────────────────
-- suppliers
create policy "Anyone can view active suppliers" on public.suppliers for select to public using (is_active = true);
create policy "Authenticated users can manage suppliers" on public.suppliers for all to authenticated using (true) with check (true);
create policy "suppliers_admin_write" on public.suppliers for all to public using (public.is_admin()) with check (public.is_admin());
-- product_pricing_tiers
create policy "Anyone can view product pricing" on public.product_pricing_tiers for select to public using (true);
create policy "Authenticated users can manage pricing" on public.product_pricing_tiers for all to authenticated using (true) with check (true);
-- product_images
create policy "Anyone can view product images" on public.product_images for select to public using (true);
create policy "Authenticated users can manage product images" on public.product_images for all to authenticated using (true) with check (true);
-- product_lots
create policy "Authenticated users can view lots" on public.product_lots for select to authenticated using (true);
create policy "Authenticated users can manage lots" on public.product_lots for all to authenticated using (true) with check (true);
-- media
create policy "Anyone can view media" on public.media for select to public using (true);
create policy "Authenticated users can insert media" on public.media for insert to authenticated with check (true);
-- quote_requests
create policy "Anyone can submit quote requests" on public.quote_requests for insert to public with check (true);
create policy "Authenticated users can view quote requests" on public.quote_requests for select to authenticated using (true);
create policy "Authenticated users can update quote requests" on public.quote_requests for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete quote requests" on public.quote_requests for delete to authenticated using (true);
-- collaboration_requests
create policy "Anyone can submit collaboration requests" on public.collaboration_requests for insert to public with check (true);
create policy "Authenticated users can manage collaboration requests" on public.collaboration_requests for all to authenticated using (true) with check (true);

-- ── seed rows ───────────────────────────────────────────────────────────────
insert into public.suppliers(name,email,is_active) values ('ActiveSupplier','a@sup.test',true),('InactiveSupplier','i@sup.test',false);
insert into public.product_pricing_tiers(product_id,min_quantity,price) values (gen_random_uuid(),100,9.5);
insert into public.product_images(product_id,url,ordre) values (gen_random_uuid(),'https://img.test/1.jpg',1);
insert into public.product_lots(product_id,lot,quantity) values (gen_random_uuid(),'LOT-1',500);
insert into public.media(url) values ('https://media.test/x.png');
insert into public.quote_requests(company_name,contact_name,email,country) values ('BuyerCoA','Alice','buyerA@ext.test','MA');
insert into public.collaboration_requests(company,email) values ('PartnerCoX','partner@ext.test');

commit;
