# PRODUCTION_RECONCILIATION_PLAN — options d'alignement (aucune non exécutée)

**Aucune entrée `schema_migrations` n'est modifiée. Aucune commande mutante n'est lancée.** Ce plan
est à exécuter **uniquement après** réussite locale **et** staging, sur décision explicite.

Objectifs : archiver les 15 migrations historiques (avec hashes + doc) · ajouter une baseline
canonique · **aligner l'historique distant sans exécuter la baseline sur le schéma déjà existant** ·
garantir que les futures migrations s'appliquent normalement · permettre la reconstruction d'une
base vide · **éviter tout rejeu du hotfix ou du gel**.

## Option 1 — Baseline marquée « déjà appliquée » (RECOMMANDÉE)
Placer la baseline canonique comme **premier** fichier de migration, et la **marquer appliquée** sur
la production **sans l'exécuter** (le schéma existe déjà).

- **Commandes envisagées** (staging d'abord, puis prod, après double vérif du lien) :
  - `supabase migration repair --status applied <version_baseline>` (marque la baseline appliquée
    sans l'exécuter) ;
  - conserver les 15 fichiers historiques **hors** du dossier actif (archive), OU les marquer
    `reverted`/`applied` selon leur classe (voir Option 2).
- **Objets modifiés** : uniquement `supabase_migrations.schema_migrations` (métadonnées), **pas** le
  schéma applicatif.
- **Risques** : si la baseline diverge du schéma réel, la marque « applied » masque l'écart →
  **exige la parité prouvée en staging** au préalable.
- **Rollback** : re‑marquer la version `reverted` (métadonnée) ; aucun impact données.
- **Preuve nécessaire** : SCHEMA_PARITY (staging) = baseline ≡ production.
- **Effet `migration list`** : une baseline `applied`, historique legacy archivé.
- **Effet `db push`** : ne rejoue rien (baseline déjà applied) ; les futures migrations s'appliquent
  normalement au‑dessus.
- **Effet base vide** : `db push`/`reset` applique la baseline → schéma complet reconstruit.

## Option 2 — `migration repair` de l'historique existant
Marquer `applied` les **5** versions distantes SEMANTIC_MATCH et statuer les autres.

- **Commandes** : `supabase migration repair --status applied 20260727223938 20260729093955
  20260731223810 20260731232809 20260801000011` (+ décision sur `20260716145227`
  `enrich_products_columns` et les 9 fondations).
- **Objets modifiés** : `schema_migrations` seulement.
- **Risques** : **8 UNKNOWN** non réparables de façon prouvée ; fichiers locaux **non rejouables**
  (policy IF NOT EXISTS, noms non standard) → base vide **non reconstructible** sans corriger les
  fichiers ; n'intègre pas proprement hotfix/gel.
- **Rollback** : re‑marquage métadonnée.
- **Preuve nécessaire** : parité par version (staging).
- **Effet `db push`** : risque de rejouer des fondations non enregistrées → **danger** sans baseline.
- **Effet base vide** : **non garanti**.

## Option 3 — Fichiers placeholders alignés sur les 6 versions distantes
Créer 6 fichiers `\<version_distante\>_\<nom\>.sql` **vides/no‑op** pour matérialiser l'historique
distant côté local, puis baseline au‑dessus.

- **Risques** : placeholders vides ≠ contenu réel → toute base vide reconstruite serait **incomplète**
  si on comptait sur eux ; utile seulement combiné à une baseline canonique (Option 1).
- **Effet base vide** : incomplet **sans** baseline ; correct **avec** baseline.

## Option 4 — Historique legacy séparé + baseline neuve (variante d'Option 1)
Déplacer les 15 fichiers vers `migration-reconciliation/legacy-migrations/` (archive, hashes
conservés), n'garder dans `supabase/migrations/` que la **baseline canonique** + migrations futures.

- **Avantages** : dossier actif propre et reconstructible ; audit préservé.
- **Effet `db push`/base vide** : baseline seule → reconstruction fiable.

## Recommandation
**Option 1 (baseline `applied`) + Option 4 (archive legacy)** — après **parité prouvée en staging**.
Ne jamais rejouer hotfix/gel (leur état est **inclus dans la baseline**, pas exécuté séparément).
Aucune de ces options n'est appliquée à ce stade.

## Garde‑fous transverses
- Toujours **staging d'abord**, double vérification du `project_ref` lié (masqué) avant toute
  commande, jamais `db reset --linked` sur la production.
- Conserver `supabase/migrations/README.md` (avertissement de divergence) jusqu'à réconciliation
  effective.
