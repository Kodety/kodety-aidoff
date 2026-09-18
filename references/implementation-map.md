# Implementation map

Use the implementation map to keep Figma frames or supplied screenshots,
runtime routes, UI states, assets, and verification results referentially complete. It is the portable
ledger for the task; it is not application configuration.

For work spanning multiple screens, states, or viewports, store it at:

```text
.figma-app/implementation.json
```

Keep screenshots and generated diffs out of the production bundle. They may
live under `.figma-app/artifacts/` or another ignored project-relative QA
directory. Working copies may stay in the task directory, but copy final
evidence into the app before validation because the validator intentionally
rejects paths outside the app root. Do not record Figma access tokens, signed
asset URLs, API credentials, user data, or other secrets.

## Figma schema

`sourceMode` is optional and defaults to `figma` for existing maps. Explicit
`"sourceMode": "figma"` uses the same contract. Screenshot reconstruction uses
the separate source fields described below; never insert fabricated Figma IDs.

```json
{
  "version": 1,
  "figma": {
    "fileUrl": "https://www.figma.com/design/FILE/NAME?node-id=10-20",
    "fileKey": "FILE",
    "branchKey": "",
    "version": "2026-08-25T17:42:11.000Z",
    "nodes": [
      {
        "nodeId": "10:20",
        "name": "Dashboard / Desktop / Loaded",
        "frameSize": { "width": 1440, "height": 1024 }
      }
    ]
  },
  "app": {
    "root": ".",
    "localCommand": "npm run dev",
    "buildCommand": "npm run build"
  },
  "targets": [
    {
      "id": "dashboard-desktop-loaded",
      "nodeId": "10:20",
      "referenceKind": "figma",
      "route": "/dashboard",
      "state": "loaded",
      "theme": "light",
      "locale": "en-US",
      "timezone": "UTC",
      "reducedMotion": "reduce",
      "viewport": {
        "width": 1440,
        "height": 1024,
        "deviceScaleFactor": 1
      },
      "capture": {
        "mode": "viewport",
        "path": "/dashboard?visualState=loaded",
        "setup": {
          "kind": "fixture-route",
          "fixtureId": "dashboard-loaded"
        },
        "readySelector": "[data-visual-ready=\"dashboard-loaded\"]",
        "diagnostics": ".figma-app/artifacts/dashboard-actual.diagnostics.json",
        "ignoredRequestFailures": []
      },
      "reference": ".figma-app/artifacts/dashboard-reference.png",
      "actual": ".figma-app/artifacts/dashboard-actual.png",
      "status": "verified",
      "comparison": {
        "mismatchRatio": 0.0012,
        "pixelThreshold": 16,
        "maxMismatchRatio": 0.005,
        "report": ".figma-app/artifacts/dashboard-comparison/comparison.json"
      },
      "review": {
        "status": "passed",
        "method": "overlay-and-diff",
        "reviewedAt": "2026-08-25T18:00:00.000Z",
        "notes": "Critical layout, typography, assets, and changed regions reviewed"
      },
      "exceptions": []
    }
  ],
  "components": [
    {
      "figmaNodeId": "11:1",
      "name": "MetricCard",
      "code": "src/components/MetricCard.tsx",
      "variants": ["default", "positive", "negative", "loading"]
    }
  ],
  "assets": [
    {
      "figmaNodeId": "12:4",
      "targetIds": ["dashboard-desktop-loaded"],
      "path": "src/assets/brand-mark.svg",
      "kind": "svg",
      "status": "exact",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ],
  "fonts": [
    {
      "family": "Inter",
      "targetIds": ["dashboard-desktop-loaded"],
      "weights": [400, 600, 700],
      "styles": ["normal"],
      "status": "exact",
      "path": "src/assets/fonts/inter-latin.woff2",
      "sha256": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
    }
  ],
  "integrations": [
    {
      "name": "metrics",
      "mode": "real",
      "requiredForProduction": true,
      "boundary": "src/data/metrics.ts",
      "notes": "Server endpoint supplied by the repository",
      "verification": {
        "status": "passed",
        "method": "integration-test",
        "check": "integration-metrics",
        "notes": "Success and server-error paths exercised"
      }
    }
  ],
  "delivery": {
    "claim": "production-build-verified",
    "checks": [
      {
        "name": "typecheck",
        "command": "npm run typecheck",
        "status": "passed",
        "notes": "Application types passed",
        "evidence": {
          "exitCode": 0,
          "checkedAt": "2026-08-25T18:05:00.000Z",
          "method": "command-exit"
        }
      },
      {
        "name": "lint",
        "command": "npm run lint",
        "status": "passed",
        "notes": "Repository lint passed",
        "evidence": {
          "exitCode": 0,
          "checkedAt": "2026-08-25T18:06:00.000Z",
          "method": "command-exit"
        }
      },
      {
        "name": "test",
        "command": "npm test",
        "status": "passed",
        "notes": "Unit and component tests passed",
        "evidence": {
          "exitCode": 0,
          "checkedAt": "2026-08-25T18:07:00.000Z",
          "method": "command-exit"
        }
      },
      {
        "name": "accessibility",
        "command": "npm run test:a11y",
        "status": "passed",
        "notes": "Automated and keyboard accessibility checks passed",
        "evidence": {
          "exitCode": 0,
          "checkedAt": "2026-08-25T18:08:00.000Z",
          "method": "automated-and-manual"
        }
      },
      {
        "name": "build",
        "command": "npm run build",
        "status": "passed",
        "notes": "Optimized build completed",
        "evidence": {
          "exitCode": 0,
          "checkedAt": "2026-08-25T18:09:00.000Z",
          "method": "command-exit"
        }
      },
      {
        "name": "smoke",
        "command": "npm run preview",
        "status": "passed",
        "notes": "Built dashboard and deep link exercised",
        "evidence": {
          "exitCode": 0,
          "checkedAt": "2026-08-25T18:10:00.000Z",
          "method": "browser-smoke"
        }
      },
      {
        "name": "integration-metrics",
        "command": "npm run test:integration",
        "status": "passed",
        "notes": "Metrics boundary success and failure paths exercised",
        "evidence": {
          "exitCode": 0,
          "checkedAt": "2026-08-25T18:11:00.000Z",
          "method": "integration-test"
        }
      }
    ]
  },
  "intentionalDeviations": []
}
```

## Screenshot schema

For screenshot-only reconstruction set `sourceMode` to `screenshot` and replace
`figma` with `screenshots`. Each screenshot has a unique `id`, `name`, local
canonical reference `path`, the file's actual SHA-256, and decoded native
`pixelSize`. Keep original-image and crop details in its `notes` when relevant.
The canonical reference is the image actually compared, never a scaled image.

Targets use `sourceId` instead of `nodeId`, and `referenceKind` is `screenshot`
for supplied baselines or `inferred` for additional widths/states. Components
and assets use `sourceId` instead of `figmaNodeId`. Each source must have a
target. Supplied targets must bind their `reference` to the registered source
path; replacing the source image invalidates existing evidence.

This example starts unverified. Replace the illustrative image hash, paths,
dimensions, commands, and assumptions with real project evidence before
validation; the zero hash is not a valid claim about a source file.

```json
{
  "version": 1,
  "sourceMode": "screenshot",
  "screenshots": [
    {
      "id": "dashboard-print",
      "name": "Supplied dashboard screenshot",
      "path": ".figma-app/artifacts/dashboard-reference.png",
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "pixelSize": { "width": 1440, "height": 1024 },
      "notes": "Original supplied image; no crop. CSS viewport and DPR unknown; working hypothesis is DPR 1."
    }
  ],
  "app": {
    "root": ".",
    "localCommand": "npm run dev",
    "buildCommand": "npm run build"
  },
  "targets": [
    {
      "id": "dashboard-desktop-loaded",
      "sourceId": "dashboard-print",
      "referenceKind": "screenshot",
      "route": "/dashboard",
      "state": "loaded",
      "theme": "light",
      "locale": "en-US",
      "timezone": "UTC",
      "reducedMotion": "reduce",
      "viewport": { "width": 1440, "height": 1024, "deviceScaleFactor": 1 },
      "capture": {
        "mode": "viewport",
        "path": "/dashboard?visualState=loaded",
        "setup": { "kind": "fixture-route", "fixtureId": "dashboard-loaded" },
        "readySelector": "[data-visual-ready=\"dashboard-loaded\"]",
        "ignoredRequestFailures": []
      },
      "reference": ".figma-app/artifacts/dashboard-reference.png",
      "status": "unverified",
      "unverifiedReason": "Reconstruction has not yet been captured and compared."
    }
  ],
  "components": [
    {
      "sourceId": "dashboard-print",
      "name": "MetricCard",
      "code": "src/components/MetricCard.tsx",
      "variants": ["default"]
    }
  ],
  "assets": [
    {
      "sourceId": "dashboard-print",
      "targetIds": ["dashboard-desktop-loaded"],
      "path": "src/icons/Search.tsx",
      "kind": "svg",
      "status": "substituted",
      "reason": "Original screenshot glyph unavailable; closest genuine Keyline search glyph used."
    }
  ],
  "fonts": [
    {
      "family": "system-ui",
      "targetIds": ["dashboard-desktop-loaded"],
      "weights": [400, 600],
      "styles": ["normal"],
      "status": "substituted",
      "notes": "Original screenshot typeface is unidentified; a local system font approximates its metrics."
    }
  ],
  "integrations": [],
  "delivery": { "claim": "local-functional", "checks": [] },
  "intentionalDeviations": [
    {
      "targetId": "dashboard-desktop-loaded",
      "reason": "Screenshot-only reconstruction uses the documented Keyline icon and font substitutions."
    }
  ]
}
```

- Screenshot mode does not require Figma tools, URLs, or node IDs. It must not
  bypass a missing Figma source when the task is a Figma handoff.
- Record fonts as `substituted` with concrete notes when their exact identity
  is unknown; this status is screenshot-only. Genuine system-font use with a
  known source can still use the existing `system` status.
- Keyline fallbacks are `substituted` assets, never exact matches inferred
  from a name. Record the real package/version or official SVG source, glyph,
  style, and target IDs in the asset's notes/reason.
- Non-exact assets and substituted/blocked fonts prevent `verified` for
  their affected targets. A reviewed approximation can be `manual` with local
  reference/actual captures, human review, and the deviations recorded.
- `verified` retains the existing diagnostic, comparison, human-review, and
  threshold gates. Reference dimensions come from native `pixelSize`; viewport
  captures must match `viewport × DPR`. Full-page and selector captures must
  represent the same supplied region. Unknown original DPR stays an assumption.
- Inferred targets remain `unverified` and carry an `unverifiedReason`, even
  when their functionality passes. The maintainer's 90% to near-99% resemblance
  reports with OpenAI Astra at Medium or higher never override statuses,
  thresholds, or recorded substitutions.
- For mixed Figma and screenshot tasks, use a separate map per mode and run
  the validator with `--map` and `--require-map` on each. Unknown source modes
  are invalid; keep one mode's rules from weakening the other.

## Required fields and identities

- `version` is `1`.
- `app.root` is `.`. Invoke the validator on the actual app directory (for a
  monorepo, the relevant package/app subdirectory); `localCommand` and
  `buildCommand` are concrete, non-empty commands verified for that root.
- In Figma mode, `figma.fileUrl` is node-specific, `fileKey` is recorded, and `version` holds
  an immutable version or last-modified marker so source changes can invalidate
  prior verification.
- In Figma mode, `figma.nodes` records every frame/node used as a visual target baseline. Node
  IDs use canonical colon form when available, and every listed baseline maps
  to a target. Component and asset source nodes stay in their own entries and
  need not become screen targets. `frameSize` records the natural Figma width
  and height; comparison pixels must equal that size times the capture DPR.
- Each target has a stable, unique `id` and maps exactly one visual reference
  to one route, runtime state, theme, and viewport.
- In Figma mode, `referenceKind` is `figma` for supplied visual baselines and `inferred` for
  extra responsive widths. Inferred targets stay `unverified`, include an
  `unverifiedReason`, and receive functional overflow/interaction review rather
  than a fabricated pixel claim.
- `theme`, `locale`, `timezone`, and `reducedMotion` (`reduce` or
  `no-preference`) are explicit and must match the capture diagnostics.
- `viewport.width` and `viewport.height` are positive integers in CSS pixels.
  `deviceScaleFactor` is positive and defaults to `1` for reproducibility.
- `capture.mode` is `viewport`, `fullPage`, or `selector`. `capture.path`
  records the deterministic, non-secret route/query used to reach the state;
  `capture.readySelector` identifies app readiness. `selector` mode also
  requires `capture.selector`. A verified target links the capture script's
  diagnostics file so viewport, state path, runtime errors, overflow, and the
  actual screenshot hash can be read back. Known third-party request failures
  use narrowly scoped `{ "pattern", "reason" }` entries in
  `ignoredRequestFailures`; catch-all patterns are invalid. Intentional
  page-level horizontal overflow requires `allowHorizontalOverflowReason`.
- `capture.setup.kind` is `none`, `fixture-route`, `storage-state`, or
  `playwright-test` and must match the diagnostics. Fixture routes record a
  stable fixture ID. Storage state records only its SHA-256, never secret
  session contents or a durable credential path. Project-specific browser
  setup records the local test file and test name. Non-default states cannot
  use `none`.
- `status` is one of `verified`, `manual`, `unverified`, or `blocked`.
  A blocked target includes a concrete `blockedReason`.
  An unverified target includes `unverifiedReason` and the next verification
  boundary in its notes/handoff.
- `reference`, `actual`, and `comparison.report` are project-relative paths
  when those artifacts exist locally. Do not use temporary signed URLs.
- A verified target records `comparison.mismatchRatio`, `pixelThreshold`, and
  the chosen `maxMismatchRatio`; all three must match its passed report. The
  safety ceilings in the bundled tools prevent a meaningless all-pixels pass,
  but the project threshold still requires human justification. The validator
  recomputes the pixels and checks the overlay/diff hashes instead of trusting
  report arithmetic alone.
- `verified` and `manual` targets include a passed human `review` with method,
  timestamp, and concrete notes. Automated metrics never self-approve a target.
- Every exception names a bounded region and a concrete reason. A whole-screen
  mask or a generic “dynamic content” exception is invalid. Use exactly one
  local selector or `{x,y,width,height}` rectangle. Because the bundled
  comparator does not mask regions, targets with exceptions are `manual`, not
  `verified`.
- Component and asset paths point to authorial source files, never generated
  build output.
- Every asset and font records non-empty `targetIds` so evidence and blockers
  apply only to the visual targets that actually use it.
- Assets are `exact`, `substituted`, or `blocked`. Non-exact assets include a
  reason and prevent `verified` status for their target IDs. An exact asset
  includes the SHA-256 of the downloaded bytes. This
  proves that later edits did not silently replace it; it does not by itself
  prove that the original download came from the intended Figma node.
- `fonts` inventories every family/weight/style used by their targets. `exact`
  fonts use a local path and SHA-256; `system` fonts explain the pinned capture
  environment; `blocked` fonts include a reason and prevent verified fidelity
  only for the targets named by that font entry. Screenshot mode additionally
  permits `substituted` fonts with notes, also preventing verified fidelity.
- `integrations[].mode` is `real`, `mock`, `adapter`, or `blocked`. Use `real`
  only after exercising the actual boundary. A blocked integration includes a
  concrete explanation in `notes`. Every entry marks
  `requiredForProduction`; a real entry records passed verification evidence
  and names the corresponding passed delivery check.
- Target status measures visual fidelity. Integration mode measures operational
  reality; neither status implies the other.
- `delivery.claim` is `local-functional`, `production-build-verified`,
  `production-integrated`, or `deployed-and-verified`. Production build claims
  inventory `typecheck`, `lint`, `test`, `accessibility`, `build`, and `smoke`.
  Applicable checks pass with timestamped exit evidence; genuinely inapplicable
  typecheck/lint/test gates are explicit. Build, browser smoke, and
  accessibility must pass. The build command matches `app.buildCommand`.
  Integrated/deployed claims also require every production-required
  integration to be real and linked to a passed verification check.
- `intentionalDeviations` is an array of `{ "targetId", "reason" }` objects;
  each reason identifies a bounded accessibility, safety, performance, or
  platform decision, or a documented screenshot source limitation or
  reconstruction approximation.

## Inventory procedure

1. Record file, branch/version marker, source nodes, and natural frame sizes
   for Figma, or screenshot identities, paths, hashes, and native pixel sizes.
2. Split a design into testable targets by route, modal/overlay, state, theme,
   and viewport. A desktop loaded screen and a mobile empty screen are two
   targets.
   Record how each state is reached: a safe fixture query/route, a ready
   selector, storage state, or a project-specific browser test. Never put
   credentials in the capture path.
3. Map shared visual components to their existing or intended source component.
   Preserve variants that affect layout, semantics, or runtime state.
4. Inventory exact assets, their hashes, and font families/weights. In Figma
   handoff, a missing font or source asset becomes an explicit blocker. In
   screenshot reconstruction, record permitted substitutions and unresolved
   assets explicitly; do not hide either.
5. Record data boundaries and whether each is real, mocked, adapted, or
   blocked, whether it is required for production, and how a real boundary was
   exercised.
6. Update status and comparison metrics only after the corresponding artifact
   and test actually exist.

## Coverage rules

- Every in-scope Figma frame appears in `figma.nodes` and at least one target.
- Every in-scope screenshot appears in `screenshots` and at least one target
  when the map uses screenshot mode.
- Every in-scope route/state/viewpoint combination appears as its own target.
- Every target has an implementation outcome; do not delete a blocked target
  to make the report green.
- Repeated UI maps to one source component where the product semantics match.
- All exact Figma assets are local before a target becomes `verified`.
- A `verified` target has a `passed` comparison report whose screenshot hashes,
  mismatch ratio, and pixel threshold match the map.
- Only deterministic content is used for visual comparison. Dynamic regions
  need narrowly scoped, justified exceptions.
- If the Figma changed during implementation, update its version marker and
  invalidate affected `verified` targets until they are compared again.

The bundled validator checks the structural portion of this contract. It does
not prove that a listed screenshot depicts the correct route or state; browser
verification remains required.
