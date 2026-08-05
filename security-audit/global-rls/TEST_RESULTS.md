# TEST_RESULTS

## Environnement
- **Pile Supabase locale : INDISPONIBLE** — le daemon Docker est resté non réactif cette session
  (`docker ps`/`docker info` en timeout). Les tests « vrais JWT » locaux (anon / ordinaire / second
  ordinaire / admin / isolation) **n'ont pas pu être exécutés** → marqués **UNVERIFIED**.
- **Aucun utilisateur de test créé en production** (conformément à la consigne).
- Contrôles **anon** réalisés en **lecture seule** via la clé anon (aucune création de compte).

## Anon (production, réel — lecture seule)
| Contrôle | Résultat | Interprétation |
|---|---|---|
| `GET /suppliers?is_active=eq.true` | **401 (42501 is_admin)** | 🟥 lecture publique cassée (H2) — sera 200 après correction |
| `GET /buyer_profiles` | **401 (42501 is_admin)** | 🟥 policy admin_read en rôle public (M2) |
| `GET /quote_requests` | 200 / 0 ligne | anon ne lit pas les devis (OK) |
| `GET /collaboration_requests` | 200 / 0 ligne | anon ne lit pas (OK) |
| `GET /product_pricing_tiers` | 200 / lignes | lecture publique des tarifs (voulu) |
| `GET /brands?is_active=eq.true` | 200 | ✅ corrigé (lot précédent) |

## Ordinaire / second ordinaire / admin / isolation
- **UNVERIFIED** (Docker indisponible ; interdiction de créer des comptes de test en production).
- Comportements **attendus** (déduits des policies, à valider en local/staging) :
  - ordinaire : `is_admin()=false` ; **ne peut PAS** lire `quote_requests`/`collaboration_requests` ;
    **ne peut PAS** écrire `suppliers`/`product_pricing_tiers`/`product_images`/`product_lots`/`media`
    après correction ; ne voit que son propre `buyer_profiles`.
  - second ordinaire : n'accède pas aux `buyer_profiles`/devis d'un autre (isolation par
    `user_id = auth.uid()` pour buyer_profiles ; quotes admin-only après correction).
  - admin : `is_admin()=true` ; lit/gère toutes les tables concernées.
  - ancien exploit `admin_emails` : **toujours bloqué** (gel intact, non touché par cette migration).

## À exécuter avant application (Docker requis)
1. `supabase start` (pile locale) ou projet de staging.
2. `tests/test_global_rls_hardening.sql` (rollback) + tests HTTP « vrais JWT » (anon / 2 ordinaires /
   admin) sur les tables sensibles (SELECT/INSERT/UPDATE/DELETE) + isolation inter-utilisateurs.
3. Confirmer : suppliers anon=200 ; ordinaire bloqué en lecture devis/collaboration et en écriture ;
   admin OK ; catalogue + formulaires devis/échantillon OK.
