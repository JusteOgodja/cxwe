# Audit de performance — Morocco Food Export

Audit **en lecture seule** de la production (aucun fichier applicatif, schéma, migration,
RLS, variable d'environnement ou config Netlify modifié).

- **Prod** : https://morocco-foodexport.netlify.app
- **Stack** : Vite 5.4 + React 18.3 + TypeScript 5.5 + react-router 6.30 + supabase-js 2.57
- **Hébergement** : Netlify (CDN + Brotli) · Supabase (Postgres, région `eu-west-1` / Irlande)
- **Date** : 2026-08-01
- **Node** : v22.17 · **npm** : 10.9

## Fichiers

| Fichier | Contenu |
|---|---|
| `PERFORMANCE_REPORT.md` | Rapport complet (méthode, mesures, analyse, classement) |
| `BASELINE.md` | Tableau de référence avant optimisation |
| `ACTION_PLAN.md` | Plan d'action (corrections rapides / structurantes / à surveiller) |

## Outils utilisés

- `curl` — timing réseau et en-têtes HTTP (reproductible).
- Navigateur intégré + **Performance API** (Resource/Navigation Timing) — requêtes réelles,
  poids transféré, timings de chargement en production.
- Requêtes SQL **lecture seule** sur Supabase (`pg_indexes`, `pg_get_functiondef`) — aucune
  écriture, aucun `EXPLAIN ANALYZE` sur requête lourde en production.

## Limites de mesure (à connaître)

- **Lighthouse non installé** dans l'environnement → non exécuté (règle : ne pas ajouter de
  dépendance pendant l'audit). Scores Lighthouse **non fournis**.
- **Playwright non installé** → parcours automatisés non exécutés.
- Le navigateur intégré **n'expose pas** les entrées `paint` / `largest-contentful-paint` →
  **FCP / LCP / CLS / INP formels non mesurés**. Les valeurs de substitution utilisées
  (DOMContentLoaded, load, poids, nombre de requêtes) sont indiquées comme telles.
- Les mesures `curl` sont prises depuis la machine d'audit (latence TLS ~0,5 s observée →
  distance réseau non négligeable). La latence absolue n'est donc pas celle d'un utilisateur
  marocain ; les **ratios et volumes** restent valides.

## Reproduire les mesures

```bash
# Timing HTML (5 passes)
for i in 1 2 3 4 5; do curl -sS -o /dev/null -w "TTFB:%{time_starttransfer}s Total:%{time_total}s HTTP:%{http_code}\n" https://morocco-foodexport.netlify.app/; done

# En-têtes cache/compression
curl -sS -D - -o /dev/null -H "Accept-Encoding: br,gzip" https://morocco-foodexport.netlify.app/

# Poids réel du bundle JS (Brotli)
JS=$(curl -sS https://morocco-foodexport.netlify.app/ | grep -oE '/assets/[^"]+\.js' | head -1)
curl -sS -o /dev/null -H "Accept-Encoding: br" -w "transféré:%{size_download}o\n" "https://morocco-foodexport.netlify.app$JS"

# Build local + inspection des chunks
npm ci && npm run build && ls -la dist/assets
```

Dans le navigateur (console) sur la prod, pour compter les requêtes Supabase de l'accueil :

```js
performance.getEntriesByType('resource').filter(r => r.name.includes('supabase')).length
```
