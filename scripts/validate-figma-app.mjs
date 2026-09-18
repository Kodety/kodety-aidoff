#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createSourceContract } from "./source-contract.mjs";

const errors = [];
const warnings = [];
const notes = [];
const addError = (message) => errors.push(message);
const addWarning = (message) => warnings.push(message);
const addNote = (message) => notes.push(message);
const slash = (value) => value.split(path.sep).join("/");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const comparatorPath = path.join(scriptDirectory, "compare-screenshots.py");
let packageScripts = null;
const comparisonCache = new Map();
const fingerprintCache = new Map();

function usage(exitCode = 0) {
  const stream = exitCode ? process.stderr : process.stdout;
  stream.write(
    "Usage: node validate-figma-app.mjs /absolute/path/to/app " +
      "[--map /absolute/path/to/implementation.json] [--require-map]\n",
  );
  process.exit(exitCode);
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) usage(0);
  let rootArgument = "";
  let mapArgument = "";
  let requireMap = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--map") {
      if (argv[index + 1] === undefined || argv[index + 1].startsWith("--")) {
        console.error("--map requires a file path");
        usage(2);
      }
      mapArgument = argv[index + 1];
      index += 1;
    } else if (value === "--require-map") {
      requireMap = true;
    } else if (!value.startsWith("-") && !rootArgument) {
      rootArgument = value;
    } else {
      console.error(`Unknown or incomplete argument: ${value}`);
      usage(2);
    }
  }
  if (!rootArgument) usage(2);
  return { rootArgument, mapArgument, requireMap };
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  values.forEach((value) => (seen.has(value) ? repeated.add(value) : seen.add(value)));
  return [...repeated];
}

function insideRoot(root, candidate) {
  return candidate === root || candidate.startsWith(root + path.sep);
}

function walk(directory, realRoot = fs.realpathSync(directory), visited = new Set()) {
  const ignored = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".output",
    "coverage",
    ".cache",
    ".turbo",
    "vendor",
  ]);
  const realDirectory = fs.realpathSync(directory);
  if (!insideRoot(realRoot, realDirectory)) {
    addError(`${slash(directory)}: directory resolves outside the app root`);
    return [];
  }
  if (visited.has(realDirectory)) return [];
  visited.add(realDirectory);
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      let realTarget;
      try {
        realTarget = fs.realpathSync(fullPath);
      } catch (cause) {
        addError(`${slash(fullPath)}: broken symbolic link (${cause.message})`);
        continue;
      }
      if (!insideRoot(realRoot, realTarget)) {
        addError(`${slash(fullPath)}: symbolic link resolves outside the app root`);
        continue;
      }
      const targetStats = fs.statSync(fullPath);
      if (targetStats.isDirectory()) {
        if (entry.name === "artifacts" && path.basename(directory) === ".figma-app") {
          continue;
        }
        results.push(...walk(fullPath, realRoot, visited));
      } else if (targetStats.isFile()) {
        results.push(fullPath);
      }
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name === "artifacts" && path.basename(directory) === ".figma-app") {
        continue;
      }
      results.push(...walk(fullPath, realRoot, visited));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function projectFile(root, relativePath, context, required = true) {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    if (required) addError(`${context}: project-relative path is required`);
    return "";
  }
  if (/^(?:https?:|data:|blob:|file:)/i.test(relativePath)) {
    addError(`${context}: expected a local project-relative path, received ${relativePath}`);
    return "";
  }
  if (path.isAbsolute(relativePath)) {
    addError(`${context}: path must be project-relative: ${relativePath}`);
    return "";
  }
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    addError(`${context}: path leaves the project root: ${relativePath}`);
    return "";
  }
  if (required && !fs.existsSync(absolute)) {
    addError(`${context}: file does not exist: ${relativePath}`);
  } else if (fs.existsSync(absolute) && !fs.statSync(absolute).isFile()) {
    addError(`${context}: path is not a file: ${relativePath}`);
    return "";
  } else if (fs.existsSync(absolute) && !insideRoot(fs.realpathSync(root), fs.realpathSync(absolute))) {
    addError(`${context}: file resolves outside the project root: ${relativePath}`);
    return "";
  }
  return absolute;
}

function projectSourceFile(root, relativePath, context, required = true) {
  const resolved = projectFile(root, relativePath, context, required);
  if (!resolved) return "";
  const segments = slash(path.relative(root, resolved)).split("/");
  const generated = new Set([
    ".figma-app",
    ".next",
    ".nuxt",
    ".output",
    ".svelte-kit",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "vendor",
  ]);
  const forbidden = segments.find((segment) => generated.has(segment));
  if (forbidden) {
    addError(`${context}: authorial source must not live under ${forbidden}`);
    return "";
  }
  return resolved;
}

function projectDirectory(root, relativePath, context) {
  if (typeof relativePath !== "string" || !relativePath.trim() || path.isAbsolute(relativePath)) {
    addError(`${context}: project-relative directory is required`);
    return "";
  }
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    addError(`${context}: directory leaves the project root: ${relativePath}`);
    return "";
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    addError(`${context}: directory does not exist: ${relativePath}`);
    return "";
  }
  if (!insideRoot(fs.realpathSync(root), fs.realpathSync(absolute))) {
    addError(`${context}: directory resolves outside the project root: ${relativePath}`);
    return "";
  }
  return absolute;
}

function comparisonArtifact(root, reportPath, relativePath, context) {
  if (typeof relativePath !== "string" || !relativePath.trim() || path.isAbsolute(relativePath)) {
    addError(`${context}: report-relative artifact path is required`);
    return "";
  }
  const absolute = path.resolve(path.dirname(reportPath), relativePath);
  if (!insideRoot(root, absolute)) {
    addError(`${context}: artifact leaves the project root`);
    return "";
  }
  if (!fs.existsSync(absolute)) {
    addError(`${context}: artifact file does not exist`);
    return "";
  }
  if (fs.lstatSync(absolute).isSymbolicLink()) {
    addError(`${context}: artifact must not be a symbolic link`);
    return "";
  }
  if (!fs.lstatSync(absolute).isFile()) {
    addError(`${context}: artifact path is not a file`);
    return "";
  }
  if (!insideRoot(fs.realpathSync(root), fs.realpathSync(absolute))) {
    addError(`${context}: artifact resolves outside the project root`);
    return "";
  }
  return absolute;
}

function pythonCandidates() {
  if (process.env.FIGMA_APP_PYTHON) {
    return [[process.env.FIGMA_APP_PYTHON]];
  }
  return process.platform === "win32"
    ? [["py", "-3"], ["python"], ["python3"]]
    : [["python3"], ["python"]];
}

function runPython(arguments_) {
  const failures = [];
  for (const [executable, ...prefix] of pythonCandidates()) {
    const result = spawnSync(executable, [...prefix, ...arguments_], {
      encoding: "utf8",
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    if (result.error?.code === "ENOENT") {
      failures.push(`${executable}: not found`);
      continue;
    }
    return result;
  }
  return { status: null, stdout: "", stderr: failures.join("; ") };
}

function fingerprintImage(filePath) {
  const fileHash = sha256(filePath);
  if (fingerprintCache.has(fileHash)) return fingerprintCache.get(fileHash);
  const result = runPython([comparatorPath, "--fingerprint", filePath]);
  if (result.status !== 0) {
    const failure = {
      error:
        `image fingerprint failed (exit ${String(result.status)}): ` +
        `${result.error?.message || result.stderr || result.stdout || "no diagnostic output"}`.trim(),
    };
    fingerprintCache.set(fileHash, failure);
    return failure;
  }
  try {
    const success = { fingerprint: record(JSON.parse(result.stdout)) };
    fingerprintCache.set(fileHash, success);
    return success;
  } catch (cause) {
    const failure = { error: `image fingerprint returned invalid JSON: ${cause.message}` };
    fingerprintCache.set(fileHash, failure);
    return failure;
  }
}

function recomputeComparison(referencePath, actualPath, pixelThreshold, maxMismatchRatio) {
  const cacheKey = [
    sha256(referencePath),
    sha256(actualPath),
    pixelThreshold,
    maxMismatchRatio,
  ].join(":");
  if (comparisonCache.has(cacheKey)) return comparisonCache.get(cacheKey);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "figma-app-compare-"));
  try {
    const result = runPython([
      comparatorPath,
      referencePath,
      actualPath,
      "--output-dir",
      temporary,
      "--pixel-threshold",
      String(pixelThreshold),
      "--max-mismatch-ratio",
      String(maxMismatchRatio),
    ]);
    const computedPath = path.join(temporary, "comparison.json");
    if (result.status !== 0 || !fs.existsSync(computedPath)) {
      const failure = {
        error:
          `independent comparison failed (exit ${String(result.status)}): ` +
          `${result.error?.message || result.stderr || result.stdout || "no diagnostic output"}`.trim(),
      };
      comparisonCache.set(cacheKey, failure);
      return failure;
    }
    const success = { report: record(JSON.parse(fs.readFileSync(computedPath, "utf8"))) };
    comparisonCache.set(cacheKey, success);
    return success;
  } catch (cause) {
    const failure = { error: `independent comparison failed: ${cause.message}` };
    comparisonCache.set(cacheKey, failure);
    return failure;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function containsSensitiveAssignment(value) {
  let decoded = String(value);
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Check the undecoded value when it contains malformed percent escapes.
  }
  return /[?#&](?:access_?token|api_?key|auth|client_?secret|code|credential|jwt|password|private_?key|refresh_?token|secret|session|sig|signature|token)=/i.test(decoded);
}

function routeIdentity(value) {
  try {
    const parsed = new URL(value, "https://app.invalid");
    if (parsed.origin !== "https://app.invalid") return "";
    const hashRoute = parsed.hash.startsWith("#/")
      ? parsed.hash.slice(1).split("?")[0]
      : "";
    const route = hashRoute || parsed.pathname;
    return route.length > 1 && route.endsWith("/") ? route.slice(0, -1) : route;
  } catch {
    return "";
  }
}

function packageScriptName(command) {
  if (typeof command !== "string") return "";
  const match = command
    .trim()
    .match(/^(npm|pnpm|yarn|bun)(?:\s+run)?\s+([A-Za-z0-9:_-]+)(?:\s|$)/);
  if (!match || ["exec", "dlx", "x"].includes(match[2])) return "";
  return match[2];
}

function validatePackageCommand(command, context, required = false) {
  if (!packageScripts) return;
  const scriptName = packageScriptName(command);
  if (!scriptName) {
    if (required) addError(`${context}: command must invoke a package.json script`);
    return;
  }
  if (typeof packageScripts[scriptName] !== "string") {
    addError(`${context}: package.json has no ${scriptName} script`);
  }
}

function isOverbroadFailurePattern(pattern) {
  const probes = [
    "https://alpha.invalid/assets/app.js",
    "http://127.0.0.1:3000/api/metrics",
    "https://cdn.example.net/fonts/ui.woff2",
  ];
  const matches = (value) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  };
  return matches("") || probes.filter(matches).length >= 2;
}

function validatePackage(root) {
  const packagePath = path.join(root, "package.json");
  if (!fs.existsSync(packagePath)) return false;
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch (cause) {
    addError(`package.json: invalid JSON (${cause.message})`);
    return true;
  }
  if (!record(packageJson)) {
    addError("package.json: root must be an object");
    return true;
  }
  const scripts = record(packageJson.scripts) ?? {};
  packageScripts = scripts;
  if (!["dev", "start", "serve"].some((name) => typeof scripts[name] === "string")) {
    addError("package.json: expected a local run script named dev, start, or serve");
  }
  if (typeof scripts.build !== "string") {
    addWarning("package.json: no build script; justify how the production artifact runs");
  }
  if (!["typecheck", "type-check", "check"].some((name) => typeof scripts[name] === "string")) {
    addWarning("package.json: no explicit typecheck/check script");
  }
  if (typeof scripts.lint !== "string") addWarning("package.json: no lint script");
  if (typeof scripts.test !== "string" && !Object.keys(scripts).some((name) => name.startsWith("test:"))) {
    addWarning("package.json: no test script");
  }

  const lockfiles = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
  ].filter((filename) => fs.existsSync(path.join(root, filename)));
  if (!lockfiles.length) addWarning("No package-manager lockfile found at the app root");
  if (lockfiles.length > 1) {
    addWarning(`Multiple package-manager lockfiles found: ${lockfiles.join(", ")}`);
  }
  addNote(`package.json: ${Object.keys(scripts).length} script(s), lockfile ${lockfiles[0] ?? "none"}`);
  return true;
}

function scanDurableSource(root, files) {
  const textExtensions = new Set([
    ".astro",
    ".bash",
    ".css",
    ".dart",
    ".example",
    ".go",
    ".gradle",
    ".graphql",
    ".gql",
    ".html",
    ".js",
    ".jsx",
    ".json",
    ".mjs",
    ".cjs",
    ".php",
    ".properties",
    ".py",
    ".rb",
    ".rs",
    ".scss",
    ".sass",
    ".sh",
    ".svg",
    ".svelte",
    ".toml",
    ".ts",
    ".tsx",
    ".vue",
    ".xml",
    ".yaml",
    ".yml",
  ]);
  const textNames = new Set([
    ".env.example",
    ".env.sample",
    "Containerfile",
    "Dockerfile",
    "Gemfile",
    "Procfile",
  ]);
  let scanned = 0;
  for (const file of files) {
    if (
      !textExtensions.has(path.extname(file).toLowerCase()) &&
      !textNames.has(path.basename(file))
    ) {
      continue;
    }
    if (fs.statSync(file).size > 5 * 1024 * 1024) {
      addWarning(`${slash(path.relative(root, file))}: text file over 5 MB was not scanned`);
      continue;
    }
    const source = fs.readFileSync(file, "utf8");
    const relative = slash(path.relative(root, file));
    scanned += 1;

    if (/https?:\/\/[^\s"')]+\/api\/mcp\/asset\//i.test(source)) {
      addError(`${relative}: expiring Figma MCP asset URL remains in durable source`);
    }
    if (/\bfile:\/\//i.test(source)) {
      addError(`${relative}: file:// URL is not portable`);
    }
    if (/(?:["'`]\/Users\/|[A-Za-z]:\\Users\\)/.test(source)) {
      addError(`${relative}: absolute local user path remains in source`);
    }
    if (/https?:\/\/(?:via\.placeholder\.com|placehold\.co|picsum\.photos|dummyimage\.com)\b/i.test(source)) {
      addWarning(`${relative}: placeholder image service remains in source`);
    }
    if (/\bdata:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]{4096,}/i.test(source)) {
      addWarning(`${relative}: large inlined image; prefer a reviewed local asset`);
    }

    if ([".html", ".jsx", ".tsx", ".vue", ".svelte", ".astro"].includes(path.extname(file).toLowerCase())) {
      for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
        if (!/\balt\s*=/.test(match[0])) {
          addWarning(`${relative}: <img> without alt attribute`);
        }
      }
      for (const match of source.matchAll(/<a\b[^>]*\btarget\s*=\s*["']_blank["'][^>]*>/gi)) {
        if (!/\brel\s*=\s*["'][^"']*\bnoopener\b/i.test(match[0])) {
          addWarning(`${relative}: target=_blank link without rel=noopener`);
        }
      }
    }
  }
  addNote(`Source scan: ${scanned} text file(s)`);
}

const targetStatuses = new Set(["verified", "manual", "unverified", "blocked"]);
const integrationModes = new Set(["real", "mock", "adapter", "blocked"]);
const captureModes = new Set(["viewport", "fullPage", "selector"]);
const captureThemes = new Set(["light", "dark", "no-preference"]);
const reducedMotionModes = new Set(["reduce", "no-preference"]);
const stateSetupKinds = new Set(["none", "fixture-route", "storage-state", "playwright-test"]);
const fontStatuses = new Set(["exact", "system", "blocked"]);
const assetStatuses = new Set(["exact", "substituted", "blocked"]);
const deliveryClaims = new Set([
  "local-functional",
  "production-build-verified",
  "production-integrated",
  "deployed-and-verified",
]);
const deliveryCheckStatuses = new Set(["passed", "blocked", "not-applicable"]);

function validateImplementationMap(root, mapPath) {
  let document;
  try {
    document = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  } catch (cause) {
    addError(`${slash(path.relative(root, mapPath))}: invalid JSON (${cause.message})`);
    return;
  }
  const map = record(document);
  const mapLabel = slash(path.relative(root, mapPath)) || path.basename(mapPath);
  if (!map) {
    addError(`${mapLabel}: root must be an object`);
    return;
  }
  if (map.version !== 1) addError(`${mapLabel}: version must be 1`);

  const app = record(map.app);
  if (!app) {
    addError(`${mapLabel}: app must be an object`);
  } else {
    projectDirectory(root, app.root, `${mapLabel}.app.root`);
    if (app.root !== ".") {
      addError(`${mapLabel}.app.root: must be .; invoke the validator on the actual app subdirectory`);
    }
    if (typeof app.localCommand !== "string" || !app.localCommand.trim()) {
      addError(`${mapLabel}.app.localCommand: non-empty command is required`);
    } else {
      validatePackageCommand(app.localCommand, `${mapLabel}.app.localCommand`);
    }
    if (typeof app.buildCommand !== "string" || !app.buildCommand.trim()) {
      addError(`${mapLabel}.app.buildCommand: non-empty command is required`);
    } else {
      validatePackageCommand(app.buildCommand, `${mapLabel}.app.buildCommand`);
    }
  }

  const sourceContract = createSourceContract(map, root, mapLabel, {
    record, addError, addWarning, projectFile, fingerprintImage, sha256,
    containsSensitiveAssignment, duplicates,
  });
  const rawTargets = Array.isArray(map.targets) ? map.targets : [];
  if (!rawTargets.length) addError(`${mapLabel}: targets must contain at least one target`);
  const targetIds = [];
  const statusCounts = new Map();
  rawTargets.forEach((rawTarget, index) => {
    const target = record(rawTarget);
    const context = `${mapLabel}, targets[${index}]`;
    if (!target) {
      addError(`${context}: must be an object`);
      return;
    }
    if (typeof target.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(target.id)) {
      addError(`${context}: id must use letters, numbers, underscore, or hyphen`);
    } else {
      targetIds.push(target.id);
    }
    sourceContract.validateTarget(target, context);
    if (
      typeof target.route !== "string" ||
      !target.route.startsWith("/") ||
      target.route.startsWith("//") ||
      target.route.includes("?") ||
      target.route.includes("#") ||
      !routeIdentity(target.route)
    ) {
      addError(`${context}: route must be an app-relative pathname without query or fragment`);
    }
    if (typeof target.state !== "string" || !target.state.trim()) {
      addError(`${context}: state is required`);
    }
    if (!captureThemes.has(target.theme)) {
      addError(`${context}: theme must be light, dark, or no-preference`);
    }
    if (typeof target.locale !== "string" || !target.locale.trim()) {
      addError(`${context}: locale is required`);
    }
    if (typeof target.timezone !== "string" || !target.timezone.trim()) {
      addError(`${context}: timezone is required`);
    }
    if (!reducedMotionModes.has(target.reducedMotion)) {
      addError(`${context}: reducedMotion must be reduce or no-preference`);
    }
    const viewport = record(target.viewport);
    if (!viewport) {
      addError(`${context}: viewport must be an object`);
    } else {
      for (const field of ["width", "height"]) {
        if (!Number.isInteger(viewport[field]) || viewport[field] <= 0) {
          addError(`${context}: viewport.${field} must be a positive integer`);
        }
      }
      if (
        viewport.deviceScaleFactor !== undefined &&
        (typeof viewport.deviceScaleFactor !== "number" || viewport.deviceScaleFactor <= 0)
      ) {
        addError(`${context}: viewport.deviceScaleFactor must be positive`);
      }
    }
    const capture = record(target.capture);
    const ignoredFailurePatterns = [];
    if (!capture) {
      addError(`${context}: capture must be an object`);
    } else {
      if (!captureModes.has(capture.mode)) {
        addError(`${context}: capture.mode must be viewport, fullPage, or selector`);
      }
      if (
        typeof capture.path !== "string" ||
        !capture.path.startsWith("/") ||
        capture.path.startsWith("//")
      ) {
        addError(`${context}: capture.path must be an app-relative path starting with /`);
      } else if (containsSensitiveAssignment(capture.path)) {
        addError(`${context}: capture.path appears to contain a credential`);
      } else if (routeIdentity(capture.path) !== routeIdentity(target.route)) {
        addError(`${context}: capture.path resolves to a different route than target.route`);
      }
      if (capture.readySelector !== undefined && typeof capture.readySelector !== "string") {
        addError(`${context}: capture.readySelector must be a string`);
      }
      const setup = record(capture.setup);
      if (!setup || !stateSetupKinds.has(setup.kind)) {
        addError(`${context}: capture.setup.kind must be none, fixture-route, storage-state, or playwright-test`);
      } else if (setup.kind === "fixture-route") {
        if (
          typeof setup.fixtureId !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(setup.fixtureId)
        ) {
          addError(`${context}: fixture-route setup requires a stable fixtureId`);
        }
      } else if (setup.kind === "storage-state") {
        if (typeof setup.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(setup.sha256)) {
          addError(`${context}: storage-state setup requires the non-secret file SHA-256`);
        }
      } else if (setup.kind === "playwright-test") {
        projectSourceFile(root, setup.testFile, `${context}.capture.setup.testFile`, true);
        if (typeof setup.testName !== "string" || setup.testName.trim().length < 4) {
          addError(`${context}: playwright-test setup requires testName`);
        }
      } else {
        if (!/^(?:default|loaded|initial)$/i.test(target.state)) {
          addError(`${context}: non-default state requires a deterministic capture setup`);
        }
        if (/[?&](?:fixture|scenario|visualState)=/i.test(capture.path)) {
          addError(`${context}: fixture/state query requires capture.setup.kind fixture-route`);
        }
      }
      if (capture.mode === "selector") {
        if (typeof capture.selector !== "string" || !capture.selector.trim()) {
          addError(`${context}: selector capture requires capture.selector`);
        }
      }
      sourceContract.validateCapture(target, viewport, capture, context);
      if (!Array.isArray(capture.ignoredRequestFailures)) {
        addError(`${context}: capture.ignoredRequestFailures must be an array`);
      } else {
        capture.ignoredRequestFailures.forEach((rawIgnored, ignoredIndex) => {
          const ignored = record(rawIgnored);
          const ignoredContext = `${context}.capture.ignoredRequestFailures[${ignoredIndex}]`;
          if (!ignored) {
            addError(`${ignoredContext}: must be an object`);
            return;
          }
          const pattern = typeof ignored.pattern === "string" ? ignored.pattern : "";
          const normalized = pattern.replace(/\s+/g, "");
          if (
            !pattern ||
            normalized.length < 4 ||
            [".*", "^.*$", ".+", "^.+$", "^", "$"].includes(normalized)
          ) {
            addError(`${ignoredContext}: pattern is missing or overbroad`);
          } else {
            try {
              const compiled = new RegExp(pattern);
              if (isOverbroadFailurePattern(compiled)) {
                addError(`${ignoredContext}: pattern is overbroad across unrelated origins`);
              } else {
                ignoredFailurePatterns.push(pattern);
              }
            } catch (cause) {
              addError(`${ignoredContext}: invalid regex (${cause.message})`);
            }
          }
          if (typeof ignored.reason !== "string" || ignored.reason.trim().length < 8) {
            addError(`${ignoredContext}: concrete reason is required`);
          }
        });
      }
      if (
        capture.allowHorizontalOverflowReason !== undefined &&
        (typeof capture.allowHorizontalOverflowReason !== "string" ||
          capture.allowHorizontalOverflowReason.trim().length < 8)
      ) {
        addError(`${context}: allowHorizontalOverflowReason must be concrete`);
      }
    }
    if (!targetStatuses.has(target.status)) {
      addError(`${context}: invalid status ${String(target.status)}`);
    } else {
      statusCounts.set(target.status, (statusCounts.get(target.status) ?? 0) + 1);
    }
    if (["verified", "manual"].includes(target.status) && target.referenceKind !== sourceContract.referenceKind) {
      addError(`${context}: verified/manual status requires a ${sourceContract.referenceKind} reference`);
    }
    if (target.referenceKind === "inferred" && target.status !== "unverified") {
      addError(`${context}: inferred responsive targets must remain unverified`);
    }
    if (
      target.status === "blocked" &&
      (typeof target.blockedReason !== "string" || target.blockedReason.trim().length < 8)
    ) {
      addError(`${context}: blocked target requires a concrete blockedReason`);
    }
    if (
      target.status === "unverified" &&
      (typeof target.unverifiedReason !== "string" || target.unverifiedReason.trim().length < 8)
    ) {
      addError(`${context}: unverified target requires a concrete unverifiedReason`);
    }

    const needsArtifacts = target.status === "verified" || target.status === "manual";
    const referencePath = projectFile(
      root,
      target.reference,
      `${context}.reference`,
      needsArtifacts || (sourceContract.screenshotMode && target.referenceKind === "screenshot"),
    );
    sourceContract.validateReference(target, referencePath, context);
    const actualPath = projectFile(
      root,
      target.actual,
      `${context}.actual`,
      needsArtifacts,
    );
    if (
      referencePath &&
      actualPath &&
      fs.existsSync(referencePath) &&
      fs.existsSync(actualPath) &&
      fs.realpathSync(referencePath) === fs.realpathSync(actualPath)
    ) {
      addError(`${context}: reference and actual must be distinct files`);
    }
    if (needsArtifacts) {
      const review = record(target.review);
      if (!review) {
        addError(`${context}: ${target.status} target requires human review evidence`);
      } else {
        if (review.status !== "passed") {
          addError(`${context}: review.status must be passed`);
        }
        if (typeof review.method !== "string" || review.method.trim().length < 5) {
          addError(`${context}: review.method is required`);
        }
        if (
          typeof review.reviewedAt !== "string" ||
          Number.isNaN(Date.parse(review.reviewedAt))
        ) {
          addError(`${context}: review.reviewedAt must be an ISO date`);
        }
        if (typeof review.notes !== "string" || review.notes.trim().length < 12) {
          addError(`${context}: review.notes must describe the inspected result`);
        }
      }
    }

    if (target.status === "verified") {
      if (typeof capture?.readySelector !== "string" || !capture.readySelector.trim()) {
        addError(`${context}: verified target requires capture.readySelector`);
      }
      const diagnosticsPath = projectFile(
        root,
        capture?.diagnostics,
        `${context}.capture.diagnostics`,
        true,
      );
      if (diagnosticsPath && fs.existsSync(diagnosticsPath)) {
        let diagnostics;
        try {
          diagnostics = record(JSON.parse(fs.readFileSync(diagnosticsPath, "utf8")));
        } catch (cause) {
          addError(`${context}: capture diagnostics is invalid JSON (${cause.message})`);
        }
        if (!diagnostics) {
          addError(`${context}: capture diagnostics must contain an object`);
        } else {
          const diagnosticViewport = record(diagnostics.viewport);
          if (
            !diagnosticViewport ||
            diagnosticViewport.width !== viewport?.width ||
            diagnosticViewport.height !== viewport?.height ||
            diagnosticViewport.deviceScaleFactor !== (viewport?.deviceScaleFactor ?? 1)
          ) {
            addError(`${context}: capture diagnostics viewport diverges from target`);
          }
          const diagnosticDimensions = record(diagnostics.dimensions);
          if (
            !diagnosticDimensions ||
            !Number.isFinite(diagnosticDimensions.viewportWidth) ||
            !Number.isFinite(diagnosticDimensions.viewportHeight) ||
            !Number.isFinite(diagnosticDimensions.documentWidth) ||
            !Number.isFinite(diagnosticDimensions.documentHeight) ||
            typeof diagnosticDimensions.horizontalOverflow !== "boolean" ||
            diagnosticDimensions.viewportWidth !== viewport?.width ||
            diagnosticDimensions.viewportHeight !== viewport?.height
          ) {
            addError(`${context}: capture diagnostics dimensions are missing or inconsistent`);
          }
          if (
            diagnostics.theme !== target.theme ||
            diagnostics.locale !== target.locale ||
            diagnostics.timezone !== target.timezone ||
            diagnostics.reducedMotion !== target.reducedMotion
          ) {
            addError(`${context}: capture diagnostics environment diverges from target`);
          }
          if ((diagnostics.readySelector ?? "") !== (capture?.readySelector ?? "")) {
            addError(`${context}: capture diagnostics ready selector diverges from target`);
          }
          const targetSetup = record(capture?.setup);
          const diagnosticSetup = record(diagnostics.stateSetup);
          if (!targetSetup || !diagnosticSetup || diagnosticSetup.kind !== targetSetup.kind) {
            addError(`${context}: capture diagnostics state setup diverges from target`);
          } else if (
            targetSetup.kind === "fixture-route" &&
            diagnosticSetup.fixtureId !== targetSetup.fixtureId
          ) {
            addError(`${context}: capture diagnostics fixture ID diverges from target`);
          } else if (
            targetSetup.kind === "storage-state" &&
            diagnosticSetup.sha256 !== targetSetup.sha256
          ) {
            addError(`${context}: capture diagnostics storage-state hash diverges from target`);
          } else if (
            targetSetup.kind === "playwright-test" &&
            (diagnosticSetup.testFile !== targetSetup.testFile ||
              diagnosticSetup.testName !== targetSetup.testName)
          ) {
            addError(`${context}: capture diagnostics Playwright setup diverges from target`);
          }
          const captureRuntime = record(diagnostics.runtime);
          if (
            !captureRuntime ||
            typeof captureRuntime.kind !== "string" ||
            captureRuntime.kind.trim().length < 4 ||
            typeof captureRuntime.tool !== "string" ||
            captureRuntime.tool.trim().length < 2 ||
            typeof captureRuntime.toolVersion !== "string" ||
            !captureRuntime.toolVersion ||
            typeof captureRuntime.browserVersion !== "string" ||
            !captureRuntime.browserVersion ||
            typeof captureRuntime.platform !== "string" ||
            typeof captureRuntime.arch !== "string" ||
            typeof captureRuntime.userAgent !== "string"
          ) {
            addError(`${context}: capture diagnostics runtime fingerprint is incomplete`);
          }
          if (
            JSON.stringify(diagnostics.ignoredRequestFailurePatterns ?? []) !==
            JSON.stringify(ignoredFailurePatterns)
          ) {
            addError(`${context}: ignored request patterns diverge from capture diagnostics`);
          }
          try {
            const appOriginProbe = `${new URL(diagnostics.url).origin}/__figma_app_probe__`;
            if (
              ignoredFailurePatterns.some((source) => {
                const pattern = new RegExp(source);
                pattern.lastIndex = 0;
                return pattern.test(appOriginProbe);
              })
            ) {
              addError(`${context}: ignored request pattern is overbroad for the app origin`);
            }
          } catch {
            // The URL shape is reported below by the path comparison.
          }
          const overflowReason = capture?.allowHorizontalOverflowReason ?? "";
          if (
            Boolean(diagnostics.allowHorizontalOverflow) !== Boolean(overflowReason) ||
            (diagnostics.horizontalOverflowReason ?? "") !== overflowReason
          ) {
            addError(`${context}: horizontal-overflow exception diverges from diagnostics`);
          }
          let diagnosticPath = "";
          try {
            const parsedUrl = new URL(diagnostics.url);
            diagnosticPath = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
          } catch {
            addError(`${context}: capture diagnostics URL is invalid`);
          }
          if (capture?.path && diagnosticPath !== capture.path) {
            addError(`${context}: capture diagnostics path/state diverges from target`);
          }
          if (capture?.mode === "viewport" && (diagnostics.fullPage || diagnostics.selector)) {
            addError(`${context}: viewport target used a different capture mode`);
          }
          if (capture?.mode === "fullPage" && diagnostics.fullPage !== true) {
            addError(`${context}: fullPage target was not captured full-page`);
          }
          if (
            capture?.mode === "selector" &&
            diagnostics.selector !== capture.selector
          ) {
            addError(`${context}: selector target diagnostics use a different selector`);
          }
          if (actualPath && fs.existsSync(actualPath) && diagnostics.outputSha256 !== sha256(actualPath)) {
            addError(`${context}: actual screenshot hash diverges from capture diagnostics`);
          }
          if (diagnosticDimensions?.horizontalOverflow && !diagnostics.allowHorizontalOverflow) {
            addError(`${context}: capture diagnostics reports horizontal overflow`);
          }
          for (const field of ["consoleErrors", "pageErrors"]) {
            if (!Array.isArray(diagnostics[field]) || diagnostics[field].length) {
              addError(`${context}: capture diagnostics ${field} must be an empty array`);
            }
          }
          if (!Array.isArray(diagnostics.brokenImages) || diagnostics.brokenImages.length) {
            addError(`${context}: capture diagnostics brokenImages must be an empty array`);
          }
          for (const field of ["requestFailures", "responseErrors"]) {
            if (!Array.isArray(diagnostics[field])) {
              addError(`${context}: capture diagnostics has unignored ${field}`);
              continue;
            }
            diagnostics[field].forEach((rawEntry, entryIndex) => {
              const entry = record(rawEntry);
              const entryContext = `${context}.capture.diagnostics.${field}[${entryIndex}]`;
              if (!entry || typeof entry.url !== "string") {
                addError(`${entryContext}: URL-bearing object is required`);
                return;
              }
              const matchesAllowedPattern = ignoredFailurePatterns.some((source) => {
                const pattern = new RegExp(source);
                pattern.lastIndex = 0;
                return pattern.test(entry.url);
              });
              if (entry.ignored !== matchesAllowedPattern) {
                addError(`${entryContext}: ignored flag does not match the declared allowlist`);
              }
              if (!matchesAllowedPattern) {
                addError(`${entryContext}: failure is not covered by a declared narrow pattern`);
              }
            });
          }
        }
      }
      const comparison = record(target.comparison);
      if (!comparison) {
        addError(`${context}: verified target requires comparison metrics`);
      } else {
        if (
          typeof comparison.mismatchRatio !== "number" ||
          comparison.mismatchRatio < 0 ||
          comparison.mismatchRatio > 1
        ) {
          addError(`${context}: comparison.mismatchRatio must be between 0 and 1`);
        }
        if (
          !Number.isInteger(comparison.pixelThreshold) ||
          comparison.pixelThreshold < 0 ||
          comparison.pixelThreshold > 32
        ) {
          addError(`${context}: comparison.pixelThreshold must be an integer from 0 to 32`);
        }
        if (
          typeof comparison.maxMismatchRatio !== "number" ||
          comparison.maxMismatchRatio < 0 ||
          comparison.maxMismatchRatio > 0.05
        ) {
          addError(`${context}: comparison.maxMismatchRatio must be between 0 and 0.05`);
        }
        const reportPath = projectFile(
          root,
          comparison.report,
          `${context}.comparison.report`,
          true,
        );
        if (reportPath && fs.existsSync(reportPath)) {
          let report;
          try {
            report = record(JSON.parse(fs.readFileSync(reportPath, "utf8")));
          } catch (cause) {
            addError(`${context}: comparison report is invalid JSON (${cause.message})`);
          }
          if (!report) {
            addError(`${context}: comparison report must contain an object`);
          } else {
            if (
              report.tool !== "kodety-aidoff/compare-screenshots" ||
              report.version !== 2
            ) {
              addError(`${context}: comparison report has unknown tool provenance/version`);
            }
            if (
              !record(report.runtime) ||
              typeof report.runtime.pythonVersion !== "string" ||
              typeof report.runtime.pillowVersion !== "string"
            ) {
              addError(`${context}: comparison report runtime fingerprint is incomplete`);
            }
            if (report.status !== "passed") {
              addError(`${context}: verified comparison report status must be passed`);
            }
            if (
              typeof report.mismatchRatio !== "number" ||
              Math.abs(report.mismatchRatio - comparison.mismatchRatio) > 1e-12
            ) {
              addError(`${context}: map mismatchRatio diverges from comparison report`);
            }
            if (report.pixelThreshold !== comparison.pixelThreshold) {
              addError(`${context}: map pixelThreshold diverges from comparison report`);
            }
            if (
              typeof report.maxMismatchRatio !== "number" ||
              report.maxMismatchRatio !== comparison.maxMismatchRatio ||
              report.maxMismatchRatio < 0 ||
              report.maxMismatchRatio > 0.05 ||
              report.mismatchRatio > report.maxMismatchRatio
            ) {
              addError(`${context}: comparison report has no matching passing mismatch gate`);
            }
            if (
              !Number.isInteger(report.totalPixels) ||
              report.totalPixels !== report.width * report.height ||
              !Number.isInteger(report.mismatchPixels) ||
              report.mismatchPixels < 0 ||
              report.mismatchPixels > report.totalPixels ||
              Math.abs(
                report.mismatchRatio -
                  (report.totalPixels ? report.mismatchPixels / report.totalPixels : 0),
              ) > 1e-12
            ) {
              addError(`${context}: comparison report pixel arithmetic is inconsistent`);
            }
            if (report.humanReviewRequired !== true) {
              addError(`${context}: comparison report must preserve the human-review requirement`);
            }
            const overlayArtifact = comparisonArtifact(
              root,
              reportPath,
              report.overlay,
              `${context}.comparison.report.overlay`,
            );
            const diffArtifact = comparisonArtifact(
              root,
              reportPath,
              report.diff,
              `${context}.comparison.report.diff`,
            );
            if (
              !/^[a-f0-9]{64}$/i.test(report.overlaySha256 ?? "") ||
              (overlayArtifact && sha256(overlayArtifact) !== report.overlaySha256)
            ) {
              addError(`${context}: comparison overlay hash is missing or stale`);
            }
            if (
              !/^[a-f0-9]{64}$/i.test(report.diffSha256 ?? "") ||
              (diffArtifact && sha256(diffArtifact) !== report.diffSha256)
            ) {
              addError(`${context}: comparison diff hash is missing or stale`);
            }
            for (const [label, artifact, expectedPixelHash] of [
              ["overlay", overlayArtifact, report.overlayPixelSha256],
              ["diff", diffArtifact, report.diffPixelSha256],
            ]) {
              if (!/^[a-f0-9]{64}$/i.test(expectedPixelHash ?? "")) {
                addError(`${context}: comparison ${label} pixel fingerprint is missing`);
                continue;
              }
              if (artifact) {
                const inspected = fingerprintImage(artifact);
                if (
                  inspected.error ||
                  inspected.fingerprint?.pixelSha256 !== expectedPixelHash
                ) {
                  addError(
                    `${context}: comparison ${label} pixels are stale ` +
                      `(${inspected.error ?? "fingerprint mismatch"})`,
                  );
                }
              }
            }
            if (viewport && capture) {
              const expected = sourceContract.expectedPixels(target, viewport);
              if (expected && (report.width !== expected.width || report.height !== expected.height)) {
                addError(
                  `${context}: comparison dimensions ${String(report.width)}x${String(report.height)} ` +
                    `do not match ${sourceContract.referenceKind} source pixels ${expected.width}x${expected.height}`,
                );
              }
            }
            if (referencePath && fs.existsSync(referencePath)) {
              if (report.referenceSha256 !== sha256(referencePath)) {
                addError(`${context}: reference screenshot hash diverges from report`);
              }
            }
            if (actualPath && fs.existsSync(actualPath)) {
              if (report.actualSha256 !== sha256(actualPath)) {
                addError(`${context}: actual screenshot hash diverges from report`);
              }
            }
            if (
              referencePath &&
              actualPath &&
              fs.existsSync(referencePath) &&
              fs.existsSync(actualPath) &&
              Number.isInteger(comparison.pixelThreshold) &&
              typeof comparison.maxMismatchRatio === "number"
            ) {
              const independently = recomputeComparison(
                referencePath,
                actualPath,
                comparison.pixelThreshold,
                comparison.maxMismatchRatio,
              );
              if (independently.error || !independently.report) {
                addError(`${context}: ${independently.error ?? "independent comparison returned no report"}`);
              } else {
                const computed = independently.report;
                for (const field of [
                  "tool",
                  "version",
                  "status",
                  "referenceSha256",
                  "actualSha256",
                  "width",
                  "height",
                  "pixelThreshold",
                  "maxMismatchRatio",
                  "mismatchPixels",
                  "totalPixels",
                  "overlayPixelSha256",
                  "diffPixelSha256",
                ]) {
                  if (computed[field] !== report[field]) {
                    addError(`${context}: report ${field} diverges from independent recomputation`);
                  }
                }
                if (Math.abs(computed.mismatchRatio - report.mismatchRatio) > 1e-12) {
                  addError(`${context}: report mismatchRatio diverges from independent recomputation`);
                }
              }
            }
          }
        }
      }
    }

    if (target.exceptions !== undefined && !Array.isArray(target.exceptions)) {
      addError(`${context}: exceptions must be an array`);
    } else {
      if (target.status === "verified" && (target.exceptions ?? []).length) {
        addError(`${context}: verified targets cannot carry undiscounted visual exceptions`);
      }
      (target.exceptions ?? []).forEach((rawException, exceptionIndex) => {
        const exception = record(rawException);
        const exceptionContext = `${context}.exceptions[${exceptionIndex}]`;
        if (!exception) {
          addError(`${exceptionContext}: must be an object`);
          return;
        }
        const hasSelector = typeof exception.selector === "string" && exception.selector.trim();
        const rect = record(exception.rect);
        const hasRect =
          rect &&
          Number.isFinite(rect.x) &&
          Number.isFinite(rect.y) &&
          Number.isFinite(rect.width) &&
          rect.width > 0 &&
          Number.isFinite(rect.height) &&
          rect.height > 0;
        if (Boolean(hasSelector) === Boolean(hasRect)) {
          addError(`${exceptionContext}: provide exactly one bounded selector or rect`);
        }
        if (typeof exception.reason !== "string" || exception.reason.trim().length < 8) {
          addError(`${exceptionContext}: a concrete reason is required`);
        }
      });
    }
  });
  duplicates(targetIds).forEach((id) => addError(`${mapLabel}: duplicate target id ${id}`));
  sourceContract.validateCoverage();

  if (map.components !== undefined && !Array.isArray(map.components)) {
    addError(`${mapLabel}: components must be an array`);
  } else {
    (map.components ?? []).forEach((rawComponent, index) => {
      const component = record(rawComponent);
      const context = `${mapLabel}, components[${index}]`;
      if (!component) {
        addError(`${context}: must be an object`);
        return;
      }
      if (typeof component.name !== "string" || !component.name.trim()) {
        addError(`${context}: name is required`);
      }
      sourceContract.validateAttribution(component, context);
      projectSourceFile(root, component.code, `${context}.code`, true);
      if (component.variants !== undefined && !Array.isArray(component.variants)) {
        addError(`${context}: variants must be an array`);
      }
    });
  }

  if (map.assets !== undefined && !Array.isArray(map.assets)) {
    addError(`${mapLabel}: assets must be an array`);
  } else {
    (map.assets ?? []).forEach((rawAsset, index) => {
      const asset = record(rawAsset);
      const context = `${mapLabel}, assets[${index}]`;
      if (!asset) {
        addError(`${context}: must be an object`);
        return;
      }
      sourceContract.validateAttribution(asset, context);
      if (!Array.isArray(asset.targetIds) || !asset.targetIds.length) {
        addError(`${context}: targetIds must be a non-empty array`);
      } else {
        asset.targetIds.forEach((targetId) => {
          if (typeof targetId !== "string" || !targetIds.includes(targetId)) {
            addError(`${context}: targetIds must reference known targets`);
          }
        });
        duplicates(asset.targetIds).forEach((targetId) =>
          addError(`${context}: duplicate targetId ${targetId}`),
        );
      }
      if (!assetStatuses.has(asset.status)) {
        addError(`${context}: status must be exact, substituted, or blocked`);
      }
      const assetPath = projectSourceFile(
        root,
        asset.path,
        `${context}.path`,
        asset.status !== "blocked",
      );
      if (asset.status === "exact") {
        if (typeof asset.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(asset.sha256)) {
          addError(`${context}: exact asset requires a SHA-256 hash`);
        } else if (assetPath && fs.existsSync(assetPath) && sha256(assetPath) !== asset.sha256.toLowerCase()) {
          addError(`${context}: asset SHA-256 does not match current bytes`);
        }
      } else if (typeof asset.reason !== "string" || asset.reason.trim().length < 8) {
        addError(`${context}: ${String(asset.status)} asset requires a concrete reason`);
      }
      if (
        asset.status !== "exact" &&
        Array.isArray(asset.targetIds) &&
        rawTargets.some(
          (target) =>
            record(target)?.status === "verified" && asset.targetIds.includes(target.id),
        )
      ) {
        addError(`${context}: non-exact asset is incompatible with its verified targets`);
      }
    });
  }

  if (!Array.isArray(map.fonts) || !map.fonts.length) {
    addError(`${mapLabel}: fonts must inventory at least one font family`);
  } else {
    map.fonts.forEach((rawFont, index) => {
      const font = record(rawFont);
      const context = `${mapLabel}, fonts[${index}]`;
      if (!font) {
        addError(`${context}: must be an object`);
        return;
      }
      if (typeof font.family !== "string" || !font.family.trim()) {
        addError(`${context}: family is required`);
      }
      if (!Array.isArray(font.targetIds) || !font.targetIds.length) {
        addError(`${context}: targetIds must be a non-empty array`);
      } else {
        font.targetIds.forEach((targetId) => {
          if (typeof targetId !== "string" || !targetIds.includes(targetId)) {
            addError(`${context}: targetIds must reference known targets`);
          }
        });
        duplicates(font.targetIds).forEach((targetId) =>
          addError(`${context}: duplicate targetId ${targetId}`),
        );
      }
      if (!Array.isArray(font.weights) || !font.weights.length) {
        addError(`${context}: weights must be a non-empty array`);
      }
      if (!Array.isArray(font.styles) || !font.styles.length) {
        addError(`${context}: styles must be a non-empty array`);
      }
      const substitutedFont = sourceContract.screenshotMode && font.status === "substituted";
      if (!fontStatuses.has(font.status) && !substitutedFont) {
        addError(`${context}: status must be exact, system, ${sourceContract.screenshotMode ? "substituted, " : ""}or blocked`);
        return;
      }
      if (font.status === "exact") {
        const fontPath = projectSourceFile(root, font.path, `${context}.path`, true);
        if (typeof font.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(font.sha256)) {
          addError(`${context}: exact font requires a SHA-256 hash`);
        } else if (fontPath && fs.existsSync(fontPath) && sha256(fontPath) !== font.sha256.toLowerCase()) {
          addError(`${context}: font SHA-256 does not match current bytes`);
        }
      } else {
        const rationale = [font.notes, ...(substitutedFont ? [font.reason] : [])];
        if (!rationale.some((value) => typeof value === "string" && value.trim().length >= 8)) {
          addError(`${context}: ${font.status} font requires concrete notes${substitutedFont ? " or reason" : ""}`);
        }
      }
      if (
        ["blocked", "substituted"].includes(font.status) &&
        Array.isArray(font.targetIds) &&
        rawTargets.some(
          (target) =>
            record(target)?.status === "verified" && font.targetIds.includes(target.id),
        )
      ) {
        addError(`${context}: ${font.status} font is incompatible with its verified targets`);
      }
    });
  }

  const integrations = [];
  const integrationNames = [];
  if (map.integrations !== undefined && !Array.isArray(map.integrations)) {
    addError(`${mapLabel}: integrations must be an array`);
  } else {
    (map.integrations ?? []).forEach((rawIntegration, index) => {
      const integration = record(rawIntegration);
      const context = `${mapLabel}, integrations[${index}]`;
      if (!integration) {
        addError(`${context}: must be an object`);
        return;
      }
      if (typeof integration.name !== "string" || !integration.name.trim()) {
        addError(`${context}: name is required`);
      } else {
        integrationNames.push(integration.name);
      }
      if (!integrationModes.has(integration.mode)) {
        addError(`${context}: invalid mode ${String(integration.mode)}`);
      }
      if (typeof integration.requiredForProduction !== "boolean") {
        addError(`${context}: requiredForProduction must be boolean`);
      }
      projectSourceFile(root, integration.boundary, `${context}.boundary`, integration.mode !== "blocked");
      if (
        integration.mode === "blocked" &&
        (typeof integration.notes !== "string" || integration.notes.trim().length < 8)
      ) {
        addError(`${context}: blocked integration requires concrete notes`);
      }
      const verification = record(integration.verification);
      if (integration.mode === "real") {
        if (!verification) {
          addError(`${context}: real integration requires verification evidence`);
        } else {
          if (verification.status !== "passed") {
            addError(`${context}: real integration verification.status must be passed`);
          }
          if (typeof verification.method !== "string" || verification.method.trim().length < 5) {
            addError(`${context}: real integration verification.method is required`);
          }
          if (typeof verification.notes !== "string" || verification.notes.trim().length < 12) {
            addError(`${context}: real integration verification.notes must describe exercised paths`);
          }
          if (typeof verification.check !== "string" || !verification.check.trim()) {
            addError(`${context}: real integration verification.check must name a delivery check`);
          }
        }
      } else if (verification?.status === "passed") {
        addError(`${context}: only a real integration can carry passed verification`);
      }
      integrations.push(integration);
    });
  }
  duplicates(integrationNames).forEach((name) =>
    addError(`${mapLabel}: duplicate integration name ${name}`),
  );

  const passedChecks = new Set();
  const deliveryChecks = new Map();
  const delivery = record(map.delivery);
  if (!delivery) {
    addError(`${mapLabel}: delivery must be an object`);
  } else {
    if (!deliveryClaims.has(delivery.claim)) {
      addError(`${mapLabel}.delivery.claim: invalid claim ${String(delivery.claim)}`);
    }
    const checks = Array.isArray(delivery.checks) ? delivery.checks : [];
    if (!checks.length) addError(`${mapLabel}.delivery.checks: at least one check is required`);
    const checkNames = [];
    checks.forEach((rawCheck, index) => {
      const check = record(rawCheck);
      const context = `${mapLabel}, delivery.checks[${index}]`;
      if (!check) {
        addError(`${context}: must be an object`);
        return;
      }
      if (typeof check.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(check.name)) {
        addError(`${context}: name must be lowercase letters, numbers, or hyphens`);
      } else {
        checkNames.push(check.name);
        deliveryChecks.set(check.name, check);
      }
      if (!deliveryCheckStatuses.has(check.status)) {
        addError(`${context}: status must be passed, blocked, or not-applicable`);
      } else if (check.status === "passed") {
        passedChecks.add(check.name);
      }
      if (typeof check.command !== "string" || !check.command.trim()) {
        addError(`${context}: concrete command or verification action is required`);
      } else {
        validatePackageCommand(check.command, `${context}.command`);
      }
      if (typeof check.notes !== "string" || check.notes.trim().length < 8) {
        addError(`${context}: concrete notes are required`);
      }
      if (check.status === "passed") {
        const evidence = record(check.evidence);
        if (!evidence) {
          addError(`${context}: passed check requires evidence`);
        } else {
          if (evidence.exitCode !== 0) {
            addError(`${context}: evidence.exitCode must be 0`);
          }
          if (
            typeof evidence.checkedAt !== "string" ||
            Number.isNaN(Date.parse(evidence.checkedAt))
          ) {
            addError(`${context}: evidence.checkedAt must be an ISO date`);
          }
          if (typeof evidence.method !== "string" || evidence.method.trim().length < 4) {
            addError(`${context}: evidence.method is required`);
          }
        }
      }
    });
    duplicates(checkNames).forEach((name) =>
      addError(`${mapLabel}.delivery.checks: duplicate check ${name}`),
    );

    const productionClaim = [
      "production-build-verified",
      "production-integrated",
      "deployed-and-verified",
    ].includes(delivery.claim);
    if (delivery.claim === "local-functional" && !passedChecks.has("smoke")) {
      addError(`${mapLabel}.delivery: local-functional requires a passed smoke check`);
    }
    if (productionClaim) {
      for (const checkName of [
        "typecheck",
        "lint",
        "test",
        "accessibility",
        "build",
        "smoke",
      ]) {
        const check = deliveryChecks.get(checkName);
        if (!check) {
          addError(`${mapLabel}.delivery: ${delivery.claim} requires a ${checkName} check`);
        } else if (["build", "smoke", "accessibility"].includes(checkName)) {
          if (check.status !== "passed") {
            addError(`${mapLabel}.delivery: ${delivery.claim} requires a passed ${checkName} check`);
          }
        } else if (!["passed", "not-applicable"].includes(check.status)) {
          addError(`${mapLabel}.delivery: ${checkName} must pass or be concretely not applicable`);
        }
      }
      const buildCheck = deliveryChecks.get("build");
      if (
        buildCheck &&
        typeof app?.buildCommand === "string" &&
        buildCheck.command.trim().replace(/\s+/g, " ") !==
          app.buildCommand.trim().replace(/\s+/g, " ")
      ) {
        addError(`${mapLabel}.delivery: build check command must match app.buildCommand`);
      }
    }
    if (["production-integrated", "deployed-and-verified"].includes(delivery.claim)) {
      integrations
        .filter((integration) => integration.requiredForProduction === true)
        .forEach((integration) => {
          const verification = record(integration.verification);
          if (
            integration.mode !== "real" ||
            verification?.status !== "passed" ||
            !passedChecks.has(verification?.check)
          ) {
            addError(
              `${mapLabel}.delivery: ${delivery.claim} requires production integration ${String(integration.name)} to be real and verified`,
            );
          }
        });
    }
    if (delivery.claim === "deployed-and-verified") {
      if (!passedChecks.has("deployment")) {
        addError(`${mapLabel}.delivery: deployed-and-verified requires a passed deployment check`);
      }
      try {
        const deploymentUrl = new URL(delivery.deploymentUrl);
        if (
          deploymentUrl.protocol !== "https:" ||
          deploymentUrl.username ||
          deploymentUrl.password ||
          containsSensitiveAssignment(delivery.deploymentUrl)
        ) {
          throw new Error("not a safe HTTPS URL");
        }
      } catch {
        addError(`${mapLabel}.delivery.deploymentUrl: a verified HTTPS URL is required`);
      }
    }
  }

  integrations
    .filter((integration) => integration.mode === "real")
    .forEach((integration) => {
      const verification = record(integration.verification);
      if (!passedChecks.has(verification?.check)) {
        addError(
          `${mapLabel}: real integration ${String(integration.name)} must reference a passed delivery check`,
        );
      }
    });

  if (!Array.isArray(map.intentionalDeviations)) {
    addError(`${mapLabel}: intentionalDeviations must be an array`);
  } else {
    map.intentionalDeviations.forEach((rawDeviation, index) => {
      const deviation = record(rawDeviation);
      const context = `${mapLabel}, intentionalDeviations[${index}]`;
      if (!deviation) {
        addError(`${context}: must be an object`);
        return;
      }
      if (typeof deviation.targetId !== "string" || !targetIds.includes(deviation.targetId)) {
        addError(`${context}: targetId must reference a target`);
      }
      if (typeof deviation.reason !== "string" || deviation.reason.trim().length < 8) {
        addError(`${context}: concrete reason is required`);
      }
    });
  }

  const countSummary = [...statusCounts.entries()]
    .map(([status, count]) => `${status}=${count}`)
    .join(", ");
  addNote(`${mapLabel}: ${rawTargets.length} target(s)${countSummary ? ` (${countSummary})` : ""}`);
}

const { rootArgument, mapArgument, requireMap } = parseArguments(process.argv.slice(2));
const root = path.resolve(rootArgument);
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`App directory does not exist: ${root}`);
  process.exit(2);
}

const files = walk(root);
const recognizedManifests = [
  "package.json",
  "pyproject.toml",
  "composer.json",
  "Gemfile",
  "go.mod",
  "Cargo.toml",
  "pubspec.yaml",
].filter((filename) => fs.existsSync(path.join(root, filename)));
if (!recognizedManifests.length) {
  addError("No recognized application manifest found at the supplied app root");
} else {
  addNote(`Application manifest(s): ${recognizedManifests.join(", ")}`);
}

validatePackage(root);
scanDurableSource(root, files);

let mapPath = "";
if (mapArgument) {
  mapPath = path.resolve(mapArgument);
  if (!fs.existsSync(mapPath) || !fs.statSync(mapPath).isFile()) {
    addError(`Explicit implementation map does not exist: ${mapPath}`);
    mapPath = "";
  }
} else {
  const defaultMap = path.join(root, ".figma-app", "implementation.json");
  if (fs.existsSync(defaultMap)) mapPath = defaultMap;
}

if (mapPath) {
  validateImplementationMap(root, mapPath);
} else if (requireMap) {
  addError("Implementation map is required for this validation run");
} else {
  addWarning("No implementation map found; multi-screen/state fidelity coverage is unverified");
}

errors.forEach((message) => console.error(`ERROR ${message}`));
warnings.forEach((message) => console.warn(`WARN  ${message}`));
notes.forEach((message) => console.log(`OK    ${message}`));
console.log(
  `\nFigma app preflight: ${errors.length} error(s), ${warnings.length} warning(s), ${files.length} file(s).`,
);
process.exit(errors.length ? 1 : 0);
