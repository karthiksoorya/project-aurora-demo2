# UX and engineering acceptance checklist (Codex and reviewer)

## M0 | Development foundation
- [ ] Fresh checkout runs locally with documented commands on Windows 11; Angular and NestJS both start.
- [ ] Exactly six workspace routes; sidebar and header match bright Aurora visual references, including Coastal Air project selector.
- [ ] Manual/AI toggle and optional hideable AI panel share project state; no remote request is issued by default.
- [ ] No proprietary employer assets or external cloud deployment.

## M1 | First useful scientist journey
- [ ] Concept Studio: modify, save, reload a creative brief and inspirations.
- [ ] Ingredient Explorer: search/filter curated demo ingredients; selecting one updates details and the 3D Universe; add to draft.
- [ ] Formula Studio: modify quantities, calculate deterministic totals in NestJS; see validation/error state for incomplete totals.
- [ ] `Inspiration Canvas` / `3D Formula View` / `3D Ingredients` all render; orbit, pan, zoom and picking work for 3D modes in Manual.
- [ ] Save v1, change draft, save v2; v1 remains bit-for-bit immutable; compare versions with real deltas.
- [ ] FS-06 AI Assist state is visually available in Formula Studio: same project/formula/3D context; optional panel; unavailable AI clearly labeled as disabled (no fabricated live suggestion). M4 adds real AI only after permission.
- [ ] Refresh page or restart API: draft, saved versions, mode switch context needed for workflow and project data remain consistent.
- [ ] Playwright tests cover create/edit/save/reopen, mode toggling, ingredient selection, version immutability, 3D canvas switch, and blocked outbound API calls.

## M2 | Complete Manual journey
- [ ] Validation results tied to immutable version ID, verified rule + evidence where available; unsupported conclusions `Not assessed`.
- [ ] Experiment with notes tied to saved version, branch ancestry, compare saved experiment observations only.
- [ ] Share & Review with role-checked simulated demo users, version-specific permissions, traceable comments and audit events.
- [ ] Graph view and contextual inspector operate within six workspaces (not extra workspace routes).

## M3 | DB durability
- [ ] Local loopback Docker PostgreSQL, migration+seed, test DB isolation and data survives container restart.
- [ ] All repositories swap from JSON to PostgreSQL without changing domain APIs; conflict detection/immutability tests still pass.

## M4 | AI and visual refinement
- [ ] User explicitly authorizes any external AI integration before Codex connects.
- [ ] AI proposals do not write without scientist acceptance; stale proposals cannot overwrite more recent draft versions.
- [ ] Screens visually compared side-by-side to screenshot references; record deviations, fix high-impact issues.

## Human sign-off boundaries
M0/M1 can begin **immediately**. Approval remains necessary for any real external services, proprietary data, public deployment, or scientific/regulatory data publication. Visual tuning is iterative review, not a blocker to initial implementation.
