# BUSINESS_RULES — usages métier réels (frontend) par table

Déduits du **comportement réel du frontend** (pages, types, formulaires, requêtes Supabase),
pas seulement des policies. Fait déterminant : **aucune de ces tables ne possède de colonne de
propriété** (`user_id`/`buyer_id`/`created_by`). Les formulaires de demande sont **anonymes**
(aucun `auth.uid()` attaché). Il n'existe **aucun parcours acheteur** pour consulter ses propres
demandes. ⟹ la notion « propriétaire de la ligne » est **inapplicable** ici ; la règle correcte
pour les demandes est : soumission publique + gestion admin.

## Détail par table
| Table | Lue par | Créée par | Modifiée/supprimée par | Connexion requise (écrire) | Colonne owner | Lecture publique nécessaire |
|---|---|---|---|---|---|---|
| **quote_requests** | `admin/Quotes`, `admin/Dashboard`, `admin/Analytics`, `admin/AdminLayout` (badge) | `QuoteRequest.tsx`, `SampleRequest.tsx` (**anonyme**) | admin uniquement | non (INSERT public) | **aucune** | non (admin only) |
| **collaboration_requests** | `admin/Partners` | `Partner.tsx` (**anonyme**) | admin uniquement | non (INSERT public) | **aucune** | non (admin only) |
| **suppliers** | public (jointures produits, recherche `QuoteRequest`), `admin/Suppliers` (`*` incl. inactifs) | `admin/Suppliers` | `admin/Suppliers` | oui (admin) | aucune | **oui (actifs)** |
| **product_pricing_tiers** | public (`ProductDetail`), `admin/Products` | `admin/Products` | `admin/Products` | oui (admin) | aucune | **oui** |
| **product_images** | public (`ProductDetail`) | (admin — latent, pas d'écriture UI actuelle) | (admin — latent) | oui (admin) | aucune | **oui** |
| **product_lots** | aucune lecture frontend | (admin — latent) | (admin — latent) | oui (admin) | aucune | non (lecture `authenticated` conservée) |
| **media** | aucune lecture frontend (policy publique existante) | (admin — latent) | (admin — latent) | oui (admin) | aucune | conservée (existante) |

## Matrice d'accès cible (règles métier)
| Table | Anon | Utilisateur « propriétaire » | Autre utilisateur | Admin |
|---|---|---|---|---|
| quote_requests | INSERT (formulaire) uniquement | *(n/a — pas de propriété ; identique « autre utilisateur »)* | **aucun accès en lecture/écriture** | lecture + gestion complète |
| collaboration_requests | INSERT (formulaire) uniquement | *(n/a)* | **aucun accès** | lecture + gestion complète |
| suppliers | lecture **actifs** | lecture actifs (comme anon) | lecture actifs | lecture (incl. inactifs) + CRUD |
| product_pricing_tiers | lecture | lecture | lecture | CRUD |
| product_images | lecture | lecture | lecture | CRUD |
| product_lots | — | lecture (authenticated) | lecture (authenticated) | CRUD |
| media | lecture | lecture | lecture | CRUD |

## Justification « admin-only » pour les demandes (et non owner-scoped)
- Pas de colonne owner ⟹ impossible de restreindre au propriétaire sans changement de schéma
  (le **modèle UUID est explicitement hors périmètre** de ce lot).
- Les demandes sont soumises **anonymement** ; l'acheteur n'est pas authentifié au moment de l'envoi.
- Aucune page « mes demandes » côté acheteur n'existe (seules les pages admin lisent ces tables).
- On conserve strictement l'**INSERT public** (le formulaire doit continuer à fonctionner) et on
  **ne fait jamais confiance** à un `user_id` envoyé par le client (aucun n'est d'ailleurs envoyé).
- Si, plus tard, un espace acheteur « mes demandes » est introduit, il faudra ajouter une colonne
  `buyer_id uuid default auth.uid()` + une policy `SELECT USING (buyer_id = auth.uid())` — noté pour
  le lot « modèle UUID », non traité ici.
