# Application contract

Read this contract before creating a new website or web application or
materially restructuring an existing one. It defines the portable engineering invariants;
framework-specific details continue to follow the repository.

Keep the source modes distinct. Figma handoff requires node-specific design
context and exact available exports. Screenshot-only reconstruction requires
no Figma access or node; follow
[screenshot-reconstruction.md](screenshot-reconstruction.md), recording visual
inferences and substitutions without inventing Figma metadata. Both modes
produce functional, maintainable UI and follow the same engineering contract.

## Website scope

Support landing pages, company/marketing sites, portfolios, and multi-page
websites alongside applications and dashboards. Compose site pages from
focused sections and shared layout/navigation components. Apply the same
fidelity, responsiveness, performance, and early live-preview workflow.

Choose static rendering or generation when content and interaction needs
permit it, preserving the existing stack. Add server logic, authentication,
databases, CMS integration, or global state only when the requested features
need them. A site without those requirements has no missing-backend blocker.

Verify page routes, section anchors, menus, and calls to action. For public
sites, provide semantic page structure and appropriate page titles/descriptions;
apply indexing/canonical settings when the actual publishing URL and visibility
requirements are known. Contact or signup forms require real submission
behavior or an explicitly identified integration boundary, never fake success.

## 1. Preserve or choose the stack

Use this decision order:

1. Preserve an existing repository's framework, language, package manager,
   router, styling system, component library, data layer, and test tools.
2. Honor a stack explicitly chosen by the user.
3. For greenfield work, choose the smallest maintained stack that satisfies
   runtime requirements. A client dashboard consuming an existing API does not
   need a full server framework; SSR, SEO, server routes, auth, or same-project
   backend needs may justify one.
4. Use project-native scaffolding and current official documentation rather
   than hardcoding stale versions in the skill.

Do not add a global state manager, data-query library, form library, component
library, animation runtime, or CSS framework without a demonstrated need.

## 2. Authorial structure

The application must have clear source boundaries for:

- app shell, navigation, and routes;
- design tokens and global foundations;
- reusable UI components and their variants;
- route-specific compositions;
- data clients/adapters and domain types, when needed;
- server-only code and secrets, when present;
- fixtures used by local development and visual QA, when needed;
- tests and browser smoke coverage.

Always compose applications from focused components and cohesive modules.
Never accumulate unrelated screens, state, data access, and business rules in
one giant file or component. Organize by product feature within repository
conventions: keep feature-local UI nearby, promote genuinely shared UI to
shared modules, and separate stateful hooks/controllers, services/adapters,
and pure domain logic where their responsibilities differ. Keep dependencies
explicit and coupling low. Split by responsibility, not arbitrary line limits;
avoid tiny pass-through abstractions and unnecessary services or microservices.

Optimize for human readability: use precise names, small cohesive functions,
explicit typed interfaces at boundaries, pure logic where possible, and guard
clauses instead of deeply nested control flow. Follow the existing language's
type conventions and keep side effects visible.

Comments default to none. Aim to remove about 99% of nonessential comments in
authored or touched code by making the code self-explanatory. Retain only
essential explanations of why, non-obvious invariants, required API
documentation, and legal or tool annotations. Do not remove necessary context
to meet a numeric quota.

Generated output is disposable. Change the source, rebuild, and verify that the
result survives a clean build.

## 3. Design tokens and foundations

Translate available design variables and styles semantically. In Figma mode,
use the supplied variables and font metadata. In screenshot mode, infer a
coherent token system and record uncertain fonts, spacing, and other values:

- preserve aliases and light/dark or brand modes instead of flattening them;
- map colors, typography, spacing, radius, shadow, and motion values into the
  project's token mechanism;
- use raw one-off values when the design truly has no reusable semantic token;
- do not force every measured value into an artificial scale;
- load the exact font family, weight, style, optical sizing, and letter spacing
  used by the reference when identified and available; document any screenshot
  font approximation rather than marking it exact;
- keep fallback fonts intentional because fallback metrics change wrapping.

Start visual correction with fonts and global tokens. Local margin patches
cannot reliably compensate for a wrong font or root scale.

## 4. Components and variants

Map design concepts to code deliberately:

- repeated semantic UI becomes one component;
- size, tone, intent, density, and meaningful variants become typed props;
- hover, focus-visible, active, visited, and disabled visuals normally use
  pseudo-states with design-system styling;
- loading, error, expanded, selected, checked, and permission state normally
  come from runtime state;
- text and media become content/props/slots rather than copied components;
- instance swaps become a slot or injected component when appropriate;
- a Figma grouping layer does not automatically deserve a component.

Keep a single source for each component. Test variants with representative
content, including long labels, missing optional media, and localization where
relevant. Do not abstract so early that arbitrary wrappers and prop matrices
make exact layout harder to control.

## 5. Layout and responsiveness

Treat supplied frames or screenshots as reference points, not independent
posters:

- derive flow from Auto Layout, constraints, grids, intrinsic content, and
  semantic relationships when available; screenshot-only flow and responsive
  rules are explicit inferences;
- use normal flow, Grid, Flexbox, container sizing, `min-width: 0`, wrapping,
  and `clamp()` where they express the intended behavior;
- use absolute positioning for genuine local overlays, charts, badges, and
  art-directed compositions, not for the global page structure;
- maintain content order and usable keyboard/navigation order;
- prevent horizontal overflow without clipping meaningful content;
- use content-driven breakpoints when the project does not already define
  them; supplied frame widths are validation points, not automatically the only
  breakpoint values;
- verify at exact supplied widths and intermediate widths where layout changes.

If only one viewport exists, implement conservative fluid behavior and label
other widths as inferred. Do not claim a missing responsive design as verified.
A cropped screenshot defines only its visible region; unseen page content and
behavior are inferred or supplied separately, never claimed as visually matched.

## 6. Routes, state, and interaction

Every visible control must have real semantics and behavior:

- links navigate to valid routes or destinations;
- buttons perform the described action and expose disabled/busy state;
- forms validate, submit, report errors, and preserve user input correctly;
- dialogs/drawers manage focus, escape, backdrop behavior, and return focus;
- tabs, menus, comboboxes, tables, pagination, filters, and disclosures follow
  accessible keyboard behavior;
- loading, partial, empty, error, success, offline, and permission states exist
  when the flow can reach them;
- deep links load directly and browser back/forward behavior remains correct;
- reduced motion is respected and essential information is not conveyed by
  motion alone.

Prototype links describe interaction intent, not authorization or business
truth. Motion has one authorial implementation. When Figma includes authored
motion, use the Figma motion workflow before translating it.

### Custom controls and focus

In both Figma handoff and screenshot reconstruction, make the visible controls
custom to the source design and its design system. Reuse and style accessible
project or headless primitives instead of rebuilding their interaction logic.
Keep native semantics where applicable; custom appearance does not mean
replacing buttons or inputs with nonsemantic elements.

- Selects and dropdowns must have custom-styled triggers, panels, option lists,
  and relevant states. Do not ship browser-default select popups or
  merely restyle the closed trigger while leaving the open menu native.
- Style toggles, checkboxes, radios, menus, and other controls consistently
  with the design system, including hover, active, selected, disabled, error,
  and keyboard-focus states. Preserve labels, form values, validation, and
  assistive-technology semantics.
- Never add focus outlines or outline-like rings to non-text-entry controls,
  including selects, toggles, buttons, checkboxes, radios, menu items, and
  options. This includes ring utilities and box shadows used to imitate an
  outline. Ordinary component borders and non-focus shadows are unaffected.
- Only fields where users actually type text, such as text inputs, textareas,
  and editable text regions, may use a focus outline. In an editable combobox,
  that exception applies only to its text-entry field, not its trigger or
  options. An input element used as a checkbox or toggle is not text entry.
- Give non-text controls a clearly visible `:focus-visible` treatment through
  design-system surface, border-color, or text changes. Distinguish focus from
  selection and hover, keep it legible in forced-colors/high-contrast modes,
  and preserve user accessibility overrides. Scope default-outline removal to
  controls that already have a visible replacement; never use a blanket reset
  that leaves keyboard users without feedback.
- Verify opening, closing, keyboard navigation, selection, Escape, focus
  return, and relevant typeahead behavior for custom dropdowns. Reuse the
  primitive's supported interaction pattern and verify touch behavior too.

### Live development preview

As soon as the first meaningful screen can render, automatically reuse an
authorized existing development server or start the repository's native dev
command. Verify its working URL and open it with the available browser/preview
tools so the user can follow ongoing changes. Keep hot reload active; do not
wait for the full application to be finished.

While work continues, show a small development-only corner status component in
the user's language. Describe the actual stage, such as "Processing 2/5 ·
Navigation", using a real enumerated stage list for any counts. Update only at
real work boundaries, report blocked stages truthfully, and never invent
percentages or timers. This is implementation progress, not a simulated product
loading state. Keep it readable, unobtrusive, accessible, and clear of controls;
use polite status announcements without taking focus or blocking interaction.

Use an explicit development-only QA toggle to exclude this component from
fidelity captures; never mask real application discrepancies. Remove it when
work is complete and verify the final UI without it. Ensure the status component
and any supporting helper endpoint are excluded from production output.

Leave the verified preview usable and running when the environment supports
it, and report its URL. A running local preview is not hosting or deployment.

## 7. Assets and fonts

- Download and keep the exact exported image or SVG bytes when Figma supplies
  them. Figma MCP asset URLs are temporary references, not production assets.
- Never redraw a vector, choose a merely similar library glyph, or leave a
  placeholder when the original is available.
- In Figma handoff, retain the real exported icons; Keyline Icons is not a
  convenience substitute. In screenshot-only mode, first seek exact supplied
  or recoverable assets. For an unrecoverable UI icon, use a genuine Keyline
  Icons asset with the closest semantic and visual style match, document the
  substitution, and never silently switch to another library.
- Logos and brand marks require authentic assets, not Keyline icon stand-ins.
  Record missing originals as asset blockers. Document screenshot icon, font,
  and media substitutions separately; nonexact sources cannot be marked `exact`
  or support a `verified` target. Reviewed approximations may receive `manual`.
- Reuse a repository asset only after confirming the actual glyph/media, not
  just its filename.
- Preserve aspect ratio and explicit dimensions to avoid layout shift.
- Optimize only with a reversible process that keeps visible fidelity. Do not
  turn a sharp source into a smaller blurry approximation.
- Font files must be licensed/provided for the intended use. If the precise
  font is unavailable, record the source limitation and do not claim verified
  fidelity. Figma exact-font requirements remain blocked; screenshot mode may
  proceed with an explicitly documented approximation.

## 8. Data boundary

Apply this section when the requested features need external or dynamic data.
A static content site with working navigation and links can be complete with
`integrations: []`; do not add adapters or fixtures to manufacture a data layer.

Neither Figma nor a screenshot specifies an API contract. Use this order:

1. Existing backend and domain types in the repository.
2. API/schema/auth contracts explicitly supplied by the user.
3. A typed adapter boundary that can receive the real integration later.
4. Deterministic fixtures for local UI development and visual QA.

Do not put mock responses inline throughout components. Keep mock adapters
swappable and visibly identified. Exercise error and slow/loading paths, not
only success fixtures. Never infer a security boundary because an element is
hidden in one frame.

## 9. Accessibility, performance, and resilience

- Preserve semantic landmarks and a logical heading hierarchy.
- Provide names, labels, alt text, visible focus, sufficient contrast, and
  keyboard access.
- Use native semantics and accessible project/headless primitives underneath
  custom design-system visuals. Follow the control and focus rules in section 6.
- Reserve dimensions for media and avoid unexpected layout shift.
- Load the critical visual assets and fonts intentionally; lazy-load work below
  the initial view and split route or feature code when it reduces startup work.
- Avoid duplicate libraries, large client bundles, unbounded observers, and
  render loops.
- Keep state close to its consumers; use narrow subscriptions/selectors and
  stable props or callbacks where they prevent meaningful repeated work.
- Apply memoization wherever feasible and beneficial or necessary for the
  workload. Identify repeated expensive computation or rendering, measure a
  representative interaction, and verify the gain. Use correct dependencies,
  explicit invalidation, and bounded caches; account for comparison and memory
  costs. Never blanket-memoize or depend on a cache for correctness.
- Bound work as data grows: paginate large queries/lists and virtualize long
  rendered collections where appropriate, preserving keyboard and accessibility
  behavior. Verify representative data volumes and update frequency.
- Cancel or ignore stale requests, and clean up subscriptions, observers,
  timers, and other resources when their owner changes or is disposed.
- Keep a usable error boundary/fallback around recoverable route or data
  failures.
- Preserve user content and state across recoverable errors where reasonable.

Choose performance and scalability measures for real workload limits, using
profiling to prioritize bottlenecks. Follow current official framework/runtime
documentation for version-specific memoization, compiler, and lifecycle behavior.

When literal fidelity conflicts with accessibility or safe behavior, implement
the accessible behavior and record the bounded visual deviation.

## 10. Prohibited shortcuts

Do not deliver:

- a screenshot or full-frame SVG pretending to be the UI;
- a canvas containing ordinary application content;
- a page assembled from hundreds of absolute coordinates to match one frame;
- expiring Figma asset URLs in committed/durable source;
- invented data, auth, permissions, or backend success;
- redrawn or invented replacements for Figma assets, icons, or fonts;
- fabricated exact-source claims or undocumented icon, font, or media
  substitutions;
- controls that are decorative or log to the console instead of working;
- browser-default dropdowns, focus outlines/rings on non-text-entry controls,
  or removed focus feedback without a visible keyboard-focus replacement;
- generated build files as the only modified source;
- a mock represented as a connected production service;
- duplicated motion logic;
- secrets in browser code or public environment variables;
- a universal framework migration motivated only by the design;
- giant files or components that mix unrelated responsibilities;
- blanket memoization, unbounded caches, or abstraction without a concrete need;
- “pixel-perfect” claims without a named route, state, viewport, reference,
  and verification method.

## 11. Functional definition of done

The application portion is complete only when:

- every in-scope route and state in the implementation map exists;
- critical navigation and user flows work from a clean start;
- direct navigation/deep links work in the production-like server;
- real and mock data boundaries are identified accurately;
- relevant loading, empty, error, disabled, and success states are exercisable;
- keyboard, visible focus without non-text-entry outlines/rings, custom
  dropdown behavior, and semantics were checked;
- component/module boundaries and readability were reviewed, and performance
  decisions were verified against representative workloads;
- no critical console error, failed local asset request, or unhandled rejection
  remains;
- typecheck, lint, tests, build, and smoke checks applicable to the repository
  pass;
- visual completion is established separately under the fidelity contract.
