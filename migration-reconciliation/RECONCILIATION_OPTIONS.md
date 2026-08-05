# RECONCILIATION_OPTIONS — reproductibilité & stratégies

**Lecture seule / analyse statique.** Aucune migration exécutée, aucune base modifiée.

## 7. Reproductibilité — rejeu des migrations locales sur une base vide (analyse STATIQUE)

Évaluation par lecture du DDL (non exécutée). Rejeu hypothétique des 15 fichiers dans l'ordre
lexicographique sur une base vide :

| Migration | Risque au rejeu | Cause | Gravité |
|---|---|---|---|
| `20260727000000_benchmark_improvements` | **ÉCHEC quasi certain** | `CREATE POLICY IF NOT EXISTS "…"` (l. 66,67) — **PostgreSQL ne supporte PAS `IF NOT EXISTS` sur `CREATE POLICY`** → erreur de syntaxe | 🔴 Bloquant |
| `20260525_create_collaboration_requests` | Reconnaissance/ordre | Nom **sans timestamp 14 chiffres** (`20260525_…`) → la CLI Supabase attend `^\d{14}_` ; fichier potentiellement **ignoré ou rejeté** | 🟠 Élevé |
| `20260525_update_quote_requests_comprehensive` | Reconnaissance/ordre | idem (nom non standard) | 🟠 Élevé |
| `20260728000003_rls_admin_function` | Dépendances | `is_admin()` + policies référencent categories/products/brands/suppliers/buyer_profiles → OK **si** #1/#2/#7 déjà appliquées (ordre respecté) | 🟢 Faible |
| `20260731000002` puis `20260801000001` | Aucun | `DROP FUNCTION IF EXISTS` avant recréation de `search_products` → idempotent | 🟢 OK |
| `20260801000002` puis `20260803000000` | Aucun | `DROP FUNCTION IF EXISTS` avant recréation de `list_source_sites` | 🟢 OK |
| Autres (`create_catalog_schema`, `update_product_schema_comprehensive`, `add_hs_code_index`, `create_buyer_profiles`, `create_site_settings`, `add_source_and_market_columns`, `add_prix_marche_source`) | Faible | `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN` (souvent gardés par blocs `DO`/`IF NOT EXISTS`), `CREATE INDEX IF NOT EXISTS` → globalement idempotents | 🟢 Faible |

**Conclusion Section 7** : en l'état, les migrations locales **ne peuvent pas être rejouées
proprement sur une base vide** — au minimum le `CREATE POLICY IF NOT EXISTS` échoue, et deux
fichiers ont un nommage non conforme. Ces défauts devront être corrigés **dans le cadre de la
stratégie retenue** (pas à cette étape ; on ne modifie pas encore les migrations d'origine).

> ⚠️ Écart de sécurité important : même si les migrations locales étaient rejouées, elles
> **recréeraient la faille** (`site_settings_authenticated_all` de #8 + `is_admin()` ILIKE de #9)
> car le hotfix et le gel **ne sont pas** dans `supabase/migrations/`. Toute reconstruction doit
> **inclure l'état de sécurité final** (baseline) et **non** l'historique brut.

## 8. Stratégies de réconciliation (évaluées, non exécutées)

### Stratégie A — Réparer l'historique existant (`supabase migration repair`)
Marquer `applied`/`reverted` uniquement les migrations à preuve EXACT_MATCH ou
SEMANTIC_MATCH_DIFFERENT_TIMESTAMP.

- **Versions qui seraient marquées `applied`** (semantic match, 5) : `20260727223938`,
  `20260729093955`, `20260731223810`, `20260731232809`, `20260801000011` — en les **associant**
  aux fichiers locaux correspondants (renommage local vers ces timestamps requis).
- **`enrich_products_columns` (`20260716145227`)** : à marquer `applied` **seulement** après avoir
  identifié le(s) fichier(s) local(aux) équivalent(s) (probable #2/#6) — sinon laisser tel quel.
- **Avantages** : conserve l'historique existant ; changement incrémental.
- **Risques** :
  - **0 EXACT_MATCH** et **8 UNKNOWN** → une grande partie de l'historique ne peut PAS être réparée
    de façon prouvée ; risque de **masquer une dérive** (marquer applied sans vérif de définition).
  - Le `CREATE POLICY IF NOT EXISTS` rend les fichiers **non rejouables** → repair ne résout pas la
    non‑reproductibilité.
  - Les 9 migrations fondatrices sans version distante resteraient **non enregistrées** ou
    devraient être insérées manuellement → fragile.
  - Ne capture pas proprement l'état de sécurité manuel (hotfix/gel).
- **Compatibilité** : moyenne. **Reconstruction base vide** : **non garantie**.

### Stratégie B — Nouvelle baseline (RECOMMANDÉE)
Capturer le **schéma actuel de production** comme baseline propre (`supabase db pull` **dans un
clone hors dépôt principal**, jamais dans `main`), archiver l'ancien historique local, repartir
avec des migrations futures cohérentes au‑dessus de la baseline.

- **Avantages** :
  - Une **seule** migration baseline = schéma réel (inclut hotfix + gel + is_admin durci) → **fin
    de la divergence**.
  - **Reconstruction d'une base vide reproductible** et vérifiable.
  - Élimine les défauts de rejeu (policy IF NOT EXISTS, noms non standard) par régénération.
  - État de sécurité **capturé tel quel** (pas de risque de recréer la faille).
- **Risques** :
  - La baseline doit être **fidèle** : vérifier que hotfix/gel/policies/grants/triggers y sont.
  - Les environnements **locaux/dev** doivent **réinitialiser** sur la nouvelle baseline.
  - Un futur **staging** doit être reconstruit depuis la baseline.
  - L'ancien historique (15 fichiers) doit être **archivé** (pas supprimé) pour audit.
- **Compatibilité** : élevée avec le projet (aucun impact frontend). **Reconstruction base vide** :
  **garantie** (par conception).

**Recommandation** : **Stratégie B (nouvelle baseline)**, car la divergence est trop profonde
(0 exact match, 8 unknown, 1 version distante orpheline, fichiers non rejouables, état de sécurité
hors historique). **Confiance : Moyenne** — à **confirmer** par la répétition en staging avant toute
décision définitive. Aucune stratégie n'est choisie définitivement à cette étape.
