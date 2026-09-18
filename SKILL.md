---
name: kodety-aidoff
description: "Build websites and apps from Figma or screenshots. Reported fidelity with OpenAI Astra, Medium or higher: screenshot alone 75-90%; Figma link with or without a screenshot 90-99%. Results vary."
license: CC-BY-SA-4.0
---

# Kodety AIDoff

Kodety AIDoff brings AI to the design-to-code handoff and screenshot
reconstruction. Turn Figma frames or a supplied screenshot into maintainable,
functional websites and web applications. Verify visual fidelity, runtime stability, and
production readiness separately.

Website work includes landing pages, company and marketing sites, portfolios,
and multi-page sites. Both input modes support these deliverables as well as
applications and dashboards. Choose the simplest suitable architecture; a
content site does not require authentication, a database, or application state
unless its actual features call for them.

## Input modes

- **Figma handoff:** use node-specific design context, exact measurements,
  component/variable information, and original exported assets for precise,
  repeatable Figma-to-code implementation. Always retrieve the real Figma icons
  wherever available; screenshot fallback rules do not change this mode.
- **Screenshot reconstruction:** recreate the visible UI from a supplied print
  or screenshot without requiring a Figma file. Read
  [references/screenshot-reconstruction.md](references/screenshot-reconstruction.md)
  before implementing this mode. Use genuine Keyline Icons for UI glyphs whose
  exact source cannot be recovered, and record the substitution.

With **OpenAI Astra at Medium reasoning effort or higher**, the maintainer
reports these typical visual fidelity ranges:

- **Screenshot alone:** 75%-90%.
- **Figma link, with or without an accompanying screenshot:** 90%-99%.

These are informal visual assessments, not an independently validated
benchmark, measured average, automatic score, or guarantee. Source access,
quality, fonts, and assets affect results; verify each implementation
separately and do not assume the same ranges for other models or settings.
The Figma range assumes the linked design can actually be accessed and
extracted; an inaccessible link does not supply usable design context.

A screenshot exported from an available Figma source for comparison remains
part of Figma handoff. Do not silently switch an unavailable Figma source to
screenshot reconstruction to evade missing-source or asset requirements.
For mixed tasks, keep separate maps for each mode and validate each with
`--map`; never invent Figma metadata for screenshot-only targets.

## Required workflow

1. Identify the input mode and supplied Figma nodes or screenshots, the screens
   and states in scope,
   the target repository or greenfield location, and whether the requested
   result is local-only, production-capable, or actually deployed.
2. For Figma handoff, load `figma-design-to-code` before extraction when that
   companion skill is installed, and follow it throughout the task. Otherwise,
   use the host's available Figma workflow to obtain node-specific design
   context, a reference screenshot, and exact exported assets. Pass `skillNames`
   only when the actual tool schema supports it. Treat generated code as a
   reference, not final code. Never substitute metadata or a screenshot for
   available design context; if the required extraction is unavailable, report
   that source boundary as blocked. For screenshot reconstruction, the supplied
   image is the visual baseline; no Figma extraction or node ID is required.
3. Inspect the repository before choosing architecture or writing code:
   instructions, manifests, lockfiles, routes, tokens, component libraries,
   fonts, API clients, auth, tests, build scripts, and uncommitted changes.
4. Inventory every in-scope frame, route, viewport, component, variant,
   interaction, asset, font, theme, data dependency, and visible state. Include
   relevant neutral loading, empty, partial, error, success, and disabled
   states even when the reference only depicts the happy path. Inventory roles,
   ownership, and permission states only when they are in scope. If an in-scope
   authorization requirement lacks its contract, record that boundary as
   blocked; do not create an auth blocker for a public content site.
5. Create or update the implementation map described in
   [references/implementation-map.md](references/implementation-map.md). For a
   one-component repair, an equivalent small task ledger is enough; for
   multiple screens, states, or viewports, use the versioned JSON map.
6. Read [references/application-contract.md](references/application-contract.md)
   completely before creating a new website or app or materially restructuring one.
   Preserve the existing stack and conventions unless the user explicitly
   requests a migration.
7. Choose the smallest architecture that satisfies the actual product. The
   visual source determines presentation and visible interaction intent; it does not determine
   framework, database, authorization model, or business rules.
8. Acquire exact available assets and the correct font files/weights. In Figma
   handoff, exhaust original icon/asset retrieval and remove expiring MCP asset
   URLs from durable code. Never redraw or substitute an available original.
   In screenshot mode, follow its explicit Keyline fallback and font-inference
   rules, recording approximations without claiming they are exact.
9. Implement one representative vertical slice first: route, layout, exact
   assets or documented screenshot-mode substitutions, a meaningful state,
   behavior, responsive rules, and a data boundary when required.
   As soon as a meaningful screen renders, start or reuse the local development
   server and automatically open its verified URL in the available browser or
   preview. Keep it visible and updating while work continues; follow the live
   preview rules below. Validate the slice visually before propagating it.
10. Implement shared foundations and components from real repetition and
    variants. Always compose screens from focused components and cohesive
    modules; keep route files responsible for composition. Map design variants
    to props, native pseudo-states, or runtime state deliberately; do not turn
    every Figma layer into a component.
11. Implement the in-scope routes, navigation, controls, forms, validation,
    keyboard behavior, focus, error handling, and data transitions. For sites,
    include working page/section links and calls to action. If a required
    backend or business contract is missing, use a typed adapter and deterministic
    fixtures only as an explicit boundary; do not call the integration
    production-complete.
12. Derive responsive behavior from supplied frames, Auto Layout and constraints
    when available, or the screenshot's visible geometry and content flow.
    Verify the supplied widths and at least one intermediate
    width between each pair. With one supplied viewport, also test at least one
    narrower width, one wider width or container maximum, and the inferred
    breakpoint boundaries. Do not promise exact mobile fidelity when no mobile
    reference exists.
13. Read [references/visual-fidelity.md](references/visual-fidelity.md)
    completely before visual sign-off. Run the app, capture the same route,
    state, viewport, DPR, theme, locale, and data as the reference where known;
    in screenshot mode, record and use explicit assumptions for missing source
    settings. Compare, correct root causes, and repeat.
14. When the result includes real data, auth, server logic, deployment, or a
    production claim, read
    [references/production-readiness.md](references/production-readiness.md)
    completely and satisfy the applicable gates.
15. Run the repository's typecheck, lint, tests, production build, and browser
    smoke checks. Serve the built artifact when the stack supports it and test
    deep links rather than validating only the development server. Review
    component boundaries, readability, and relevant performance bottlenecks;
    verify optimizations with representative data and interaction workloads.
16. Run the bundled preflight/evidence validator, fix every `ERROR`, and inspect
    every `WARN`. It scans structure and durability, validates the ledger, and
    independently recomputes automated screenshot evidence. It does not replace
    human review or prove that the chosen reference/state is the correct one.

## Source-of-truth order

For Figma handoff, apply design information in this order:

1. Code Connect mapping and the repository's established component contract.
2. Component documentation and design annotations.
3. Figma variables, styles, component properties, and supplied responsive
   frames.
4. Exact exported assets and font metadata.
5. Raw values and screenshot inference.

For screenshot reconstruction, the supplied image defines visible appearance;
use existing functional contracts and exact supplied assets, then measured
image geometry and explicitly recorded inferences. Do not apply unrelated
design presets or replace the screenshot's visual style.

When sources conflict, preserve functional and accessibility requirements,
record the conflict, and use the highest-priority reliable source. Never hide a
conflict with a local visual hack.

## Non-negotiable build rules

- Existing project architecture, package manager, styling system, and shared
  primitives win unless a change is explicitly in scope.
- Keep source files as the source of truth. Never repair generated build output
  instead of the authorial source.
- Use semantic, accessible controls. A visual button is a real button or link;
  a modal manages focus; tables, forms, labels, and headings keep their native
  meaning.
- Make control visuals custom to the design system in both input modes. Select
  triggers, dropdown panels, and options must all be custom styled; do not
  leave the open dropdown to browser-default rendering. Reuse accessible
  project or headless primitives for behavior and semantics.
- Do not add focus outlines or outline-like rings to selects, toggles, buttons,
  checkboxes, radios, or other non-text-entry controls. Only actual text-entry
  fields may use a focus outline. Preserve visible keyboard focus with a
  distinct design-system surface, border-color, or text treatment; never remove
  focus feedback globally. Follow the detailed control rules in the
  [application contract](references/application-contract.md#custom-controls-and-focus).
- Use Grid, Flexbox, normal flow, container constraints, and deliberate local
  overlays. Do not absolute-position the whole screen to imitate one snapshot.
- Never use the reference screenshot as the page background, a monolithic image,
  canvas, or giant SVG to pass visual comparison.
- Keep one implementation for each behavior or motion. Do not duplicate the
  same transition in CSS, JavaScript, and a motion library.
- Preserve exact glyphs and media. An icon-library name match is insufficient
  when the exported glyph differs. The documented Keyline fallback applies
  only to unrecoverable UI glyphs in screenshot reconstruction.
- Keep secrets server-side. Do not put tokens, service credentials, or private
  endpoints in client bundles, fixtures, screenshots, logs, or reports.
- Do not invent authentication, permissions, persistence, schema, analytics,
  or successful mutations from visual evidence alone.
- A mock must be named and isolated as a mock. Production-capable means every
  required real boundary is connected and its failure behavior is implemented.
  A content site with no external data features may have no integrations.
- Accessibility, user preferences, and safe runtime behavior outrank literal
  imitation when the Figma depicts an inaccessible or unsafe state. Document
  the intentional deviation.
- Deployment, publication, database mutation, and other external writes occur
  only when the user requests them.

## Modularity, clean code, and performance

- Always avoid monolithic source files and components that combine unrelated
  responsibilities. Compose screens from focused components; separate UI,
  stateful behavior, domain logic, and data access behind clear interfaces.
  Keep feature-local code near its feature and share proven common behavior.
  A modular application may remain a single deployable; do not introduce
  microservices, tiny wrapper components, or speculative abstractions merely
  to increase separation.
- Maximize human readability using the repository's clean-code conventions:
  descriptive domain names, small cohesive functions, explicit contracts,
  straightforward control flow, low coupling, and a single source for shared
  logic. Prefer clarity over cleverness; avoid duplication and abstractions
  that obscure simple behavior. See the
  [application contract](references/application-contract.md) for details.
- Default to no explanatory code comments, targeting a roughly 99% reduction
  in nonessential commentary. Make names and structure explain the code. Keep
  only essential rationale, subtle invariants, required API documentation,
  license notices, and necessary tool directives. Never remove essential
  information to meet a numerical quota.
- Evaluate memoization wherever repeated computation or avoidable rendering
  is costly; apply it whenever it is useful and justified. Account for the
  framework's existing optimizations, dependency correctness, invalidation,
  and memory cost. Avoid blanket memoization and never depend on cached
  results for correctness.
- Apply suitable performance techniques as part of implementation: localize
  state updates, avoid redundant requests, split noncritical code, load assets
  intentionally, bound large data views, and clean up asynchronous work.
  Choose techniques for the actual workload and verify the relevant benefit.
- Design for realistic growth in data and concurrent usage where applicable.
  Keep resource use bounded and integration contracts explicit; use the
  [production readiness](references/production-readiness.md) guidance for
  server/data scaling and performance evidence. State tested capacity and
  limits instead of making unsupported scalability claims.

## Live preview and progress

- Open the local development preview automatically as soon as the first
  meaningful screen renders; do not wait for the entire implementation. Use
  the repository's start command, reuse a working task server where possible,
  verify that the route responds, and open it through available browser or
  preview tools. Keep hot reload available while editing.
- While work remains, show a small development-only status component in a
  corner of the preview, in the user's language, with the actual current stage
  such as "Implementing navigation" or "Checking responsiveness." Update it
  when work changes, and show blocked/paused work honestly. Never invent a
  completion percentage or simulate progress with a timer.
- Keep the indicator readable and unobtrusive, avoid covering controls, and
  do not steal keyboard focus. It describes implementation progress, not the
  application's own loading or business state.
- Automatically remove the notice immediately when the work is complete;
  do not leave a permanent "Done" badge. Hide this development-only overlay
  for reference-matched visual captures and verify its absence in the final
  preview. Never hide actual application discrepancies during comparison.
- Exclude the indicator and any supporting development endpoint from the
  production artifact. Keep the completed local preview available when the
  environment supports it and report its URL; opening localhost does not
  imply a deployment. See the
  [application contract](references/application-contract.md) for details.

## Fidelity claims

Use exactly one status per target in the implementation map and any detailed
report. The concise final response can link to this evidence:

- `verified`: automated comparison and human inspection passed at the listed
  route, state, viewport, and environment.
- `manual`: side-by-side or overlay inspection passed with no trustworthy
  pixel metric, or a screenshot reconstruction was reviewed as an approximation
  with explicit deviations. This does not claim exact or automated fidelity.
- `unverified`: implemented but not compared against a reliable reference.
- `blocked`: a required source frame, font, asset, state, or runnable
  environment is missing.

Say “verified at the supplied viewports,” not “pixel-perfect everywhere.”
Browser and Figma font rasterization can differ even when geometry is correct;
record anti-aliasing exceptions rather than weakening geometry, line-wrap, or
asset requirements.

`targets[].status` describes visual fidelity only. `integrations[].mode`
describes whether data/auth/backend behavior is real, adapted, mocked, or
blocked. A visually verified target can still have a blocked integration, and
a real integration does not prove visual fidelity.

## Figma ecosystem routing

- Prefer `figma-design-to-code` for Figma extraction when installed; otherwise
  use an equivalent host workflow that preserves the extraction requirements
  above. Screenshot-only reconstruction does not require Figma tooling.
- For authored motion, use `figma-implement-motion` when available or the
  host's equivalent motion-inspection workflow; report an unavailable motion
  source as blocked rather than inventing timing or easing.
- Use `figma-use` for special programmatic reads when it is installed and the
  chosen tool requires it; otherwise follow the actual tool's instructions.
  Writing to Figma remains outside this skill's scope.
- Use an available native-platform workflow, such as `figma-swiftui`, for
  SwiftUI/iOS/iPadOS work instead of this web skill.
- Use the platform-specific skill instead for Kodety, Webflow, or Framer output.

## Validation

Set `FIGMA_APP_SKILL_DIR` to this skill directory.

```bash
node "$FIGMA_APP_SKILL_DIR/scripts/validate-figma-app.mjs" /absolute/path/to/app
```

The validator automatically reads `.figma-app/implementation.json` when
present. An alternate map can be supplied with `--map /absolute/path/map.json`.
Add `--require-map` for every multi-screen, multi-state, or production-claim
workflow; omit it only for a genuinely narrow component repair.

Screenshot source validation and verified visual targets require Python 3
with Pillow: the validator decodes source images and recomputes verified pixel
evidence rather than trusting a JSON report. It tries
`python3`, then `python` (`py -3` first on Windows). Set
`FIGMA_APP_PYTHON` to an explicit Python executable when needed.

When reference and implementation screenshots are local files, compare them:

```bash
python3 "$FIGMA_APP_SKILL_DIR/scripts/compare-screenshots.py" \
  /path/reference.png /path/actual.png --output-dir /path/comparison
```

Use `--max-mismatch-ratio` only after choosing and recording a project-specific
threshold. Never resize one screenshot to make unequal viewports compare.

After installing or changing this skill, run its deterministic contract test:

```bash
node "$FIGMA_APP_SKILL_DIR/scripts/self-test.mjs"
```

## Completion and handoff

Keep the completion response brief: the result, a usable project/artifact link
or start command, a compact validation outcome, and any material blocker or
limitation the user needs to act on. Avoid walkthroughs, code narration, long
change lists, and unsolicited architectural explanations.

Keep the following details in the existing implementation map, task ledger,
or linked evidence artifacts; do not repeat them all in chat:

- the runnable source project and exact local start/build commands;
- the routes, components, states, integrations, and assets implemented;
- the fidelity status and comparison artifact for every mapped target;
- typecheck, lint, test, build, smoke, accessibility, and validator outcomes;
- which data/auth/backend paths are real, mocked, inferred, or blocked;
- intentional visual or accessibility deviations and missing source material;
- deployment URL only when deployment was explicitly requested and verified.

Keep progress updates short and focused on meaningful changes or blockers.
Do not reduce implementation quality, verification, or required disclosures
to save tokens; reduce repetitive narration and redundant documentation.

Unless the user already requested an explanation, end the completion response
with one short optional question in the user's language, such as "Would you
like the technical details?" Deliver the work before asking. Explain only
when the user explicitly asks or opts in; if they remain silent, ignore the
question, or move on, provide no extra explanation and do not ask again.
When details were already requested, answer them directly at the requested
depth without another opt-in question.

If the user asks for “localhost and production” without naming a deployment
target, deliver and verify the development command plus the production
build/preview. Treat deployment as a separate request. Distinguish
`production-build-verified`, `production-integrated`, and
`deployed-and-verified` in the handoff.

Do not claim completion while an in-scope target is silently absent, a control
is decorative, an expiring asset URL remains, the production build fails, or a
mock is being presented as a real integration.
