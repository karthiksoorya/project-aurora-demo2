# Deviation & decision log (for milestone visual review)

Deviations from the reference screenshots are intentional unless marked *fidelity gap*. Nothing here
blocked M0/M1; each item is a candidate for review.

## A. Scientific-honesty deviations (required by spec — keep)
| Reference shows | Implementation shows | Why |
|---|---|---|
| IFRA "Compliant / Exceeds limit", allergen flags, "82 % checks passed" | **Not assessed** | No IFRA edition, category, market rule set or allergen dataset configured (spec §0, §7) |
| Longevity 7–9 hrs, Sillage Moderate, Projection Medium, Complexity 7/10, Tenacity 4/10, Impact 7/10 | **Not assessed** cards | No measured data or validated model |
| Bergamot EO drawn as a single molecule (IE-M) | Constituent list; structure only for curated single compounds | A natural oil is a mixture (README) |
| Olfactive profile bars with % (85 %, 70 % …) | Primary / Secondary / Accent levels, badge *Demo / illustrative* | Curator tags, not measurements |
| "Similar ingredients 92 % / 88 %" | "Same family" list, badge *grouped by family tag* | No similarity model |
| CAS / MW as facts | CAS **Unverified**; formula/MW **Computed** from SMILES (RDKit) | No registry access in this offline build |
| AI suggestions ("Add Calone 0.5–1.0 %…") | Honest *AI unavailable* panel + skeleton placeholders | No AI integration until M4 approval |
| Sustainability "Biodegradable", "Commercially available" | Not assessed / no data source | No sourced data |

## B. Visual fidelity gaps (*fidelity gap* — review)
1. **Photography** — reference moodboards/thumbnails are photographs. No licensed image assets exist in the
   package (screenshots must not be embedded), so ingredient thumbnails, inspiration tiles, concept images
   and the hero use procedural SVG art. Users can upload their own images (stored locally). Highest-impact
   visual difference.
2. **3D realism** — the references are rendered illustrations (photoreal fruit, flowers, glass). The Three.js
   scenes use glossy spheres, particle clouds, halos and a lathe-modelled bottle. Same information
   architecture, lighter visual richness.
3. **Ingredient comparison (IE-C)** — radar charts per ingredient omitted (they would visualise unmeasured
   profiles); a provenance-labelled attribute table is shown instead.
4. **Version comparison (FS-VC)** — supports two versions at a time (reference shows three columns).
   "Key Metrics Comparison" and "Sensory description" show Not assessed.
5. **Formula Studio tabs** — *Formula Variations* = version history; *Stability & Compliance* links to
   Validation Studio.
6. **Ingredient Explorer tabs** — *Properties* and *Sustainability* tabs of the reference are folded into the
   detail panel tabs (Properties, Safety & Regulatory).
7. **Brand mark** — neutral hexagon logo; no employer branding (as required).
8. Category tiles in Ingredient Explorer use colour swatches rather than photos; counts are real catalog counts
   (25 demo ingredients), not the reference's 124/186.
9. **Validation Studio (VS-*)** — the reference shows green IFRA/allergen ticks and a 'Compliant' overall
   badge. No verified IFRA or allergen dataset is configured, so those rule sets report **Not assessed**
   with their missing inputs, and the overall status can never be better than *Not assessed* while they
   are selected. Only deterministic formula checks (total, negatives, duplicates, catalog presence,
   snapshot integrity) and data completeness can pass or fail.
10. **Experiment Explorer (EE-*)** — reference performance numbers (longevity, sillage scores, panel
   ratings) are not shown; the table shows only what a scientist recorded. Measurements require quantity,
   value, unit and method; hypotheses are labelled.
11. **Share & Review (SR-*)** — 'Share link' / external invite are replaced by in-app members with
   simulated users (no outbound sharing, no publishing). Avatars are initials, not photos.

## C. Decisions taken on open items (spec §10) — please confirm or redirect
| # | Open item | Decision taken for M1 (reversible) |
|---|---|---|
| 1 | Canonical Formula Manual image | FS-M1 baseline (per manifest); FS-M2/M3 as states |
| 2 | Canonical Universe image | IE-U1 baseline; IE-U2 selection; IE-U3 expanded |
| 3 | Molecular Inspector alternatives | One reusable inspector; FS-MI2 = constituent focus of a mixture |
| 4 | Experiment/Share roles & mode toggle | One global Manual/AI switch (confirmed). Roles per project: owner / reviewer / viewer |
| 5 | FS-06 vs Formula parent | Implemented as the AI-mode expanded state of the same canvas/draft/selection |
| 6 | Local demo identity | Four simulated users (confirmed): Senior Perfumer (owner), Product Development & Regulatory Affairs (reviewers), Marketing (viewer); header switcher; **not authentication** |
| 7 | Formula completion rule | Drafts may be any total; saving a version is **allowed** for incomplete/over totals and the snapshot is labelled `incomplete`/`over`; nothing is normalised without the explicit Normalize action. Saving incomplete versions is allowed and labelled (confirmed); validation FC-001 **fails** them. |
| — | Mode scope | Manual/AI mode is global (one header switch); AI panel visibility is remembered per workspace |
| — | UI state persistence | Mode, canvas, selection, cameras, filters persist per browser (localStorage); business data persists in the API |

## D. Known limitations
* JSON persistence is single-process; concurrent editing by several users is out of scope until M3.
* Registry verification of identifiers (CAS/PubChem) is pending — the build is offline by design.
* Roles are simulated via a request header; anyone with local access can act as any user. Real auth is out of scope for the POC.
* Regulatory/allergen rule sets are placeholders until a licensed, verified dataset is supplied.
