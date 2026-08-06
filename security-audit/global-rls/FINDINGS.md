# FINDINGS — audit RLS / grants / RPC (classement)

## CRITICAL
- **C1 — quote_requests : lecture/écriture par tout utilisateur authentifié.**
  Policies `Authenticated users can view/update/delete quote requests` (`USING true`, TO
  authenticated). Toute personne connectée (un acheteur) peut **lire, modifier et supprimer TOUTES
  les demandes de devis** (PII inter-utilisateurs : société, contact, email, téléphone, adresse,
  message). Fuite de données personnelles + altération/suppression. → corrigé par la migration.

## HIGH
- **H1 — collaboration_requests : gérée par tout authentifié** (`ALL USING true`) → lecture/
  suppression des soumissions de partenariat (PII) par n'importe quel connecté.
- **H2 — suppliers : double problème (miroir de brands).**
  (a) `Authenticated users can manage suppliers` (`ALL true`) → écriture/suppression ordinaire ;
  (b) `suppliers_admin_write` (`FOR ALL TO public` `is_admin()`) → **401 anonyme** sur la lecture
  des fournisseurs (vérifié : `GET /suppliers?is_active=eq.true` = 401/42501). Lecture publique
  cassée + écriture ordinaire.
- **H3 — product_pricing_tiers : `ALL USING true`** → un utilisateur ordinaire peut modifier/
  supprimer les **tarifs** (donnée business, ~10 500 lignes).
- **H4 — product_images : `ALL USING true`** → écriture/suppression des images catalogue par un
  utilisateur ordinaire (vandalisme).
- **H5 — product_lots : `ALL USING true`** → écriture/suppression des lots par un utilisateur
  ordinaire.

## MEDIUM
- **M1 — media : `INSERT WITH CHECK true`** (authenticated) → insertion de lignes media par tout
  connecté (spam ; pas de update/delete ordinaire).
- **M2 — buyer_profiles : policy `buyer_profiles_admin_read` en rôle `public` appelant `is_admin()`**
  → **401 anonyme** sur la lecture (vérifié). Latent (anon n'interroge pas cette table côté public)
  mais anti-pattern identique à brands. À corriger (rôle `authenticated`).
- **M3 — RPC d'administration/qualité exécutables par anon** (`get_quality_stats`,
  `get_products_with_issues`, `count_brands_no_active_products`,
  `count_categories_no_active_products`, `refresh_product_counts`) → moindre privilège :
  `REVOKE EXECUTE ... FROM anon`. `refresh_product_counts` a un effet de bord (latence).
- **M4 — grants DML larges pour `anon`** : `anon` possède `INSERT/UPDATE/DELETE/TRUNCATE` sur les
  tables (bien que la RLS bloque). Défense en profondeur : envisager `REVOKE` des DML anon inutiles
  (hors lecture + soumissions publiques). Non urgent (RLS bloque déjà).

## LOW
- **L1 — buyer_profiles : policies dupliquées** (`insert_own` ×2, `select_own` ×2 : « Buyers can… »
  et `buyer_profiles_*`). Nettoyage.
- **L2 — categories/products : policies admin d'écriture en rôle `public`** (au lieu de
  `authenticated`) → une écriture anon déclenche l'évaluation de `is_admin()` (erreur/401) au lieu
  d'un refus propre. Cosmétique (écriture déjà bloquée ; policies par commande donc pas de 401 en
  lecture).
- **L3 — search_products / list_source_sites : INVOKER sans `search_path` figé** (bonnes pratiques).

## EXPECTED (conforme, aucune action)
- `is_admin()` durci (DEFINER, `search_path=""`, EXECUTE authenticated only).
- `site_settings` gelé admin-only (+ `admin_emails` gelé) ; ancien exploit fermé.
- `brands` corrigé (lot précédent).
- `products` / `categories` : écritures admin par commande + lecture publique des actifs.
- INSERT public sur `quote_requests` / `collaboration_requests` (formulaires de contact) — voulu.
- Lecture publique des `products/categories/brands/suppliers` **actifs** — voulue.
- Storage : aucun bucket / aucune policy — aucune exposition.
- RPC applicatives en INVOKER (RLS s'applique) ; recherche publique légitime.
