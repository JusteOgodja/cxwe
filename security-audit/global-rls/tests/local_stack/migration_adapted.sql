-- Adapted RLS hardening (business-rule aware) — LOCAL application (policy DDL only).
-- Mirrors the production migration body (without the prod-state precondition guard).
begin;

-- ── suppliers (catalog): public read of ACTIVE; admin full incl. inactive ────
drop policy if exists "Authenticated users can manage suppliers" on public.suppliers;
drop policy if exists "suppliers_admin_write" on public.suppliers;           -- kills anon-401 (FOR ALL TO public is_admin)
-- keep "Anyone can view active suppliers" (public, is_active=true)
create policy "suppliers_admin_select" on public.suppliers for select to authenticated using ((select public.is_admin()));
create policy "suppliers_admin_insert" on public.suppliers for insert to authenticated with check ((select public.is_admin()));
create policy "suppliers_admin_update" on public.suppliers for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "suppliers_admin_delete" on public.suppliers for delete to authenticated using ((select public.is_admin()));

-- ── product_pricing_tiers (catalog): public read; admin write ────────────────
drop policy if exists "Authenticated users can manage pricing" on public.product_pricing_tiers;
create policy "pricing_admin_insert" on public.product_pricing_tiers for insert to authenticated with check ((select public.is_admin()));
create policy "pricing_admin_update" on public.product_pricing_tiers for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "pricing_admin_delete" on public.product_pricing_tiers for delete to authenticated using ((select public.is_admin()));

-- ── product_images (catalog): public read; admin write ───────────────────────
drop policy if exists "Authenticated users can manage product images" on public.product_images;
create policy "product_images_admin_insert" on public.product_images for insert to authenticated with check ((select public.is_admin()));
create policy "product_images_admin_update" on public.product_images for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "product_images_admin_delete" on public.product_images for delete to authenticated using ((select public.is_admin()));

-- ── product_lots (catalog): keep authenticated view (no public need); admin write
drop policy if exists "Authenticated users can manage lots" on public.product_lots;
-- keep "Authenticated users can view lots"
create policy "lots_admin_insert" on public.product_lots for insert to authenticated with check ((select public.is_admin()));
create policy "lots_admin_update" on public.product_lots for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "lots_admin_delete" on public.product_lots for delete to authenticated using ((select public.is_admin()));

-- ── media (catalog): public read; admin write ────────────────────────────────
drop policy if exists "Authenticated users can insert media" on public.media;
create policy "media_admin_insert" on public.media for insert to authenticated with check ((select public.is_admin()));
create policy "media_admin_update" on public.media for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "media_admin_delete" on public.media for delete to authenticated using ((select public.is_admin()));

-- ── quote_requests (demande, ownerless): public INSERT kept; admin-only manage ─
drop policy if exists "Authenticated users can view quote requests" on public.quote_requests;
drop policy if exists "Authenticated users can update quote requests" on public.quote_requests;
drop policy if exists "Authenticated users can delete quote requests" on public.quote_requests;
-- keep "Anyone can submit quote requests" (public INSERT — contact form)
create policy "quote_requests_admin_select" on public.quote_requests for select to authenticated using ((select public.is_admin()));
create policy "quote_requests_admin_update" on public.quote_requests for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "quote_requests_admin_delete" on public.quote_requests for delete to authenticated using ((select public.is_admin()));

-- ── collaboration_requests (demande, ownerless): public INSERT kept; admin-only ─
drop policy if exists "Authenticated users can manage collaboration requests" on public.collaboration_requests;
-- keep "Anyone can submit collaboration requests" (public INSERT)
create policy "collaboration_requests_admin_select" on public.collaboration_requests for select to authenticated using ((select public.is_admin()));
create policy "collaboration_requests_admin_update" on public.collaboration_requests for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "collaboration_requests_admin_delete" on public.collaboration_requests for delete to authenticated using ((select public.is_admin()));

commit;
