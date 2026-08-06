# AUDIT_SUMMARY — assainissement périmètre & catégories produits

_Recalculé depuis l'état courant de la base (aucun chiffre repris d'un audit antérieur).
Aucune donnée de production n'est versionnée ; listes complètes = `.local-audit/` (non suivi)._

## Volumétrie
| Mesure | Valeur |
|---|---|
| Produits totaux | **12 433** |
| Produits actifs | **4 578** |
| `category_id` NULL | 0 |
| Référence catégorie invalide | 0 |
| Catégories distinctes utilisées | 32 |

## Catégories
- **32 catégories canoniques attendues → 32 présentes, noms exacts.**
- Aucune manquante, aucun doublon, aucune variante orthographique, aucune catégorie hors périmètre.
- Note : « Essential Oils » a `is_active=false` (masquée au public) — présente, non supprimée.

## Hors périmètre — bébé / puériculture
| Statut | Total | Actifs |
|---|---|---|
| `OUT_OF_SCOPE_BABY_CHILD_HIGH_CONFIDENCE` | **131** | **114** |
| `OUT_OF_SCOPE_BABY_CHILD_REVIEW` (signal faible, description seule) | **21** | 17 |
| Bonbons « baby pop » (faux positifs écartés, conservés) | 6 | — |

Nature des 131 HIGH : sucettes/tétines (NUK, MAM, Nûby, Suavinex, Bébédor, Bambino, Pür, Bébé Confort),
lait infantile & lait de croissance (Babybio, Jaouda, Nido, Aptajunior, Nan…), aliments bébé
(Babybio petit pot, céréales infantiles, Organix « 12M+ »), accessoires repas bébé (grignoteur,
tasse d'apprentissage, cuillère, assiette), anneaux de dentition, stérilisateurs, jouets (Molto, Winfun).
Catégories les plus polluées : **Confectionery (61), Dairy UHT Milk (43), Fresh Fruits (11),
Biscuits (8), Tea/Infusions (8)**, plus Wheat Flour, Dates, Chips, Vegetable Oil.

## Mauvaise classification (intra-catalogue) — routée en MANUAL_REVIEW
Aucune reclassification automatique dans ce lot. Détail : `.local-audit/product-cleanup/misclassification_review.csv`.
| Bucket | Nombre | Exemples |
|---|---|---|
| CONFIRMED_MISCLASSIFIED | **12** | pâtes/fusilli dans « Wheat Flour/Semolina » → Pasta and Couscous |
| PROBABLY_MISCLASSIFIED | **5** | boisson gazeuse / San Pellegrino / Schweppes dans « Fruit Juices » → Soft Drinks |
| UNRESOLVED (décision humaine) | **10** | nectars « Pina Colada » (jus vs soft) ; tapenades d'olives (pâte, ni huile ni olives entières) |
| LEGITIMATE_CURRENT_CATEGORY | **~33** | produits « Olive Oil » nommés « olive » mais avec « huile/oil » (correct) |
| reclassifications appliquées en production | **0** |

## Synthèse des actions proposées
| Action | Nombre |
|---|---|
| DEACTIVATE (bébé/enfant HIGH, réversible) | **131** (114 actifs effectivement basculés) |
| MANUAL_REVIEW (bébé signal faible + misclassification) | **21 + ~56** |
| RECLASSIFY automatique | **0** (aucune dans ce lot) |
| DELETE physique | **0** (jamais proposé) |

## Conséquences d'une désactivation (vérifiées sur le schéma)
- `product_images`, `product_pricing_tiers`, `product_lots` : **conservés** (aucune suppression).
- Recherche (`search_products`) et pages publiques : filtrent `is_active` → produits retirés du public.
- Matviews `category_product_counts` / `brand_product_counts` : à **rafraîchir** après coup.
- Fiche produit d'un produit désactivé : non exposée au public (route protégée + is_active).

## Limites de la méthode
- Détection textuelle (nom/description/marque) ; pas d'analyse d'image.
- FP HIGH observé ≈ 1 % (ex. « Poche Double Biberone » = poche à douille pâtissière, déjà inactive).
- « Lait de croissance » (tout-petits) classé hors périmètre (nutrition infantile, ≠ lait UHT ordinaire) — choix documenté, révisable.
- Misclassification intra-catalogue non tranchée automatiquement (nécessite description/source/image).
