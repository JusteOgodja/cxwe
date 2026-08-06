# CLASSIFICATION_RULES

Détection multilingue (FR/EN + variantes sans accents) sur `name`, `description`,
`description_marketing` et la **marque** jointe. Implémentée aussi en code réutilisable :
`src/lib/productScope.ts` (prévention à l'import) + tests `tests/e2e/product-scope.spec.ts`.

## Statuts
`CORRECT · MISCLASSIFIED_HIGH_CONFIDENCE · MISCLASSIFIED_REVIEW ·
OUT_OF_SCOPE_BABY_CHILD_HIGH_CONFIDENCE · OUT_OF_SCOPE_BABY_CHILD_REVIEW ·
OUT_OF_SCOPE_OTHER · MISSING_INFORMATION`. Confiance `HIGH/MEDIUM/LOW` justifiée par des règles observables.

## Bébé/enfant — HIGH confidence (→ DEACTIVATE, réversible)
Déclenché si **(marque de puériculture pure)** OU **(accessoire/aliment bébé explicite dans le nom)**,
et **jamais** si « baby pop » (bonbon).
- Marques pures : `nuk, mam baby, nûby/nuby, suavinex, farlin, miniland, babybio, organix, dodie,
  avent, chicco, tommee (tippee), bébé confort, bambino, bébédor, notre bébé`.
- Noms : `couche-culotte, couches bébé, diaper/nappy, lingettes bébé, lait infantile,
  lait de croissance, lait 1er âge, infant formula, céréales infantiles, petit pot,
  biberon, feeding bottle, tétine, pacifier, stérilisateur, poussette, siège-auto,
  puériculture, grignoteur, nibber, tasse d'apprentissage, « dès X mois », « 12M+ »,
  sucette + tranche d'âge (0-6/6-18/6-36/Xmois/1er âge/anatomique/orthodon/physio)`.

## Bébé/enfant — REVIEW (→ MANUAL_REVIEW, jamais auto)
Indicateur **faible en description uniquement** (`nourrisson(s)`, `newborn`, `biberon`, `tétine`)
sans marque bébé ni accessoire dans le nom → souvent une **contre-indication** (« déconseillé aux
nourrissons ») ou une mention marketing sur un aliment ordinaire.

## Indicateurs FAIBLES à ne jamais utiliser seuls
`kids, junior, family, mini, cartoon, school, fun` — un aliment ordinaire n'est **pas** exclu parce
que son emballage a un dessin animé, un format enfant, « kids »/« junior » dans le nom, ou une marque
familiale. La marque seule ne suffit jamais (hors marque de puériculture pure).

## Règle « Hygiene & Paper Products »
Autorise hygiène générale / papier, mais **interdit** d'y classer couches, lingettes bébé,
cosmétiques nourrisson, biberons, tétines, sucettes, vaisselle enfant, jouets, vêtements, chaussures,
poussettes, sièges auto, mobilier bébé, fournitures scolaires, accessoires de puériculture
→ ces cas = `REJECT_OUT_OF_SCOPE`.

## Mauvaise catégorie (→ MANUAL_REVIEW dans ce lot)
Confusions surveillées : Olives↔Olive Oil, Argan/Vegetable/Essential Oils, Canned Sardines↔Frozen Fish,
Fruit Juices↔Soft Drinks, Tea↔Aromatic Herbs, Pasta↔Noodles↔Wheat Flour, Biscuits↔Confectionery↔
Chocolate, Chips↔Popcorn, Dairy↔Cheese↔Margarine, Fresh↔Frozen Red Fruits, Frozen Fish↔Frozen Ready
Meals. **Aucune reclassification automatique** : ancienne catégorie ≠ preuve ; nécessite description/source/image.

## Contrôle des faux positifs (échantillons vérifiés)
| Règle | tested_examples | confirmed_correct | false_positives | fp_rate_observed |
|---|---|---|---|---|
| marque puériculture pure | ~90 | ~90 | 0 | ~0 % |
| accessoire/aliment bébé dans le nom | ~45 | ~44 | 1 (« Poche Double Biberone » = poche à douille) | ~2 % |
| « 12M+ »/« dès X mois » | ~15 | 15 | 0 | 0 % |
| description-only (nourrisson/biberon) → REVIEW | 21 | routés en REVIEW | n/a (non auto) | — |
| bonbon « baby pop » (exclusion) | 6 | 6 conservés | 0 | 0 % |
Règles à FP élevé désactivées : `sucette` seule (bonbon), `baby` seul (baby corn/spinach),
`lait` seul, `couche` seul (couche = strate), `nourrisson`/`biberon`/`tétine` en description seule (→ REVIEW).

## SQL de détection (référence — pour régénérer les CSV locaux)
La requête de classification complète (identique au validateur) est archivée dans ce dépôt via
`proposed-sql/deactivate_out_of_scope_baby_child.sql` (clause `WHERE`). Pour exporter localement :
`\copy (SELECT id, ... , <regex CASE>) TO '.local-audit/product-cleanup/all_product_classifications.csv' CSV HEADER`.
