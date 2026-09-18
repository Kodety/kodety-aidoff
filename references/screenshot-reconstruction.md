# Screenshot reconstruction

Use this mode when the user asks to recreate an interface from a print or
screenshot, including websites, landing pages, portfolios, applications, and
dashboards. It produces real components, responsive layout, and functional
controls. It does not require Figma access. Keep the project's engineering,
accessibility, performance, integration, and validation rules from `SKILL.md`.

## Fidelity goal

The maintainer reports roughly 90% visual resemblance, approaching 99% in some
cases, using **OpenAI Astra at Medium reasoning effort or higher**. Treat these
as informal observations, not an independently validated benchmark, measured
average, or promise for other models or settings. Aim for high fidelity and
assess each result against its own source, available fonts, and assets.
Report a numeric result only when an explicit assessment method and evidence
support it. Do not equate perceived similarity with `1 - mismatchRatio`, weaken
the comparator's limits to accept 10% mismatch, or label a substitution exact.

Figma handoff has a stronger source of exact structure, measures, and assets.
Screenshot reconstruction infers those properties from pixels. Both modes
require runnable code and runtime checks; resemblance alone proves neither
behavior nor stability.

## Inspect and reconstruct

1. Inspect the original supplied image, not a recompressed preview when the
   original is available. Record its path, SHA-256, native pixel dimensions,
   and whether it shows a viewport, full page, or cropped component. Preserve
   the original if removing browser chrome or defining a comparison crop;
   record the crop rectangle and hash of the resulting reference. Never scale
   or stretch the reference to make a comparison pass.
2. Inventory the visible regions, text, hierarchy, alignment, spacing, colors,
   typography, borders, radii, shadows, images, icons, and control states.
   Separate measured observations from inferred values. Read only visible
   content; do not invent offscreen sections or hidden states as source facts.
3. Identify exact assets and fonts from user-provided material or the existing
   project. If unavailable, use suitable available typography/media with the
   approximation recorded. Keep logos authentic; a generic icon cannot replace
   a brand mark. Mark genuinely unrecoverable required assets as unresolved.
4. Build focused components with semantic HTML and normal flow, Grid, or
   Flexbox. Reconstruct hierarchy and containers before polishing individual
   offsets. Never display the supplied screenshot as the functioning page,
   assemble UI from cropped screenshot tiles, or flatten controls into images.
5. Implement visible control intent using known product contracts. For missing
   business logic, use explicit adapters/fixtures and retain honest integration
   status. A screenshot does not authorize invented auth, API, or persistence.
6. Reproduce the shown width first. If CSS viewport or DPR is unknown, record
   the assumption; treating native image pixels as CSS pixels at DPR 1 is an
   explicit working hypothesis, not recovered metadata. Test additional widths
   and meaningful states functionally, marking their appearance as inferred.
7. Capture, compare, inspect, and correct: major geometry, typography and line
   wrapping, assets, surfaces, then small details. Use equal reference/capture
   dimensions and compare only the genuinely supplied region. Follow the
   [visual fidelity contract](visual-fidelity.md).

## Icons: a mode-specific fallback

- First use an exact supplied or recoverable icon. When the original UI glyph
  cannot be recovered faithfully from screenshot-only inputs, use a genuine
  **Keyline Icons** glyph with the closest meaning and visual treatment.
- Source real assets from the [official library](https://keylineicons.com/)
  using the project's existing delivery conventions. The
  [official installation guide](https://keylineicons.com/install) documents
  `@keyline-icons/react`, SVG copying, and other integrations. Verify the
  actual glyph and style exports before using them; do not invent API names.
- Match optical size, stroke/fill treatment, color, and alignment without
  distorting the paths. Use a focused shared icon component where useful;
  retain accessible control names and hide purely decorative glyphs.
- Record each fallback as a substitution with source, glyph, style, affected
  targets, and reason. Never silently use another icon family, emoji, Unicode
  pictograms, or a rough hand-drawn approximation. If suitable Keyline assets
  are unavailable, retain a usable text control and mark the icon unresolved.
- Keyline is a UI-glyph fallback, not a replacement for logos, photos, or
  illustrations. Logos require authentic artwork. Prefer original photos and
  illustrations; document any permitted media approximation as nonexact.
- **Figma handoff is unchanged:** retrieve the actual icons and assets from
  Figma wherever possible. Do not apply this fallback merely because exporting
  is inconvenient, access fails, or a similar library icon is easy to find.
  Missing Figma assets remain explicit blockers unless the user authorizes a
  different treatment.

## Evidence and completion

Use the screenshot-mode schema in the
[implementation map](implementation-map.md). Keep original/canonical images
and comparisons outside the production bundle. Never fabricate Figma URLs,
file keys, or node IDs to satisfy a validator. For mixed tasks, separate maps
keep screenshot-specific inference from weakening Figma evidence.

`verified` requires the same strict automated and human review gates as Figma
handoff and no substituted assets/fonts. Use `manual` for a reviewed visual
approximation with concrete deviations; retain any available pixel results
without relabeling a failed comparison as passed. Use `unverified` for missing
comparison or inferred viewports, and `blocked` for missing required inputs.

Keep completion concise. Link to the implementation and evidence, state the
actual fidelity status and material approximations, and follow the existing
opt-in rule for further explanation.
