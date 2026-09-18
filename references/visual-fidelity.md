# Visual fidelity contract

Visual fidelity is a measured loop, not a one-pass styling judgment. Apply this
contract to every target in the implementation map before assigning `verified`
or `manual` status.

## 1. Establish a trustworthy baseline

For each target, record its source mode and baseline:

- Figma handoff: exact file/version, node ID, and natural frame dimensions;
- screenshot-only: local original/canonical reference, SHA-256, native pixel
  dimensions, and crop information; record unknown source DPR or viewport
  explicitly and any inferred capture setup, without fabricated Figma metadata;
- route and deterministic runtime state;
- theme/mode, locale, timezone, and color scheme;
- actual capture device scale factor;
- fonts, weights, and assets, distinguishing exact sources from documented
  screenshot approximations;
- whether the screenshot includes browser chrome, scrollbars, overlays, or
  clipped content;
- whether the target is a viewport capture, full-page capture, or one selected
  element, and the deterministic path/setup used to reach its state.

In Figma mode, obtain design context before using its screenshot or an explicit
high-resolution Figma screenshot. In screenshot-only mode, use the supplied
original/canonical image without requiring Figma access; follow
[screenshot-reconstruction.md](screenshot-reconstruction.md). Do not replace an
available original with a thumbnail, recompressed chat preview, or scaled image.
A cropped source establishes a baseline only for its visible region.

If the reference dimensions do not match the intended browser capture, resolve
the discrepancy before comparing. Never resize one image to force a match.
Preserve the original and record any equal-scale crop used for regional review.
Unknown source DPR remains an uncertainty even when inferred capture dimensions
align; do not present a guessed viewport as supplied metadata.

## 2. Make the app deterministic

Before capture:

- use fixed fixtures or a stable test environment;
- fix locale, timezone, theme, feature flags, and permissions;
- freeze timestamps/random values when they affect visible output;
- wait for `document.fonts.ready`, images, route data, and layout settling;
- disable caret blinking, transitions, animations, and live cursors for the
  still capture unless a motion frame itself is the target;
- set reduced motion consistently;
- close dev overlays and dismiss unrelated banners;
- use the exact viewport and DPR recorded in the map;
- ensure there are no failed local assets or console/runtime errors.

Do not mask a region that can be made deterministic cheaply.

## 3. Capture and compare

Capture the actual page at the mapped route and state. When Playwright is
already available in the target project, the bundled `capture-route.mjs` can
produce a deterministic screenshot and diagnostics. Otherwise use the
environment's browser tooling with the same settings. Its diagnostics use the
same tool-agnostic runtime fingerprint (`kind`, `tool`, `toolVersion`, browser,
OS/arch, and user agent); Playwright is one supported producer, not a required
identity.

For complex states such as an open modal, filtered table, loading response, or
server error, use a safe development-only fixture route/query or a
project-specific Playwright test that performs the setup before capture. Do not
ship test bypasses enabled in production, and do not put credentials in capture
URLs or storage-state artifacts.

When both images are local, run `compare-screenshots.py`. Review all of:

- reference image;
- actual image;
- 50/50 overlay;
- heatmap/diff;
- mismatch ratio, mean absolute error, and changed bounding box.

A global metric can hide a badly wrong small component. Inspect critical
regions such as the app shell, primary heading, navigation, forms, tables,
charts, and primary actions separately.

The bundled comparator reports the whole image and does not apply masks. For a
critical region, capture the corresponding element or make equal-size crops
and run the comparator again. Record regional artifacts in the target's notes.
Keep dynamic exceptions narrow and manually review the unmasked image.

## 4. Correct by cause, not by symptom

Use this order because earlier mismatches propagate:

1. Missing/wrong fonts, font weights, assets, and rendering mode.
2. Viewport, root scale, page canvas, containers, and major grid geometry.
3. Component dimensions, padding, gaps, alignment, and wrapping.
4. Typography size, line height, letter spacing, and line breaks.
5. Colors, borders, radii, shadows, filters, and opacity.
6. Icons, local offsets, decorative details, and state-specific polish.

After a root change, recapture the full target. Do not accumulate negative
margins, transforms, or per-element nudges to compensate for a wrong parent.

## 5. Tolerances

No universal raw-pixel threshold proves correctness. Font antialiasing, shadow
rasterization, subpixel placement, and browser/GPU differences can change many
pixels without changing geometry.

Use these rules:

- preserve content, the established capture area, line wrapping, major geometry,
  clipping, and overflow; Figma handoff retains its exact-asset requirements;
- screenshot approximations require named deviations and manual review; an
  available exact asset is never replaced merely for convenience;
- landmarks and box geometry should normally be within 1–2 CSS pixels when
  both renderers expose equivalent geometry;
- choose the screenshot script's per-channel pixel threshold to ignore only
  minor raster noise, not color or position differences;
- choose a maximum mismatch ratio only after inspecting a representative
  verified target in the same environment;
- store the chosen threshold and measured result in the implementation map;
- a threshold pass never overrides a visible structural mismatch;
- a threshold failure caused solely by reviewed rasterization can be recorded
  as `manual` with a precise exception, not silently changed to `verified`.

Masks/exceptions must be bounded to genuinely dynamic content and include a
reason. Never mask navigation, typography, primary layout, or a whole chart
simply because matching it is difficult.

For screenshot reconstruction, aim for high fidelity with roughly 90% perceived
visual resemblance as an aspiration; pursue resemblance approaching 99% when
source quality and available assets permit. Neither is a measured average,
guarantee, or pixel-match score. Never relax automated mismatch ceilings to meet
those labels. A reviewed approximation can pass manual review with listed
deviations; it cannot receive `verified` while nonexact icons, fonts, or media
remain.

## 6. Responsive coverage

For every supplied viewport, perform the full comparison. Also test:

- one width between each adjacent pair of supplied frames;
- the width immediately before and after major layout changes;
- narrow content with long labels and large content where it can affect flow;
- browser zoom/text scaling when accessibility requirements make it relevant.

When only one viewport is supplied, test that exact width plus at least one
narrower width, one wider width or container maximum, and both sides of each
inferred layout breakpoint. Those additional widths are functional/manual, not
pixel-verified, and their mapped fidelity status stays `unverified`.

Intermediate widths without a supplied baseline receive functional/manual review:
no overlap, clipping, unreachable controls, broken hierarchy, or horizontal
overflow. Keep them `unverified`; do not describe inferred widths as pixel-verified.
For an unknown screenshot viewport, record the inferred layout/capture width
before choosing narrower and wider functional checks.

## 7. State coverage

Compare every visually specified state independently. Exercise additional
runtime states functionally even when no visual baseline exists:

- default/loaded;
- hover, focus-visible, active, selected, and disabled where important;
- loading/skeleton;
- empty and partial data;
- validation and server error;
- success/confirmation;
- open dialog/drawer/menu/tooltip;
- permission-limited state;
- light/dark or other modes in scope.

Motion fidelity requires its own capture or interactive review and must respect
reduced motion. A static end-state screenshot does not validate timing/easing.

## 8. Status assignment

Assign:

- `verified` only when a trustworthy local reference and actual capture were
  compared with recorded metrics, critical regions were inspected, and no
  unexplained visible mismatch or nonexact font/icon/media remains;
- `manual` when a reliable side-by-side/overlay review passed but automated
  metrics are unavailable or dominated by known raster differences, or when a
  screenshot reconstruction passed approximate review with listed deviations;
- `unverified` when the UI exists but no reliable comparison occurred;
- `blocked` when source material or a runnable deterministic environment is
  missing.

The implementation map and any detailed report must list status by target.
The concise final response can link to this evidence while surfacing material
gaps. One verified desktop happy-path does not make the whole application
verified.
