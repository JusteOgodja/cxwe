# RPC_SECURITY_MATRIX — fonctions `public` (audit lecture seule)

On ignore les fonctions d'extension (`pg_trgm` : `gtrgm_*`, `similarity*`, `word_similarity*`,
`set_limit`, `show_*` ; `unaccent*`) — internes aux extensions, EXECUTE PUBLIC par défaut = EXPECTED.

| Fonction | Args | DEFINER | search_path | anon EXEC | auth EXEC | Écrit ? | Usage frontend | Risque |
|---|---|---|---|---|---|---|---|---|
| `is_admin` | () | **DEFINER** | `""` (figé) | **false** | true | non (lit site_settings) | contrôle admin serveur | ✅ EXPECTED (durci) |
| `search_products` | (text,uuid,uuid,bool,int,int) | INVOKER | — | true | true | non | recherche catalogue (public) | LOW (invoker → RLS ; search_path non figé) |
| `list_source_sites` | () | INVOKER | — | true | true | non | onglet Sources (public) | LOW (invoker ; search_path non figé) |
| `get_quality_stats` | () | INVOKER | — | **true** | true | non | admin/data-quality | MEDIUM (EXECUTE anon inutile ; invoker → agrégats limités RLS) |
| `get_products_with_issues` | (int) | INVOKER | — | **true** | true | non | admin/data-quality | MEDIUM (EXECUTE anon inutile) |
| `count_brands_no_active_products` | () | INVOKER | — | **true** | true | non | admin/data-quality | MEDIUM (EXECUTE anon inutile) |
| `count_categories_no_active_products` | () | INVOKER | — | **true** | true | non | admin/data-quality | MEDIUM (EXECUTE anon inutile) |
| `refresh_product_counts` | () | INVOKER | — | **true** | true | **oui (rafraîchit)** | admin/maintenance | MEDIUM (fonction à effet de bord exécutable par anon) |

Conclusions :
- **Un seul SECURITY DEFINER** (`is_admin`), correctement durci (search_path figé, EXECUTE réservé
  à `authenticated`, anon=false). **Aucune** autre fonction DEFINER → pas de risque « definer sans
  search_path ».
- Les RPC applicatives sont **INVOKER** → la RLS de l'appelant s'applique (pas de contournement de
  données). Le principal écart est de **moindre privilège** : les RPC d'**administration / qualité**
  (`get_quality_stats`, `get_products_with_issues`, `count_*`, `refresh_product_counts`) sont
  exécutables par **anon** sans nécessité → recommandation : `REVOKE EXECUTE ... FROM anon`
  (MEDIUM). `search_products`/`list_source_sites` restent nécessaires en public.
- `refresh_product_counts` (effet de bord) exécutable par anon = MEDIUM (DoS/latence potentielle) —
  bien qu'INVOKER limite les écritures effectives via RLS.
