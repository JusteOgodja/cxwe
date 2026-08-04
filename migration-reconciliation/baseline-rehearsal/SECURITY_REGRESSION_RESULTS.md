# SECURITY_REGRESSION_RESULTS — tests RLS locaux (utilisateurs fictifs)

Exécutés sur la base locale reconstruite (baseline corrigée), rôles `anon`/`authenticated` +
`request.jwt.claims` simulés, en transaction **rollback**. Emails/ids **100% fictifs**.

## Anonyme
| Contrôle | Résultat | Attendu |
|---|---|---|
| Lecture produits actifs | `2` lignes | lecture publique OK ✅ |
| Insertion produit | **blocked** | bloqué ✅ |
| Lecture `site_settings` | **blocked** | aucun accès ✅ |

## Utilisateur ordinaire (synthétique)
| Contrôle | Résultat | Attendu |
|---|---|---|
| `is_admin()` | `f` | false ✅ |
| Update `site_settings` | `0` lignes | bloqué ✅ |
| Update produit | `0` lignes | bloqué ✅ |
| Update `admin_emails` | `0` lignes | bloqué ✅ |

## Administrateur (synthétique)
| Contrôle | Résultat | Attendu |
|---|---|---|
| `is_admin()` | `t` | true ✅ |
| Update produit (catalogue) | `1` ligne | autorisé ✅ |
| Update paramètre ordinaire (`site_name`) | `1` ligne | autorisé ✅ |
| Update **valeur** `admin_emails` | `0` ligne | bloqué ✅ |
| **Renommer** `admin_emails` → autre | `0` ligne | bloqué ✅ |
| **Renommer** autre → `admin_emails` | **blocked** (CHECK) | bloqué ✅ |
| **Insérer** nouvelle ligne `admin_emails` | **blocked** (CHECK) | bloqué ✅ |

## Régression — ancienne escalade rejouée
Scénario : utilisateur ordinaire → tente de modifier `admin_emails` → vérifie `is_admin()` → tente
une écriture administrative.

```text
update_admin_emails = blocked
is_admin_after      = false
admin_write         = blocked
```

**Tous les résultats obligatoires sont atteints.** L'ancienne faille d'escalade de privilèges est
**impossible** sur la baseline candidate. Aucune donnée de test persistée (rollback).
