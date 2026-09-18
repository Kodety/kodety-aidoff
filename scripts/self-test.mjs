#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validator = path.join(skillRoot, "scripts", "validate-figma-app.mjs");
const comparator = path.join(skillRoot, "scripts", "compare-screenshots.py");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kodety-aidoff-self-test-"));
const appRoot = path.join(tempRoot, "app");

const sha256 = (filePath) =>
  crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

function write(relativePath, contents, encoding = "utf8") {
  const destination = path.join(appRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, contents, encoding);
  return destination;
}

function run(command, args, cwd = appRoot) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
}

function runPython(args, cwd = appRoot) {
  const candidates = process.env.FIGMA_APP_PYTHON
    ? [[process.env.FIGMA_APP_PYTHON]]
    : process.platform === "win32"
      ? [["py", "-3"], ["python"], ["python3"]]
      : [["python3"], ["python"]];
  for (const [executable, ...prefix] of candidates) {
    const result = run(executable, [...prefix, ...args], cwd);
    if (result.error?.code !== "ENOENT") return result;
  }
  return { status: null, stdout: "", stderr: "No Python interpreter found" };
}

try {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const reference = write(".figma-app/artifacts/reference.png", png, undefined);
  const actual = write(".figma-app/artifacts/actual.png", png, undefined);
  const actualHash = sha256(actual);
  const asset = write("src/assets/mark.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
  write("src/components/Card.js", "export const Card = () => null;\n");
  write("src/data/metrics.js", "export const metrics = [];\n");
  write("package-lock.json", '{"name":"fixture","lockfileVersion":3}\n');
  write(
    "package.json",
    JSON.stringify(
      {
        name: "kodety-aidoff-fixture",
        private: true,
        scripts: {
          dev: "node -e \"process.exit(0)\"",
          build: "node -e \"process.exit(0)\"",
          typecheck: "node -e \"process.exit(0)\"",
          lint: "node -e \"process.exit(0)\"",
          test: "node -e \"process.exit(0)\"",
          "test:a11y": "node -e \"process.exit(0)\"",
          "test:integration": "node -e \"process.exit(0)\"",
          preview: "node -e \"process.exit(0)\"",
        },
      },
      null,
      2,
    ) + "\n",
  );

  const comparisonDirectory = path.join(appRoot, ".figma-app", "artifacts", "comparison");
  const comparison = runPython([
    comparator,
    reference,
    actual,
    "--output-dir",
    comparisonDirectory,
    "--pixel-threshold",
    "16",
    "--max-mismatch-ratio",
    "0",
  ]);
  assert.equal(
    comparison.status,
    0,
    `comparator failed:\n${comparison.stdout}${comparison.stderr}`,
  );

  write(
    ".figma-app/artifacts/actual.diagnostics.json",
    JSON.stringify(
      {
        url: "http://127.0.0.1:3000/#/dashboard?visualState=loaded",
        output: ".figma-app/artifacts/actual.png",
        outputSha256: actualHash,
        viewport: { width: 1, height: 1, deviceScaleFactor: 1 },
        locale: "en-US",
        timezone: "UTC",
        theme: "light",
        reducedMotion: "reduce",
        readySelector: "[data-visual-ready]",
        fullPage: false,
        selector: null,
        customBrowserExecutable: false,
        allowHorizontalOverflow: false,
        horizontalOverflowReason: null,
        ignoredRequestFailurePatterns: [],
        stateSetup: { kind: "fixture-route", fixtureId: "dashboard-loaded" },
        runtime: {
          kind: "browser-automation",
          tool: "playwright",
          toolVersion: "fixture-1.0.0",
          browserVersion: "Fixture Chromium 1",
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          userAgent: "FixtureBrowser/1.0",
        },
        dimensions: {
          viewportWidth: 1,
          viewportHeight: 1,
          documentWidth: 1,
          documentHeight: 1,
          horizontalOverflow: false,
        },
        consoleErrors: [],
        pageErrors: [],
        requestFailures: [],
        responseErrors: [],
        brokenImages: [],
      },
      null,
      2,
    ) + "\n",
  );

  const map = {
    version: 1,
    figma: {
      fileUrl: "https://www.figma.com/design/FILE/Fixture?node-id=10-20",
      fileKey: "FILE",
      branchKey: "",
      version: "fixture-v1",
      nodes: [
        {
          nodeId: "10:20",
          name: "Dashboard / Desktop / Loaded",
          frameSize: { width: 1, height: 1 },
        },
      ],
    },
    app: {
      root: ".",
      localCommand: "npm run dev",
      buildCommand: "npm run build",
    },
    targets: [
      {
        id: "dashboard-desktop-loaded",
        nodeId: "10:20",
        referenceKind: "figma",
        route: "/dashboard",
        state: "loaded",
        theme: "light",
        locale: "en-US",
        timezone: "UTC",
        reducedMotion: "reduce",
        viewport: { width: 1, height: 1, deviceScaleFactor: 1 },
        capture: {
          mode: "viewport",
          path: "/#/dashboard?visualState=loaded",
          setup: { kind: "fixture-route", fixtureId: "dashboard-loaded" },
          readySelector: "[data-visual-ready]",
          diagnostics: ".figma-app/artifacts/actual.diagnostics.json",
          ignoredRequestFailures: [],
        },
        reference: ".figma-app/artifacts/reference.png",
        actual: ".figma-app/artifacts/actual.png",
        status: "verified",
        comparison: {
          mismatchRatio: 0,
          pixelThreshold: 16,
          maxMismatchRatio: 0,
          report: ".figma-app/artifacts/comparison/comparison.json",
        },
        review: {
          status: "passed",
          method: "overlay-and-diff",
          reviewedAt: "2026-08-25T18:00:00.000Z",
          notes: "Reference, actual, overlay, and changed regions inspected",
        },
        exceptions: [],
      },
    ],
    components: [
      {
        figmaNodeId: "11:1",
        name: "Card",
        code: "src/components/Card.js",
        variants: ["default"],
      },
    ],
    assets: [
      {
        figmaNodeId: "12:4",
        targetIds: ["dashboard-desktop-loaded"],
        path: "src/assets/mark.svg",
        kind: "svg",
        status: "exact",
        sha256: sha256(asset),
      },
    ],
    fonts: [
      {
        family: "Arial",
        targetIds: ["dashboard-desktop-loaded"],
        weights: [400],
        styles: ["normal"],
        status: "system",
        notes: "Pinned system font in the deterministic capture environment",
      },
    ],
    integrations: [
      {
        name: "metrics",
        mode: "real",
        requiredForProduction: true,
        boundary: "src/data/metrics.js",
        notes: "Deterministic fixture boundary",
        verification: {
          status: "passed",
          method: "integration-test",
          check: "integration-metrics",
          notes: "Success and failure behavior exercised in the fixture",
        },
      },
    ],
    delivery: {
      claim: "production-integrated",
      checks: [
        {
          name: "typecheck",
          command: "npm run typecheck",
          status: "passed",
          notes: "Fixture typecheck completed",
          evidence: { exitCode: 0, checkedAt: "2026-08-25T18:00:00.000Z", method: "command-exit" },
        },
        {
          name: "lint",
          command: "npm run lint",
          status: "passed",
          notes: "Fixture lint completed",
          evidence: { exitCode: 0, checkedAt: "2026-08-25T18:01:00.000Z", method: "command-exit" },
        },
        {
          name: "test",
          command: "npm test",
          status: "passed",
          notes: "Fixture tests completed",
          evidence: { exitCode: 0, checkedAt: "2026-08-25T18:02:00.000Z", method: "command-exit" },
        },
        {
          name: "accessibility",
          command: "npm run test:a11y",
          status: "passed",
          notes: "Fixture accessibility checks completed",
          evidence: { exitCode: 0, checkedAt: "2026-08-25T18:03:00.000Z", method: "automated-review" },
        },
        {
          name: "build",
          command: "npm run build",
          status: "passed",
          notes: "Optimized fixture build completed",
          evidence: { exitCode: 0, checkedAt: "2026-08-25T18:04:00.000Z", method: "command-exit" },
        },
        {
          name: "smoke",
          command: "npm run preview",
          status: "passed",
          notes: "Built route and deep link exercised",
          evidence: { exitCode: 0, checkedAt: "2026-08-25T18:05:00.000Z", method: "browser-smoke" },
        },
        {
          name: "integration-metrics",
          command: "npm run test:integration",
          status: "passed",
          notes: "Fixture integration paths exercised",
          evidence: { exitCode: 0, checkedAt: "2026-08-25T18:06:00.000Z", method: "integration-test" },
        },
      ],
    },
    intentionalDeviations: [],
  };
  const mapPath = write(
    ".figma-app/implementation.json",
    JSON.stringify(map, null, 2) + "\n",
  );

  const validation = run(process.execPath, [validator, appRoot, "--require-map"]);
  assert.equal(
    validation.status,
    0,
    `valid fixture was rejected:\n${validation.stdout}${validation.stderr}`,
  );
  assert.match(validation.stdout, /0 error\(s\), 0 warning\(s\)/);

  const diagnosticsPath = path.join(
    appRoot,
    ".figma-app",
    "artifacts",
    "actual.diagnostics.json",
  );
  const alternateDiagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, "utf8"));
  alternateDiagnostics.runtime.tool = "chrome-cdp";
  alternateDiagnostics.runtime.toolVersion = "fixture-cdp-1.0.0";
  fs.writeFileSync(diagnosticsPath, JSON.stringify(alternateDiagnostics, null, 2) + "\n");
  const alternateRuntime = run(process.execPath, [validator, appRoot, "--require-map"]);
  assert.equal(
    alternateRuntime.status,
    0,
    `tool-agnostic browser evidence was rejected:\n${alternateRuntime.stdout}${alternateRuntime.stderr}`,
  );

  function expectMap(label, candidate, expectedStatus, diagnostic) {
    fs.writeFileSync(mapPath, JSON.stringify(candidate, null, 2) + "\n");
    const result = run(process.execPath, [validator, appRoot, "--require-map"]);
    assert.equal(result.status, expectedStatus, `${label}:\n${result.stdout}${result.stderr}`);
    if (diagnostic) assert.match(result.stderr, diagnostic, label);
  }

  const screenshotMap = structuredClone(map);
  screenshotMap.sourceMode = "screenshot";
  delete screenshotMap.figma;
  screenshotMap.screenshots = [{
    id: "dashboard-reference",
    name: "Supplied dashboard screenshot",
    path: ".figma-app/artifacts/reference.png",
    sha256: sha256(reference),
    pixelSize: { width: 1, height: 1 },
  }];
  screenshotMap.targets[0].sourceId = "dashboard-reference";
  screenshotMap.targets[0].referenceKind = "screenshot";
  delete screenshotMap.targets[0].nodeId;
  for (const entry of [...screenshotMap.components, ...screenshotMap.assets]) {
    entry.sourceId = "dashboard-reference";
    delete entry.figmaNodeId;
  }
  expectMap("verified screenshot", screenshotMap, 0);

  const manualScreenshot = structuredClone(screenshotMap);
  manualScreenshot.targets[0].status = "manual";
  delete manualScreenshot.targets[0].comparison;
  delete manualScreenshot.targets[0].capture.diagnostics;
  expectMap("manual screenshot", manualScreenshot, 0);

  const inferredScreenshot = structuredClone(manualScreenshot);
  inferredScreenshot.targets[0].referenceKind = "inferred";
  inferredScreenshot.targets[0].status = "unverified";
  inferredScreenshot.targets[0].unverifiedReason = "No supplied narrow viewport reference";
  inferredScreenshot.targets[0].viewport.width = 320;
  expectMap("inferred screenshot layout remains unverified", inferredScreenshot, 0);

  const keylineScreenshot = structuredClone(manualScreenshot);
  keylineScreenshot.assets[0].status = "substituted";
  keylineScreenshot.assets[0].reason = "Keyline icon chosen because the original vector was not supplied";
  keylineScreenshot.fonts[0].status = "substituted";
  delete keylineScreenshot.fonts[0].notes;
  keylineScreenshot.fonts[0].reason = "Closest available font; exact reference font was not supplied";
  expectMap("manual screenshot with documented substitutions", keylineScreenshot, 0);
  const verifiedSubstitutions = structuredClone(screenshotMap);
  verifiedSubstitutions.assets = structuredClone(keylineScreenshot.assets);
  verifiedSubstitutions.fonts = structuredClone(keylineScreenshot.fonts);
  expectMap("verified substituted assets", verifiedSubstitutions, 1, /non-exact asset is incompatible/);
  expectMap("verified substituted fonts", verifiedSubstitutions, 1, /substituted font is incompatible/);

  const screenshotRejections = [
    ["wrong source hash", (candidate) => { candidate.screenshots[0].sha256 = "0".repeat(64); }, /screenshot SHA-256 does not match/],
    ["wrong pixel dimensions", (candidate) => { candidate.screenshots[0].pixelSize.width = 2; }, /pixelSize does not match decoded/],
    ["unknown source ID", (candidate) => { candidate.targets[0].sourceId = "missing"; }, /sourceId must reference screenshots/],
    ["swapped reference", (candidate) => { candidate.targets[0].reference = ".figma-app/artifacts/actual.png"; }, /reference must use the registered screenshot source path/],
    ["duplicate source ID", (candidate) => { candidate.screenshots.push(structuredClone(candidate.screenshots[0])); }, /duplicate screenshot id/],
    ["uncovered source", (candidate) => { candidate.screenshots.push({ ...candidate.screenshots[0], id: "uncovered" }); }, /Screenshot source has no target/],
    ["missing source image", (candidate) => { candidate.screenshots[0].path = "missing.png"; }, /file does not exist/],
    ["missing actual image", (candidate) => { delete candidate.targets[0].actual; }, /actual: project-relative path is required/],
    ["missing human review", (candidate) => { delete candidate.targets[0].review; }, /requires human review evidence/],
    ["fabricated Figma object", (candidate) => { candidate.figma = structuredClone(map.figma); }, /must not contain a figma object/],
    ["fabricated Figma node", (candidate) => { candidate.targets[0].nodeId = "10:20"; }, /nodeId is not allowed/],
    ["invalid component attribution", (candidate) => { candidate.components[0].sourceId = "missing"; }, /sourceId must reference screenshots/],
    ["invalid asset attribution", (candidate) => { candidate.assets[0].sourceId = "missing"; }, /sourceId must reference screenshots/],
    ["manual viewport mismatch", (candidate) => { candidate.targets[0].viewport.width = 2; }, /viewport must match the screenshot pixelSize/],
    ["manual DPR mismatch", (candidate) => { candidate.targets[0].viewport.deviceScaleFactor = 2; }, /viewport must match the screenshot pixelSize/],
    ["inferred target cannot be manual", (candidate) => { candidate.targets[0].referenceKind = "inferred"; }, /inferred responsive targets must remain unverified/],
  ];
  for (const [label, mutate, diagnostic] of screenshotRejections) {
    const candidate = structuredClone(manualScreenshot);
    mutate(candidate);
    expectMap(label, candidate, 1, diagnostic);
  }

  const relaxedScreenshot = structuredClone(screenshotMap);
  relaxedScreenshot.targets[0].comparison.maxMismatchRatio = 0.1;
  expectMap("screenshot mismatch ceiling unchanged", relaxedScreenshot, 1, /maxMismatchRatio must be between 0 and 0.05/);
  const unexplainedFont = structuredClone(keylineScreenshot);
  delete unexplainedFont.fonts[0].reason;
  expectMap("font substitution requires rationale", unexplainedFont, 1, /substituted font requires concrete notes or reason/);

  const retinaReference = write(".figma-app/artifacts/retina-reference.png", png, undefined);
  const retinaActual = write(".figma-app/artifacts/retina-actual.png", png, undefined);
  const retinaImages = runPython([
    "-c",
    "import sys; from PIL import Image; image = Image.new('RGBA', (2, 2), (0, 0, 0, 255)); [image.save(file) for file in sys.argv[1:]]",
    retinaReference,
    retinaActual,
  ]);
  assert.equal(retinaImages.status, 0, retinaImages.stderr);
  const retinaComparison = runPython([
    comparator, retinaReference, retinaActual, "--output-dir",
    path.join(appRoot, ".figma-app", "artifacts", "retina-comparison"),
    "--pixel-threshold", "16", "--max-mismatch-ratio", "0",
  ]);
  assert.equal(retinaComparison.status, 0, retinaComparison.stderr);
  const retinaMap = structuredClone(screenshotMap);
  retinaMap.screenshots[0].path = ".figma-app/artifacts/retina-reference.png";
  retinaMap.screenshots[0].sha256 = sha256(retinaReference);
  retinaMap.screenshots[0].pixelSize = { width: 2, height: 2 };
  retinaMap.targets[0].viewport.deviceScaleFactor = 2;
  retinaMap.targets[0].reference = retinaMap.screenshots[0].path;
  retinaMap.targets[0].actual = ".figma-app/artifacts/retina-actual.png";
  retinaMap.targets[0].comparison.report = ".figma-app/artifacts/retina-comparison/comparison.json";
  retinaMap.targets[0].capture.diagnostics = ".figma-app/artifacts/retina-actual.diagnostics.json";
  const retinaDiagnostics = structuredClone(alternateDiagnostics);
  retinaDiagnostics.output = retinaMap.targets[0].actual;
  retinaDiagnostics.outputSha256 = sha256(retinaActual);
  retinaDiagnostics.viewport.deviceScaleFactor = 2;
  write(retinaMap.targets[0].capture.diagnostics, JSON.stringify(retinaDiagnostics, null, 2) + "\n");
  expectMap("verified screenshot uses source pixels at DPR 2", retinaMap, 0);

  const figmaRejections = [
    ["missing Figma object", (candidate) => { delete candidate.figma; }, /figma must be an object/],
    ["missing Figma node", (candidate) => { delete candidate.targets[0].nodeId; }, /nodeId must reference figma.nodes/],
    ["unknown source mode", (candidate) => { candidate.sourceMode = "unknown"; }, /sourceMode must be figma or screenshot/],
    ["null source mode", (candidate) => { candidate.sourceMode = null; }, /sourceMode must be figma or screenshot/],
    ["screenshots require explicit mode", (candidate) => { candidate.screenshots = screenshotMap.screenshots; }, /screenshots require sourceMode screenshot/],
    ["screenshot target in default mode", (candidate) => { candidate.targets[0].referenceKind = "screenshot"; }, /referenceKind must be figma or inferred/],
    ["screenshot source ID in default mode", (candidate) => { candidate.targets[0].sourceId = "dashboard-reference"; }, /sourceId is not allowed in figma mode/],
    ["substituted Figma font", (candidate) => { candidate.fonts = keylineScreenshot.fonts; }, /status must be exact, system, or blocked/],
    ["verified Figma asset substitution", (candidate) => { candidate.assets[0].status = "substituted"; candidate.assets[0].reason = "Substitute glyph from another icon library"; }, /non-exact asset is incompatible/],
  ];
  for (const [label, mutate, diagnostic] of figmaRejections) {
    const candidate = structuredClone(map);
    mutate(candidate);
    expectMap(label, candidate, 1, diagnostic);
  }
  expectMap("explicit Figma mode preserves original contract", { ...map, sourceMode: "figma" }, 0);

  map.integrations[0].verification.status = "failed";
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2) + "\n");
  const falseClaim = run(process.execPath, [validator, appRoot, "--require-map"]);
  assert.equal(falseClaim.status, 1, "false production-integrated claim was accepted");
  assert.match(falseClaim.stderr, /verification\.status must be passed/);

  const sameInput = runPython([comparator, reference, reference]);
  assert.equal(sameInput.status, 2, "comparator accepted one file as both inputs");
  const unsafeThreshold = runPython([
    comparator,
    reference,
    actual,
    "--pixel-threshold",
    "255",
  ]);
  assert.equal(unsafeThreshold.status, 2, "comparator accepted an unsafe threshold");
  const invalidImage = write(".figma-app/artifacts/invalid.png", "not an image\n");
  const invalidImageResult = runPython([comparator, reference, invalidImage]);
  assert.equal(invalidImageResult.status, 2, "comparator did not control invalid-image failure");
  assert.doesNotMatch(invalidImageResult.stderr, /Traceback|\/Users\/|[A-Za-z]:\\/);

  const sample = fs.readFileSync(
    path.join(skillRoot, "references", "implementation-map.md"),
    "utf8",
  );
  const sampleMatch = sample.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(sampleMatch, "implementation-map JSON sample was not found");
  JSON.parse(sampleMatch[1]);

  const nullPackageRoot = path.join(tempRoot, "null-package");
  fs.mkdirSync(nullPackageRoot);
  fs.writeFileSync(path.join(nullPackageRoot, "package.json"), "null\n");
  const nullPackage = run(process.execPath, [validator, nullPackageRoot], nullPackageRoot);
  assert.equal(nullPackage.status, 1);
  assert.match(nullPackage.stderr, /package\.json: root must be an object/);
  assert.doesNotMatch(nullPackage.stderr, /TypeError|at validatePackage/);

  console.log("kodety-aidoff self-test: passed");
} catch (error) {
  console.error(`kodety-aidoff self-test: failed\n${error.stack ?? error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
