import type { Family, NoteRole } from '../core/models';

export interface FamilyMeta {
  key: Family;
  label: string;
  color: string;
  tint: string;
  ink: string;
}

export const FAMILIES: FamilyMeta[] = [
  { key: 'citrus', label: 'Citrus', color: '#f6be12', tint: '#fff6d6', ink: '#8a6400' },
  { key: 'floral', label: 'Floral', color: '#f2559f', tint: '#ffe6f2', ink: '#b0256c' },
  { key: 'woody', label: 'Woody', color: '#a5704c', tint: '#f6ebe3', ink: '#7a4a2a' },
  { key: 'aromatic', label: 'Aromatic', color: '#22a77a', tint: '#ddf5ec', ink: '#12754f' },
  { key: 'marine', label: 'Marine', color: '#2c97f0', tint: '#e0f0ff', ink: '#155f9e' },
  { key: 'amber', label: 'Amber', color: '#f2861f', tint: '#ffeedd', ink: '#a5520b' },
  { key: 'spicy', label: 'Spicy', color: '#e3424a', tint: '#ffe4e5', ink: '#a51e26' },
  { key: 'green', label: 'Green', color: '#3fba4c', tint: '#e3f7e5', ink: '#227a2c' },
  { key: 'musky', label: 'Musky', color: '#a996d6', tint: '#efeafb', ink: '#5e4a9a' },
  { key: 'sweet', label: 'Sweet', color: '#ae63f0', tint: '#f3e8ff', ink: '#6f2fb0' },
  { key: 'fruity', label: 'Fruity', color: '#ff6f61', tint: '#ffe8e5', ink: '#b23a2e' },
  { key: 'balsamic', label: 'Balsamic', color: '#c4893a', tint: '#f8eedf', ink: '#7f5418' },
];

const BY_KEY = new Map(FAMILIES.map((f) => [f.key, f]));
export const fam = (k: string): FamilyMeta =>
  BY_KEY.get(k as Family) ?? { key: k as Family, label: k, color: '#8f9ab3', tint: '#eef1f7', ink: '#4c5670' };

export const ROLES: { key: NoteRole; label: string; window: string; color: string; tint: string; ink: string }[] = [
  { key: 'top', label: 'Top', window: 'conventional top-note role', color: '#2f80ff', tint: '#e5efff', ink: '#1d56c4' },
  {
    key: 'heart',
    label: 'Heart',
    window: 'conventional heart-note role',
    color: '#22a35c',
    tint: '#e2f6ea',
    ink: '#167641',
  },
  {
    key: 'base',
    label: 'Base',
    window: 'conventional base-note role',
    color: '#e66a2c',
    tint: '#ffece2',
    ink: '#a8461a',
  },
];
export const role = (k: string) => ROLES.find((r) => r.key === k) ?? ROLES[0];

export const kindLabel = (k: string) =>
  k === 'natural_mixture' ? 'Natural mixture' : k === 'single_compound' ? 'Single compound' : 'Blend';
