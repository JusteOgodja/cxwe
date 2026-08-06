import { test, expect } from '@playwright/test';
import { classifyProductScope, dryRunScope } from '../../src/lib/productScope';

test('import gate: only ACCEPT rows would be written (mixed batch)', () => {
  const batch = [
    { name: 'Huile d\'Olive Extra Vierge 1L', category: 'Olive Oil' },          // accept
    { name: 'Biscuits Chocolat Prince (kids)', category: 'Biscuits' },          // accept (kid marketing)
    { name: 'NUK Sucette Sensitive 0-6m', category: 'Confectionery' },          // reject (baby)
    { name: 'Babybio Petit Pot Pomme (Dès 4mois)', category: 'Fresh Fruits' },  // reject (baby food)
    { name: 'Couche-culotte Taille 3', category: 'Hygiene & Paper Products' },  // reject (baby in hygiene)
    { name: 'Chaise haute bébé', category: 'Baby Furniture' },                  // reject (unauthorized cat)
    { name: 'Shot Ginseng', description: 'déconseillé aux nourrissons', category: 'Tea/Infusions' }, // review
  ];
  const { summary, rejected, review } = dryRunScope(batch);
  expect(summary.ACCEPT).toBe(2);
  expect(summary.REJECT_OUT_OF_SCOPE).toBe(4);
  expect(summary.REVIEW_REQUIRED).toBe(1);
  // Ce qui serait écrit = uniquement les ACCEPT.
  const written = batch.filter((r) => classifyProductScope(r).decision === 'ACCEPT');
  expect(written.map((r) => r.name)).toEqual([
    "Huile d'Olive Extra Vierge 1L",
    'Biscuits Chocolat Prince (kids)',
  ]);
  expect(rejected.length).toBe(4);
  expect(review.length).toBe(1);
});

// Unit tests for the catalogue-scope validator (no browser needed).

test.describe('out-of-scope baby/child products must be rejected', () => {
  const reject = [
    { name: 'Pampers Couche-Culotte Taille 3', brand: 'Pampers' },
    { name: 'Lingettes bébé sensitives x64', brand: 'Mixa' },
    { name: 'Babybio Lait Infantile Primea 1 800G', brand: 'Babybio', category: 'Dairy (UHT Milk)' },
    { name: 'Babybio Petit Pot Pomme Fraise (Dès 4mois)', brand: 'Babybio', category: 'Fresh Fruits' },
    { name: 'MAM Baby Sucette Perfect 0-6mois', brand: 'MAM Baby', category: 'Confectionery' },
    { name: 'NUK Biberon First Choice 150ml', brand: 'NUK' },
    { name: 'Suavinex Stérilisateur UV pour Sucette', brand: 'Suavinex', category: 'Confectionery' },
    { name: 'Molto Chariot de Plage 12M+', category: 'Biscuits' },
    { name: 'Organix Alphabet Biscuits 12M+', category: 'Wheat Flour/Semolina' },
    { name: 'Lait de Croissance Jaouda 500ml', category: 'Dairy (UHT Milk)' },
  ];
  for (const p of reject) {
    test(`reject: ${p.name}`, () => {
      expect(classifyProductScope(p).decision).toBe('REJECT_OUT_OF_SCOPE');
    });
  }
});

test.describe('ordinary foods must be KEPT even with kid-ish marketing', () => {
  const keep = [
    { name: 'Prince Biscuit Chocolat (avec dessin animé)', brand: 'LU', category: 'Biscuits' },
    { name: 'Capri-Sun format enfant 200ml', brand: 'Capri-Sun', category: 'Fruit Juices' },
    { name: 'Kinder Chocolate Kids', brand: 'Kinder', category: 'Chocolate' },
    { name: 'Family Pack Chips Nature', brand: 'Lays', category: 'Chips/Salted Snacks' },
    { name: 'Mini Oreo format pocket', brand: 'Oreo', category: 'Biscuits' },
    { name: 'Bazooka Big Baby Pop Fraise 32g', brand: 'Bazooka', category: 'Confectionery' }, // bonbon
  ];
  for (const p of keep) {
    test(`keep: ${p.name}`, () => {
      expect(classifyProductScope(p).decision).toBe('ACCEPT');
    });
  }
});

test.describe('ambiguous / weak signals must go to REVIEW, not auto-reject', () => {
  const review = [
    { name: 'Shot Ginseng Gingembre Miel 30ml', description: 'Déconseillé aux nourrissons.', category: 'Tea/Infusions' },
    { name: 'Alce Nero Purée Poire 100g', description: 'peut convenir au biberon', brand: 'Alce Nero', category: 'Fresh Fruits' },
  ];
  for (const p of review) {
    test(`review: ${p.name}`, () => {
      expect(classifyProductScope(p).decision).toBe('REVIEW_REQUIRED');
    });
  }
});

test('unauthorized category is rejected', () => {
  expect(classifyProductScope({ name: 'Chaise haute', category: 'Baby Furniture' }).decision).toBe('REJECT_OUT_OF_SCOPE');
});

test('Hygiene category cannot be used for a baby item', () => {
  expect(classifyProductScope({ name: 'Couche-culotte taille 2', category: 'Hygiene & Paper Products' }).decision).toBe('REJECT_OUT_OF_SCOPE');
});

test('generic hygiene product stays ACCEPT', () => {
  expect(classifyProductScope({ name: 'Papier toilette 12 rouleaux', category: 'Hygiene & Paper Products' }).decision).toBe('ACCEPT');
});
