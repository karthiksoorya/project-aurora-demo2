/**
 * Rule-set registry for Validation Studio.
 *
 * Only `aurora-formula-checks` is *evaluated*: deterministic numeric / integrity checks on a saved snapshot.
 * Regulatory rule sets are listed so they can be selected and recorded, but no verified dataset is configured,
 * so every finding they would produce is `not_assessed` with the missing inputs spelled out. Aurora never
 * infers IFRA or allergen compliance (spec §0, §7).
 */
export interface RuleSetDef {
  id: string;
  title: string;
  edition: string;
  kind: 'formula' | 'regulatory' | 'allergen';
  datasetConfigured: boolean;
  description: string;
  missingInputs: string[];
}

export const RULE_SETS: RuleSetDef[] = [
  {
    id: 'aurora-formula-checks',
    title: 'Aurora formula checks',
    edition: '1.0 (2026-10)',
    kind: 'formula',
    datasetConfigured: true,
    description:
      'Deterministic checks on the saved snapshot: completeness, quantities, duplicates, catalog references, integrity.',
    missingInputs: [],
  },
  {
    id: 'ifra-standards',
    title: 'IFRA Standards',
    edition: '51st Amendment (dataset not configured)',
    kind: 'regulatory',
    datasetConfigured: false,
    description: 'Ingredient restrictions and maximum use levels per product category.',
    missingInputs: [
      'Licensed IFRA Standards dataset for the selected amendment',
      'Mapping of catalog ingredients / constituents to IFRA standards',
      'Finished-product concentration of the fragrance in the selected category',
    ],
  },
  {
    id: 'eu-cosmetics-allergens',
    title: 'EU Cosmetics Regulation — fragrance allergen labelling',
    edition: 'Reg. (EC) 1223/2009 Annex III (dataset not configured)',
    kind: 'allergen',
    datasetConfigured: false,
    description: 'Declarable fragrance allergens above labelling thresholds in the finished product.',
    missingInputs: [
      'Verified allergen list and thresholds for the selected edition',
      'Batch constituent composition of each natural material (supplier certificate of analysis)',
      'Leave-on / rinse-off classification and dosage in the finished product',
    ],
  },
];

export const MARKETS = ['Global', 'EU', 'UK', 'US', 'India', 'China'];
export const PRODUCT_CATEGORIES = [
  'Fine fragrance (hydroalcoholic)',
  'Body lotion (leave-on)',
  'Shower gel (rinse-off)',
  'Candle / home fragrance',
];

export const VALIDATION_ENGINE_VERSION = 'aurora-validation-engine 1.0.0';
