# STAGING_RESULTS — répétition sur projet Supabase de staging

## Statut : NON EXÉCUTÉ (aucun projet de staging fourni/autorisé)

Aucun projet Supabase de staging distinct n'est disponible dans cet environnement, et la consigne
interdit toute action mutante sur la production. Cette phase requiert un **projet dédié** provisionné
par l'opérateur.

```text
staging_project_is_not_production = UNVERIFIED (aucun projet de staging fourni)
```

**Garde‑fou** : ne commencer cette phase **que si** la reconstruction locale est entièrement réussie
(elle l'est — voir LOCAL_REBUILD_RESULTS / SECURITY_REGRESSION_RESULTS).

## Procédure prévue (à exécuter par l'opérateur, hors production)
1. Provisionner un **nouveau projet Supabase de staging** (aucune donnée réelle).
2. **Vérifier deux fois** que le `project_ref` lié ≠ production `fk****cx (ref prod masqué)`.
   Afficher le ref **masqué** (ex. `fk****cx`) avant toute commande mutante.
3. Appliquer **uniquement** la baseline candidate au projet vide. **Ne copier aucune donnée de
   production.** Créer utilisateurs + données synthétiques.
4. Rejouer :
   - **comparaison de schéma** : `supabase db pull` (staging) → diff vs baseline → lever les
     UNKNOWN colonnes/index/RPC (voir SCHEMA_PARITY_REPORT) ;
   - **tests RLS** (anon/ordinaire/admin) ;
   - **ancienne escalade** (doit rester bloquée) ;
   - **tests frontend** (build temporaire vers staging) ;
   - **reconstruction depuis zéro** si le projet staging peut être réinitialisé sans risque.
5. `supabase db reset --linked` **uniquement** après double vérification que le lien pointe sur le
   **staging** (jamais la production).

## Sortie attendue
- `migration list` cohérent ; aucun rejeu accidentel ; schéma final = schéma attendu ;
  hotfix + gel présents ; RLS correcte ; frontend fonctionnel ; **aucune donnée de production**.
- Décision (hors ce lot) d'adopter la Stratégie B après réussite staging.
