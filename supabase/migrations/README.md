# ⚠️ IMPORTANT — MIGRATION HISTORY DIVERGENCE

The local migration directory is **not** currently synchronized with the production
`supabase_migrations.schema_migrations` history.

**Do NOT run:**
- `supabase db push`
- `supabase migration up`
- `supabase migration repair`
- `supabase db reset --linked`

until a controlled migration-history reconciliation has been completed.

Security hotfixes applied manually with `execute_sql` are archived under:

```
security-audit/applied-manual-sql/
```

These archived scripts are **already applied in production** and kept for audit only —
**never re-run them**. See `security-audit/APPLIED_MANUAL_DATABASE_CHANGES.md`.

---

# ⚠️ IMPORTANT — DIVERGENCE DE L'HISTORIQUE DE MIGRATION

Le dossier local des migrations n'est **pas** actuellement synchronisé avec l'historique de
production `supabase_migrations.schema_migrations`.

**Ne PAS lancer :**
- `supabase db push`
- `supabase migration up`
- `supabase migration repair`
- `supabase db reset --linked`

tant qu'une réconciliation contrôlée de l'historique de migration n'a pas été réalisée.

Les correctifs de sécurité appliqués manuellement avec `execute_sql` sont archivés sous :

```
security-audit/applied-manual-sql/
```

Ces scripts archivés sont **déjà appliqués en production** et conservés pour audit uniquement —
**ne jamais les rejouer**. Voir `security-audit/APPLIED_MANUAL_DATABASE_CHANGES.md`.
