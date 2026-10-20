import { stableUuid } from '../common/ids';
import { DEMO_USER } from '../common/request-context';
import type { BriefContent, DbState } from '../domain/types';
import { ingredientIdBySlug } from './ingredients';

/** Synthetic seed: the fictional "Coastal Air" project. No real/proprietary formula data. */
export const SEED_PROJECT_ID = stableUuid('project:coastal-air');
const SEED_TIME = '2026-10-14T05:50:00.000Z';

export const COASTAL_AIR_BRIEF: BriefContent = {
  fragranceType: 'Fine Fragrance',
  targetConsumer: 'Modern, Active',
  keywords: ['Fresh', 'Woody', 'Citrus', 'Marine', 'Elegant'],
  description:
    'A modern, uplifting fragrance inspired by coastal landscapes. Fresh citruses, soft florals and airy woods create a sense of freedom and natural elegance.',
  references: [],
  inspirations: [
    ['waves', 'Breaking waves', ['Nature', 'Marine']],
    ['citrus', 'Sliced citrus', ['Citrus']],
    ['white-flowers', 'White blossoms', ['Floral']],
    ['driftwood', 'Driftwood', ['Woody', 'Textures']],
    ['sea-rock', 'Sea rock & shell', ['Marine', 'Textures']],
    ['cliffs', 'Coastal cliffs', ['Nature']],
    ['sunset', 'Sea sunset', ['Nature']],
    ['leaves', 'Green leaves', ['Nature']],
    ['jasmine', 'Jasmine', ['Floral']],
    ['shell', 'Seashell on sand', ['Marine', 'Textures']],
  ].map(([artKey, title, tags], i) => ({
    id: stableUuid(`inspiration:${i}`),
    source: 'art' as const,
    artKey: artKey as string,
    title: title as string,
    tags: tags as string[],
  })),
  concepts: [
    {
      id: stableUuid('concept:ocean-bloom'),
      name: 'Ocean Bloom',
      tags: ['Fresh', 'Citrus', 'Marine'],
      description: 'Sparkling citrus with airy florals and a mineral marine accord.',
      artKey: 'citrus',
      selected: true,
    },
    {
      id: stableUuid('concept:sunlit-woods'),
      name: 'Sunlit Woods',
      tags: ['Woody', 'Amber', 'Elegant'],
      description: 'Warm woods with soft amber and a touch of sea minerals.',
      artKey: 'driftwood',
      selected: false,
    },
    {
      id: stableUuid('concept:citrus-drift'),
      name: 'Citrus Drift',
      tags: ['Citrus', 'Floral', 'Fresh'],
      description: 'Bright citrus opening with delicate white florals and a clean woody base.',
      artKey: 'white-flowers',
      selected: false,
    },
  ],
};

/** Starting draft — illustrative composition only, sums to 100.000000 %. */
const SEED_DRAFT: [string, string][] = [
  ['bergamot-eo', '18.000000'],
  ['linalool', '12.000000'],
  ['hedione', '10.000000'],
  ['iso-e-super', '22.000000'],
  ['ambroxan', '18.000000'],
  ['vanillin', '5.000000'],
  ['cashmeran', '5.000000'],
  ['cedarwood-eo', '10.000000'],
];

export function buildSeed(): DbState {
  return {
    schemaVersion: 1,
    projects: [
      {
        id: SEED_PROJECT_ID,
        name: 'Coastal Air',
        status: 'draft',
        summary: 'A modern, uplifting fragrance inspired by coastal landscapes.',
        createdBy: DEMO_USER.id,
        createdAt: SEED_TIME,
        updatedAt: SEED_TIME,
      },
    ],
    briefs: [
      {
        projectId: SEED_PROJECT_ID,
        revision: 1,
        content: COASTAL_AIR_BRIEF,
        updatedAt: SEED_TIME,
        updatedBy: DEMO_USER.id,
      },
    ],
    drafts: [
      {
        id: stableUuid('draft:coastal-air'),
        projectId: SEED_PROJECT_ID,
        basedOnVersionId: null,
        revision: 1,
        batchSizeG: '100.000',
        items: SEED_DRAFT.map(([slug, massPct], position) => ({
          lineId: stableUuid(`draft-line:${slug}`),
          ingredientId: ingredientIdBySlug(slug),
          massPct,
          position,
        })),
        updatedAt: SEED_TIME,
        updatedBy: DEMO_USER.id,
      },
    ],
    versions: [],
    audit: [],
    uploads: [],
  };
}
