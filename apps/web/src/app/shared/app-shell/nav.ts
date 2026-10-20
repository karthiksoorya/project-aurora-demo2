import type { LucideIconData } from 'lucide-angular';
import type { WorkspaceKey } from '../../core/models';
import { I } from '../icons';

export interface WorkspaceNav {
  key: WorkspaceKey;
  label: string;
  icon: LucideIconData;
  color: string;
  milestone: 'M1' | 'M2';
}

/** Exactly six workspaces (spec §0). Everything else is a tab, panel or expanded state. */
export const WORKSPACES: WorkspaceNav[] = [
  { key: 'concept', label: 'Concept Studio', icon: I.Lightbulb, color: '#2f7bff', milestone: 'M1' },
  { key: 'ingredients', label: 'Ingredient Explorer', icon: I.Leaf, color: '#22a35c', milestone: 'M1' },
  { key: 'formula', label: 'Formula Studio', icon: I.FlaskConical, color: '#d6409f', milestone: 'M1' },
  { key: 'validation', label: 'Validation Studio', icon: I.ShieldCheck, color: '#3c63e6', milestone: 'M2' },
  { key: 'experiments', label: 'Experiment Explorer', icon: I.TrendingUp, color: '#e0479e', milestone: 'M2' },
  { key: 'review', label: 'Share & Review', icon: I.Users, color: '#2f7bff', milestone: 'M2' },
];
