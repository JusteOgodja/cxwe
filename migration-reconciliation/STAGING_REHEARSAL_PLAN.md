# STAGING_REHEARSAL_PLAN — répétition obligatoire (hors production)

Objectif : **prouver** la stratégie de réconciliation sur un environnement jetable **avant** toute
action sur `main` ou sur la base de production. **Aucune donnée de production** n'est utilisée.

## Environnement (au choix)
1. **Base Supabase locale** : `supabase start` (Docker) sur un **clone du dépôt hors répertoire
   principal** — jamais dans le dépôt de production.
2. **OU projet Supabase de staging séparé** (nouveau projet dédié, aucune donnée réelle).

> Les commandes ci‑dessous s'exécutent **uniquement** dans cet environnement de répétition, jamais
> contre le projet de production `fk****cx (ref prod masqué)`.

## Étape 0 — Capturer la baseline (Stratégie B) ou l'historique (Stratégie A)
- **B** : dans un clone hors dépôt principal, `supabase db pull` **connecté au projet de
  production en lecture** pour générer un fichier baseline `<ts>_baseline.sql`, PUIS déconnecter.
  Ne PAS committer dans `main` ; conserver dans la branche d'audit / un dossier dédié.
- **A** : préparer les `supabase migration repair --status applied <version>` pour les 5 versions
  semantic‑match, à tester d'abord en staging.

## Étape 1 — Reconstruire une base vide
- Staging vierge → appliquer la baseline (B) ou l'historique réparé (A).
- **Attendu** : exécution sans erreur (la baseline B élimine le `CREATE POLICY IF NOT EXISTS` et les
  noms non standard ; en A, ces défauts doivent être corrigés au préalable).

## Étape 2 — Comparer le schéma obtenu au schéma attendu (production)
Inventaire **lecture seule** (SQL autorisé en staging) et diff :
- tables + colonnes + types + contraintes ;
- index ;
- fonctions + `prosecdef` (SECURITY DEFINER/INVOKER) + `search_path` + définitions ;
- policies RLS (USING / WITH CHECK) ;
- grants ; triggers ; vues ; RPC.

## Étape 3 — Vérifications de sécurité obligatoires (doivent réussir)
- `public.is_admin()` = version **durcie** (SECURITY DEFINER, `search_path=''`, comparaison exacte).
- `site_settings` : policies **admin‑only gelées** présentes (`admin_select/insert/update` avec
  `key<>'admin_emails'`), **aucune** `site_settings_authenticated_all`, **aucune** policy DELETE.
- **Hotfix et gel présents** dans la baseline (l'état final, pas la faille).
- Rejeu (rollback) des preuves : `security-audit/tests/00_*` et `01_*` → résultats attendus
  identiques (exploit bloqué ; gel effectif).

## Étape 4 — Vérifier `migration list`
- `supabase migration list` **cohérent** : historique local = historique staging.
- **Aucune migration rejouée par erreur** (idempotence / baseline unique).

## Étape 5 — Frontend fonctionnel sur staging
- Pointer un build frontend sur le projet de staging (clés staging) :
  accueil, catalogue, login admin, page Settings **sans** champ Admin Emails, `is_admin()` RPC.
- **Aucune donnée de production** ; comptes de test uniquement.

## Critères de réussite (tous requis)
- [ ] `migration list` cohérent, aucune migration rejouée par erreur ;
- [ ] schéma final **identique** au schéma attendu (tables/colonnes/fonctions/policies/grants/
      triggers/index) ;
- [ ] **hotfix et gel toujours présents** ;
- [ ] RLS correcte (exploit bloqué, gel effectif, public en lecture inchangé) ;
- [ ] frontend fonctionnel ;
- [ ] **aucune donnée de production utilisée**.

## Sortie de la répétition
- Si **B** réussit → proposer l'adoption de la baseline (décision explicite requise, hors ce lot).
- Si **A** réussit et B non nécessaire → proposer le plan `repair` exact validé en staging.
- En cas d'échec → consigner migration, erreur, dépendance manquante/objet existant, cause, et
  itérer **en staging uniquement**.
