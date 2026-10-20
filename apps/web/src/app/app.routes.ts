import { Routes } from '@angular/router';
import { LandingComponent } from './landing.component';
import { AppShellComponent } from './shared/app-shell/app-shell.component';

/**
 * Exactly six workspace routes under /projects/:projectId (spec §2).
 * Panels, 3D modes, comparisons and expanded states are component state, not routes.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LandingComponent },
  {
    path: 'projects/:projectId',
    component: AppShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'concept' },
      {
        path: 'concept',
        title: 'Concept Studio · Aurora',
        loadComponent: () =>
          import('./workspaces/concept/concept-studio.component').then((m) => m.ConceptStudioComponent),
      },
      {
        path: 'ingredients',
        title: 'Ingredient Explorer · Aurora',
        loadComponent: () =>
          import('./workspaces/ingredients/ingredient-explorer.component').then((m) => m.IngredientExplorerComponent),
      },
      {
        path: 'formula',
        title: 'Formula Studio · Aurora',
        loadComponent: () =>
          import('./workspaces/formula/formula-studio.component').then((m) => m.FormulaStudioComponent),
      },
      {
        path: 'validation',
        title: 'Validation Studio · Aurora',
        loadComponent: () =>
          import('./workspaces/validation/validation-studio.component').then((m) => m.ValidationStudioComponent),
      },
      {
        path: 'experiments',
        title: 'Experiment Explorer · Aurora',
        loadComponent: () =>
          import('./workspaces/experiments/experiment-explorer.component').then((m) => m.ExperimentExplorerComponent),
      },
      {
        path: 'review',
        title: 'Share & Review · Aurora',
        loadComponent: () => import('./workspaces/review/share-review.component').then((m) => m.ShareReviewComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
