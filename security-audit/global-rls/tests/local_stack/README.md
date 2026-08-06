# Test RLS local avec vrais JWT (pile Supabase locale)

Environnement **100 % local et jetable** (Docker + `npx supabase`), **jamais** la production.
Les clés `ANON`/`SERVICE` dans `run_tests.mjs` sont les **clés de démonstration standard**
de la pile locale Supabase (issuer `supabase-demo`, identiques pour tout le monde) — ce ne sont
pas des secrets de production.

## Étapes
```bash
# 1. Pile locale (storage/realtime/studio désactivés dans config.toml — inutiles ici)
npx supabase@latest init --force
npx supabase@latest start

# 2. Reproduire le schéma RLS de production (tables + is_admin() + grants larges +
#    policies ACTUELLES pré-durcissement) puis retirer EXECUTE is_admin à PUBLIC
#    (comme le hotfix prod : anon ne peut pas exécuter is_admin()).
DB=$(docker ps --filter name=supabase_db --format '{{.Names}}')
docker exec -i "$DB" psql -U postgres -d postgres < fixture_prod_mirror.sql
docker exec -i "$DB" psql -U postgres -d postgres -c "revoke execute on function public.is_admin() from public;"

# 3. BASELINE (état vulnérable) — reproduit les exploits
node run_tests.mjs

# 4. Appliquer le durcissement adapté (mêmes policies que la migration de la PR)
docker exec -i "$DB" psql -U postgres -d postgres < migration_adapted.sql

# 5. RE-TEST — vérifie les règles métier
node run_tests.mjs
```

## Ce que le test vérifie (règles métier, pas seulement l'existence des policies)
Pour chaque rôle réel (anon / utilisateur A / utilisateur B / admin synthétique) et chaque table :
`SELECT / INSERT / UPDATE / DELETE`, avec **nombre de lignes réellement affectées**
(UPDATE/DELETE sur une ligne jetable dédiée par rôle → pas d'interférence), plus une
**sonde d'isolation inter-utilisateurs** sur les demandes (B agit sur une ligne étrangère).

`migration_adapted.sql` est le miroir local du corps de
`../../migrations/20260805210930_global_rls_hardening.sql` (sans le bloc de préconditions
propre à la production).
