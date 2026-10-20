import { stableUuid } from '../common/ids';
import type { Constituent, Family, Ingredient, IngredientKind, NoteRole, SourcedProperty } from '../domain/types';
import structuresJson from './structures.json';
import type { StructureFixture } from '../domain/types';

/**
 * Demo ingredient catalog.
 *
 * Honesty rules applied here (see IMPLEMENTATION_SPEC §0, §6, §7):
 *  - Every property records a source and a verification status.
 *  - Identifiers (CAS) are curator-entered and marked `unverified` — they have NOT been checked
 *    against an authoritative registry in this offline build.
 *  - Molecular formula / MW for single compounds are `computed` from the curated SMILES (RDKit),
 *    see tools/build_structures.py. Natural mixtures never get a single formula or structure.
 *  - IFRA status, allergen declarations, sustainability, typical usage and performance are
 *    `missing` => the UI shows "Not assessed" / "Data unavailable".
 *  - Descriptors / emphasis levels are qualitative curator tags for the demo, not measurements.
 */

export const CATALOG_VERSION = 'demo-catalog-2026.10';
export const STRUCTURES = structuresJson as StructureFixture[];

const DEMO_SOURCE = { name: 'Aurora demo fixture (curator-entered, not registry-verified)' };
const COMPUTED_SOURCE = (cid: string) => ({
  name: 'Computed from curated SMILES (RDKit)',
  reference: `structures.json#${cid}`,
});
const NONE = { name: 'No source configured' };

interface Spec {
  slug: string;
  name: string;
  kind: IngredientKind;
  systematicName: string;
  family: Family;
  secondary?: Family[];
  role: NoteRole;
  descriptors: string[];
  emphasis: [string, 1 | 2 | 3][];
  description: string;
  motif: string;
  hue: number;
  cas?: string;
  compoundId?: string;
  constituents?: Constituent[];
  appearance?: string;
}

function properties(s: Spec): SourcedProperty[] {
  const props: SourcedProperty[] = [];
  props.push({
    key: 'cas',
    label: s.kind === 'natural_mixture' ? 'CAS (mixture)' : 'CAS Number',
    value: s.cas ?? null,
    status: s.cas ? 'unverified' : 'missing',
    source: s.cas ? DEMO_SOURCE : NONE,
    note: s.cas ? 'Curator-entered identifier; registry check pending.' : undefined,
  });
  const st = s.compoundId ? STRUCTURES.find((x) => x.compoundId === s.compoundId) : undefined;
  if (s.kind === 'single_compound') {
    props.push({
      key: 'formula',
      label: 'Molecular Formula',
      value: st?.computedFormula ?? null,
      status: st ? 'computed' : 'missing',
      source: st ? COMPUTED_SOURCE(st.compoundId) : NONE,
      note: st ? undefined : 'No curated structure fixture for this compound yet.',
    });
    props.push({
      key: 'mw',
      label: 'Molecular Weight',
      value: st ? `${st.computedMolecularWeight.toFixed(2)} g/mol` : null,
      status: st ? 'computed' : 'missing',
      source: st ? COMPUTED_SOURCE(st.compoundId) : NONE,
    });
  } else {
    props.push({
      key: 'formula',
      label: 'Molecular Formula',
      value: null,
      status: 'missing',
      source: NONE,
      note: 'Natural mixture — no single molecular formula. See constituents.',
    });
  }
  props.push({
    key: 'appearance',
    label: 'Appearance',
    value: s.appearance ?? null,
    status: s.appearance ? 'unverified' : 'missing',
    source: s.appearance ? DEMO_SOURCE : NONE,
  });
  props.push({
    key: 'batchComposition',
    label: 'Batch composition',
    value: null,
    status: 'missing',
    source: NONE,
    note:
      s.kind === 'natural_mixture'
        ? 'Composition varies by origin and batch; requires supplier certificate of analysis.'
        : 'Purity / isomer ratio not provided.',
  });
  props.push({ key: 'typicalUsage', label: 'Typical usage', value: null, status: 'missing', source: NONE });
  props.push({
    key: 'ifra',
    label: 'IFRA status',
    value: null,
    status: 'missing',
    source: NONE,
    note: 'No IFRA standard edition/category configured.',
  });
  props.push({ key: 'allergens', label: 'Allergen declaration', value: null, status: 'missing', source: NONE });
  props.push({ key: 'sustainability', label: 'Sustainability', value: null, status: 'missing', source: NONE });
  props.push({ key: 'supplier', label: 'Supplier', value: null, status: 'missing', source: NONE });
  return props;
}

const C = (name: string, compoundId?: string): Constituent => ({ name, compoundId });

const SPECS: Spec[] = [
  // ---------- Citrus ----------
  {
    slug: 'bergamot-eo',
    name: 'Bergamot EO',
    kind: 'natural_mixture',
    systematicName: 'Citrus bergamia peel oil',
    family: 'citrus',
    secondary: ['aromatic'],
    role: 'top',
    descriptors: ['Citrus', 'Fresh', 'Sparkling'],
    emphasis: [
      ['Citrus', 3],
      ['Fresh', 3],
      ['Floral', 1],
      ['Green', 1],
    ],
    description: 'Cold-pressed citrus peel oil with a bright, sparkling, slightly floral-tea character.',
    motif: 'citrus-slice',
    hue: 72,
    cas: '8007-75-8',
    appearance: 'Pale yellow to greenish liquid',
    constituents: [
      C('Limonene', 'cmp-limonene'),
      C('Linalyl acetate', 'cmp-linalyl-acetate'),
      C('Linalool', 'cmp-linalool'),
      C('γ-Terpinene'),
      C('β-Pinene'),
      C('Bergapten (furocoumarin)'),
    ],
  },
  {
    slug: 'lemon-eo',
    name: 'Lemon EO',
    kind: 'natural_mixture',
    systematicName: 'Citrus limon peel oil',
    family: 'citrus',
    role: 'top',
    descriptors: ['Citrus', 'Zesty', 'Fresh'],
    emphasis: [
      ['Citrus', 3],
      ['Fresh', 2],
      ['Green', 1],
    ],
    description: 'Sharp, zesty lemon peel character.',
    motif: 'citrus-slice',
    hue: 55,
    cas: '8008-56-8',
    appearance: 'Pale yellow liquid',
    constituents: [C('Limonene', 'cmp-limonene'), C('γ-Terpinene'), C('β-Pinene'), C('Citral (neral / geranial)')],
  },
  {
    slug: 'mandarin-eo',
    name: 'Mandarin EO',
    kind: 'natural_mixture',
    systematicName: 'Citrus reticulata peel oil',
    family: 'citrus',
    secondary: ['fruity'],
    role: 'top',
    descriptors: ['Citrus', 'Sweet', 'Fruity'],
    emphasis: [
      ['Citrus', 3],
      ['Fruity', 2],
      ['Sweet', 1],
    ],
    description: 'Juicy, sweet citrus with a soft orange-peel tone.',
    motif: 'citrus-slice',
    hue: 32,
    cas: '8008-31-9',
    constituents: [C('Limonene', 'cmp-limonene'), C('γ-Terpinene'), C('Methyl N-methylanthranilate')],
  },
  {
    slug: 'grapefruit-eo',
    name: 'Grapefruit EO',
    kind: 'natural_mixture',
    systematicName: 'Citrus paradisi peel oil',
    family: 'citrus',
    role: 'top',
    descriptors: ['Citrus', 'Bitter', 'Fresh'],
    emphasis: [
      ['Citrus', 3],
      ['Fresh', 2],
      ['Fruity', 1],
    ],
    description: 'Bitter-fresh citrus with a sulfurous-juicy nuance.',
    motif: 'citrus-slice',
    hue: 8,
    cas: '8016-20-4',
    constituents: [C('Limonene', 'cmp-limonene'), C('Myrcene'), C('Nootkatone')],
  },
  {
    slug: 'limonene',
    name: 'Limonene',
    kind: 'single_compound',
    systematicName: '(R)-(+)-4-Isopropenyl-1-methylcyclohexene',
    family: 'citrus',
    role: 'top',
    descriptors: ['Citrus', 'Orange-like', 'Fresh'],
    emphasis: [
      ['Citrus', 3],
      ['Fresh', 2],
    ],
    description: 'Monoterpene hydrocarbon; a major constituent of many citrus peel oils.',
    motif: 'citrus-slice',
    hue: 60,
    cas: '5989-27-5',
    compoundId: 'cmp-limonene',
    appearance: 'Colourless liquid',
  },
  // ---------- Floral ----------
  {
    slug: 'linalool',
    name: 'Linalool',
    kind: 'single_compound',
    systematicName: '3,7-Dimethylocta-1,6-dien-3-ol',
    family: 'floral',
    secondary: ['aromatic'],
    role: 'top',
    descriptors: ['Floral', 'Soft', 'Fresh'],
    emphasis: [
      ['Floral', 3],
      ['Fresh', 2],
      ['Citrus', 1],
    ],
    description: 'Terpene alcohol with a soft, fresh floral-woody character.',
    motif: 'white-flower',
    hue: 330,
    cas: '78-70-6',
    compoundId: 'cmp-linalool',
    appearance: 'Colourless liquid',
  },
  {
    slug: 'hedione',
    name: 'Hedione',
    kind: 'single_compound',
    systematicName: 'Methyl dihydrojasmonate',
    family: 'floral',
    secondary: ['citrus'],
    role: 'heart',
    descriptors: ['Floral', 'Jasminic', 'Radiant'],
    emphasis: [
      ['Floral', 3],
      ['Fresh', 2],
      ['Citrus', 1],
    ],
    description: 'Transparent, radiant jasmine-like floral material.',
    motif: 'white-flower',
    hue: 45,
    cas: '24851-98-7',
    compoundId: 'cmp-hedione',
  },
  {
    slug: 'jasmine-absolute',
    name: 'Jasmine Absolute',
    kind: 'natural_mixture',
    systematicName: 'Jasminum grandiflorum flower extract',
    family: 'floral',
    secondary: ['fruity'],
    role: 'heart',
    descriptors: ['Floral', 'Rich', 'Indolic'],
    emphasis: [
      ['Floral', 3],
      ['Sweet', 2],
      ['Animalic', 1],
    ],
    description: 'Rich, narcotic white-floral absolute.',
    motif: 'white-flower',
    hue: 50,
    cas: '8022-96-6',
    constituents: [
      C('Benzyl acetate'),
      C('Benzyl benzoate'),
      C('Linalool', 'cmp-linalool'),
      C('Indole'),
      C('cis-Jasmone'),
    ],
  },
  {
    slug: 'neroli-eo',
    name: 'Neroli EO',
    kind: 'natural_mixture',
    systematicName: 'Citrus aurantium amara flower oil',
    family: 'floral',
    secondary: ['citrus'],
    role: 'top',
    descriptors: ['Floral', 'Citrus', 'Green'],
    emphasis: [
      ['Floral', 3],
      ['Citrus', 2],
      ['Green', 1],
    ],
    description: 'Bright orange-blossom oil with green-citrus facets.',
    motif: 'white-flower',
    hue: 20,
    cas: '8016-38-4',
    constituents: [
      C('Linalool', 'cmp-linalool'),
      C('Limonene', 'cmp-limonene'),
      C('β-Pinene'),
      C('Linalyl acetate', 'cmp-linalyl-acetate'),
      C('Nerolidol'),
    ],
  },
  // ---------- Aromatic ----------
  {
    slug: 'lavender-eo',
    name: 'Lavender EO',
    kind: 'natural_mixture',
    systematicName: 'Lavandula angustifolia flower oil',
    family: 'aromatic',
    secondary: ['floral'],
    role: 'heart',
    descriptors: ['Aromatic', 'Herbal', 'Floral'],
    emphasis: [
      ['Aromatic', 3],
      ['Floral', 2],
      ['Fresh', 2],
    ],
    description: 'Herbaceous, clean aromatic-floral oil.',
    motif: 'lavender',
    hue: 270,
    cas: '8000-28-0',
    constituents: [
      C('Linalyl acetate', 'cmp-linalyl-acetate'),
      C('Linalool', 'cmp-linalool'),
      C('Terpinen-4-ol'),
      C('β-Ocimene'),
    ],
  },
  {
    slug: 'petitgrain-eo',
    name: 'Petitgrain EO',
    kind: 'natural_mixture',
    systematicName: 'Citrus aurantium amara leaf/twig oil',
    family: 'aromatic',
    secondary: ['green', 'citrus'],
    role: 'top',
    descriptors: ['Green', 'Fresh', 'Woody'],
    emphasis: [
      ['Green', 3],
      ['Fresh', 2],
      ['Woody', 1],
    ],
    description: 'Green, slightly woody leaf oil of the bitter orange tree.',
    motif: 'leaves',
    hue: 100,
    cas: '8014-17-3',
    constituents: [C('Linalyl acetate', 'cmp-linalyl-acetate'), C('Linalool', 'cmp-linalool'), C('α-Terpineol')],
  },
  {
    slug: 'linalyl-acetate',
    name: 'Linalyl Acetate',
    kind: 'single_compound',
    systematicName: '3,7-Dimethylocta-1,6-dien-3-yl acetate',
    family: 'aromatic',
    secondary: ['citrus', 'floral'],
    role: 'top',
    descriptors: ['Fresh', 'Fruity', 'Bergamot-like'],
    emphasis: [
      ['Fresh', 3],
      ['Floral', 2],
      ['Fruity', 1],
    ],
    description: 'Ester with a fresh, bergamot- and lavender-like fruity-floral tone.',
    motif: 'lavender',
    hue: 250,
    cas: '115-95-7',
    compoundId: 'cmp-linalyl-acetate',
  },
  // ---------- Woody ----------
  {
    slug: 'iso-e-super',
    name: 'Iso E Super',
    kind: 'single_compound',
    systematicName: 'Tetramethyl acetyloctahydronaphthalenes (OTNE)',
    family: 'woody',
    secondary: ['amber'],
    role: 'heart',
    descriptors: ['Woody', 'Amber', 'Velvety'],
    emphasis: [
      ['Woody', 3],
      ['Amber', 2],
      ['Musky', 1],
    ],
    description: 'Smooth, velvety cedar-like woody-amber material (commercial isomer mixture).',
    motif: 'wood',
    hue: 25,
    cas: '54464-57-2',
  },
  {
    slug: 'cedarwood-eo',
    name: 'Cedarwood EO',
    kind: 'natural_mixture',
    systematicName: 'Juniperus virginiana wood oil',
    family: 'woody',
    role: 'base',
    descriptors: ['Woody', 'Dry', 'Pencil'],
    emphasis: [
      ['Woody', 3],
      ['Dry', 2],
    ],
    description: 'Dry, pencil-shaving woody oil.',
    motif: 'wood',
    hue: 18,
    cas: '8000-27-9',
    constituents: [C('α-Cedrene'), C('Thujopsene'), C('Cedrol')],
  },
  {
    slug: 'sandalwood-eo',
    name: 'Sandalwood EO',
    kind: 'natural_mixture',
    systematicName: 'Santalum album wood oil',
    family: 'woody',
    secondary: ['musky'],
    role: 'base',
    descriptors: ['Woody', 'Creamy', 'Warm'],
    emphasis: [
      ['Woody', 3],
      ['Creamy', 2],
      ['Warm', 2],
    ],
    description: 'Creamy, soft and milky woody oil.',
    motif: 'wood',
    hue: 30,
    cas: '8006-87-9',
    constituents: [C('α-Santalol'), C('β-Santalol')],
  },
  {
    slug: 'cashmeran',
    name: 'Cashmeran',
    kind: 'single_compound',
    systematicName: '1,1,2,3,3-Pentamethyl-1,2,3,5,6,7-hexahydro-4H-inden-4-one',
    family: 'woody',
    secondary: ['musky'],
    role: 'base',
    descriptors: ['Woody', 'Musky', 'Soft'],
    emphasis: [
      ['Woody', 3],
      ['Musky', 2],
      ['Spicy', 1],
    ],
    description: 'Soft, diffusive musky-woody material.',
    motif: 'wood',
    hue: 35,
    cas: '33704-61-9',
  },
  // ---------- Marine ----------
  {
    slug: 'calone',
    name: 'Calone',
    kind: 'single_compound',
    systematicName: '7-Methyl-2H-1,5-benzodioxepin-3(4H)-one',
    family: 'marine',
    secondary: ['fruity'],
    role: 'top',
    descriptors: ['Marine', 'Ozonic', 'Watery'],
    emphasis: [
      ['Marine', 3],
      ['Fresh', 2],
      ['Fruity', 1],
    ],
    description: 'Watery, ozonic marine material associated with sea-breeze accords.',
    motif: 'wave',
    hue: 200,
    cas: '28940-11-6',
    compoundId: 'cmp-calone',
  },
  // ---------- Amber ----------
  {
    slug: 'ambroxan',
    name: 'Ambroxan',
    kind: 'single_compound',
    systematicName: 'Ambroxide (dodecahydro-tetramethylnaphthofuran)',
    family: 'amber',
    secondary: ['marine', 'woody'],
    role: 'base',
    descriptors: ['Amber', 'Mineral', 'Woody'],
    emphasis: [
      ['Amber', 3],
      ['Woody', 2],
      ['Marine', 1],
    ],
    description: 'Dry, mineral ambery-woody material.',
    motif: 'wave',
    hue: 190,
    cas: '6790-58-5',
  },
  // ---------- Sweet ----------
  {
    slug: 'vanillin',
    name: 'Vanillin',
    kind: 'single_compound',
    systematicName: '4-Hydroxy-3-methoxybenzaldehyde',
    family: 'sweet',
    secondary: ['balsamic'],
    role: 'base',
    descriptors: ['Sweet', 'Gourmand', 'Creamy'],
    emphasis: [
      ['Sweet', 3],
      ['Gourmand', 3],
      ['Balsamic', 1],
    ],
    description: 'Sweet, creamy vanilla-like aromatic aldehyde.',
    motif: 'amber-gem',
    hue: 28,
    cas: '121-33-5',
    compoundId: 'cmp-vanillin',
    appearance: 'White to pale yellow crystalline solid',
  },
  // ---------- Green ----------
  {
    slug: 'cis-3-hexenol',
    name: 'cis-3-Hexenol',
    kind: 'single_compound',
    systematicName: '(Z)-Hex-3-en-1-ol',
    family: 'green',
    role: 'top',
    descriptors: ['Green', 'Cut grass', 'Leafy'],
    emphasis: [
      ['Green', 3],
      ['Fresh', 2],
    ],
    description: 'Intense cut-grass green note ("leaf alcohol").',
    motif: 'leaves',
    hue: 120,
    cas: '928-96-1',
    compoundId: 'cmp-cis-3-hexenol',
  },
  {
    slug: 'galbanum-eo',
    name: 'Galbanum EO',
    kind: 'natural_mixture',
    systematicName: 'Ferula galbaniflua resin oil',
    family: 'green',
    secondary: ['balsamic'],
    role: 'top',
    descriptors: ['Green', 'Sharp', 'Resinous'],
    emphasis: [
      ['Green', 3],
      ['Balsamic', 1],
    ],
    description: 'Sharp, bitter green oil with a resinous undertone.',
    motif: 'leaves',
    hue: 90,
    cas: '8023-91-4',
    constituents: [C('β-Pinene'), C('α-Pinene'), C('Undecatrienes')],
  },
  // ---------- Spicy ----------
  {
    slug: 'black-pepper-eo',
    name: 'Black Pepper EO',
    kind: 'natural_mixture',
    systematicName: 'Piper nigrum fruit oil',
    family: 'spicy',
    secondary: ['woody'],
    role: 'top',
    descriptors: ['Spicy', 'Dry', 'Fresh'],
    emphasis: [
      ['Spicy', 3],
      ['Woody', 1],
      ['Fresh', 1],
    ],
    description: 'Dry, fresh peppery spice.',
    motif: 'pepper',
    hue: 0,
    cas: '8006-82-4',
    constituents: [C('β-Caryophyllene'), C('Limonene', 'cmp-limonene'), C('Sabinene'), C('α-Pinene')],
  },
  // ---------- Musky ----------
  {
    slug: 'galaxolide',
    name: 'Galaxolide',
    kind: 'single_compound',
    systematicName: 'Hexahydro-hexamethylcyclopentabenzopyran (HHCB)',
    family: 'musky',
    secondary: ['floral'],
    role: 'base',
    descriptors: ['Musky', 'Clean', 'Soft'],
    emphasis: [
      ['Musky', 3],
      ['Floral', 1],
      ['Sweet', 1],
    ],
    description: 'Clean, soft polycyclic musk (commercial isomer mixture).',
    motif: 'musk',
    hue: 260,
    cas: '1222-05-5',
  },
  // ---------- Fruity ----------
  {
    slug: 'gamma-decalactone',
    name: 'γ-Decalactone',
    kind: 'single_compound',
    systematicName: '5-Hexyloxolan-2-one',
    family: 'fruity',
    secondary: ['sweet'],
    role: 'heart',
    descriptors: ['Fruity', 'Peach', 'Creamy'],
    emphasis: [
      ['Fruity', 3],
      ['Creamy', 2],
      ['Sweet', 1],
    ],
    description: 'Creamy, peach-like lactone.',
    motif: 'peach',
    hue: 15,
    cas: '706-14-9',
    compoundId: 'cmp-gamma-decalactone',
  },
  // ---------- Balsamic ----------
  {
    slug: 'benzoin-resinoid',
    name: 'Benzoin Resinoid',
    kind: 'natural_mixture',
    systematicName: 'Styrax tonkinensis resin extract',
    family: 'balsamic',
    secondary: ['sweet'],
    role: 'base',
    descriptors: ['Balsamic', 'Vanilla', 'Warm'],
    emphasis: [
      ['Balsamic', 3],
      ['Sweet', 2],
      ['Warm', 2],
    ],
    description: 'Warm, sweet balsamic resin extract.',
    motif: 'amber-gem',
    hue: 38,
    cas: '9000-72-0',
    constituents: [C('Coniferyl benzoate'), C('Benzyl benzoate'), C('Vanillin', 'cmp-vanillin')],
  },
];

export const INGREDIENTS: Ingredient[] = SPECS.map((s) => ({
  id: stableUuid(`ingredient:${s.slug}`),
  slug: s.slug,
  name: s.name,
  kind: s.kind,
  systematicName: s.systematicName,
  family: s.family,
  secondaryFamilies: s.secondary ?? [],
  role: s.role,
  descriptors: s.descriptors,
  descriptorEmphasis: s.emphasis.map(([descriptor, level]) => ({ descriptor, level })),
  description: s.description,
  art: { motif: s.motif, hue: s.hue },
  compoundId: s.compoundId,
  constituents: s.constituents,
  properties: properties(s),
}));

export const ingredientIdBySlug = (slug: string): string => {
  const found = INGREDIENTS.find((i) => i.slug === slug);
  if (!found) throw new Error(`Unknown fixture ingredient ${slug}`);
  return found.id;
};
