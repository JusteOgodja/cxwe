# Test local (vrais JWT) — lot MEDIUM/LOW restant

Environnement **100 % local et jetable** (Docker + `npx supabase`), jamais la production.
Les clés dans `run_tests2.mjs` sont les **clés de démo locales publiques** (issuer `supabase-demo`).

```bash
npx supabase@latest start                # storage/realtime/studio désactivés dans config.toml
DB=$(docker ps --filter name=supabase_db --format '{{.Names}}')

# Reconstruction #1 — baseline (état pré-lot)
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "drop schema if exists public cascade; create schema public;
   grant usage on schema public to anon, authenticated, service_role;
   grant all on schema public to postgres;"
docker exec -i "$DB" psql -U postgres -d postgres < fixture2_prod_mirror.sql
docker exec -i "$DB" psql -U postgres -d postgres -c "revoke execute on function public.is_admin() from public;"
node run_tests2.mjs                       # reproduit les constats

# Reconstruction #2 — après durcissement
docker exec -i "$DB" psql -U postgres -d postgres < ../../migrations/20260806120000_remaining_rls_hardening.sql
node run_tests2.mjs                       # vérifie règles métier + régressions
```

Le harnais couvre : isolation buyer_profiles (A/B, forge `user_id`), EXECUTE des RPC par rôle,
whitelist des grants anon (INSERT formulaires conservés), et les régressions
(brands / is_admin / écriture catégorie admin-only).

`fixture2_prod_mirror.sql` reproduit l'état **pré-lot** ; les corps de RPC sont des stubs minimaux
suffisants pour tester les **privilèges EXECUTE** (pas la logique métier des RPC).
