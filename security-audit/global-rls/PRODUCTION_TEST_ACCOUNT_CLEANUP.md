# PRODUCTION_TEST_ACCOUNT_CLEANUP

## Contexte
Lors de la validation fonctionnelle du **fix brands** (lot précédent), un **compte utilisateur
ordinaire jetable** a été créé en production via l'API Auth (GoTrue, auto-confirmation active) pour
vérifier qu'un utilisateur authentifié ordinaire **ne peut plus** écrire dans `brands`
(INSERT=403, UPDATE/DELETE=0 ligne, `is_admin()=false`).

- **Aucun email ni UUID** de ce compte n'est affiché ni versionné (données personnelles).
- Le compte est **sans rôle admin** (non présent dans `admin_emails`) et **sans profil acheteur**
  particulier ; il n'a modifié **aucune donnée métier** (toutes ses écritures ont été bloquées).
- Depuis, **aucun nouveau compte de test** n'a été créé en production (consigne respectée).

## Action de nettoyage requise (manuelle)
Supprimer ce compte depuis **Supabase Dashboard → Authentication → Users** :
1. Filtrer les emails commençant par `brandsfix.test.` (domaine `@example.com`).
2. Supprimer l'utilisateur correspondant (créé à la date de validation du fix brands).

## Ce qui NE doit PAS être fait
- ❌ Ne pas supprimer via une **clé `service_role`** exposée/en script.
- ❌ Ne pas ajouter de script de suppression au dépôt.
- ❌ Ne pas manipuler `auth.users` par SQL en production.

> Impact de laisser le compte : négligeable (utilisateur ordinaire sans privilège, sans données
> métier). Nettoyage recommandé par hygiène.
