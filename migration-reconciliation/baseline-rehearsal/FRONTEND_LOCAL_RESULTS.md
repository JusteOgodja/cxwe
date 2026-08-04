# FRONTEND_LOCAL_RESULTS — frontend contre la base locale

## Statut : NON EXÉCUTÉ (limite d'environnement) — à réaliser en staging

Le frontend Vite/React parle à Supabase via **PostgREST** (REST) et **GoTrue** (Auth), pas
directement à PostgreSQL. Or le **CLI Supabase est absent** de cet environnement (`supabase start`
indisponible) : impossible de lever localement PostgREST + GoTrue + Kong au‑dessus du Postgres
Docker. La base locale a donc validé le **modèle SQL/RLS** (voir SECURITY_REGRESSION_RESULTS), mais
pas le chemin applicatif HTTP.

### Ce qui a été validé sans frontend
- Schéma + RLS + `is_admin()` reconstruits et testés au niveau SQL (rôles `anon`/`authenticated`).
- Comportements attendus (lecture publique, blocage ordinaire, admin catalogue, gel `admin_emails`,
  ancienne escalade bloquée).

### Procédure à exécuter en staging (ou avec CLI locale)
1. `supabase start` (ou projet staging) pour disposer de PostgREST + GoTrue.
2. Appliquer la baseline candidate + seed synthétique.
3. Configurer un build frontend **temporaire** vers l'URL/clé **staging** (jamais les variables de
   production ; **ne committer aucun secret ni URL locale personnelle**).
4. Tester : accueil, catalogue, connexion, utilisateur ordinaire, administrateur synthétique,
   page Settings (sans champ Admin Emails), sauvegarde d'un paramètre ordinaire, protection des
   routes admin, déconnexion.
5. Vérifier l'absence d'erreurs console/réseau et le contrôle `is_admin()` côté serveur.

> Rappel : la validation frontend **complète en production** a déjà été réalisée précédemment
> (session admin réelle sur `morocco-foodexport.netlify.app`), ce qui couvre le comportement
> applicatif de l'état de sécurité final ; la présente étape ne le rejoue que contre une base
> reconstruite depuis la baseline.
