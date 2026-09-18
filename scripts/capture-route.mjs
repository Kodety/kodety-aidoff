#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { createRequire } from "node:module";

function usage(exitCode = 0) {
  const stream = exitCode ? process.stderr : process.stdout;
  stream.write(`Usage:
  node capture-route.mjs --url http://127.0.0.1:3000/dashboard \\
    --output /path/dashboard.png --width 1440 --height 1024 [options]

Options:
  --root PATH              App root whose installed Playwright should be used
  --dpr NUMBER             Device scale factor (default: 1)
  --locale LOCALE          Browser locale (default: en-US)
  --timezone TIMEZONE      Browser timezone (default: UTC)
  --theme VALUE            light, dark, or no-preference (default: light)
  --reduced-motion VALUE   reduce or no-preference (default: reduce)
  --wait-for SELECTOR      Wait for a deterministic ready element
  --wait-ms NUMBER         Extra settle time after fonts/images (default: 250)
  --selector SELECTOR      Capture one element instead of the viewport/page
  --storage-state PATH     Existing Playwright storage-state JSON
  --fixture-id ID          Stable ID for a fixture route/query state
  --browser-executable PATH
                           Optional installed Chromium/Chrome executable
  --full-page              Capture the full document instead of the viewport
  --allow-horizontal-overflow REASON
                           Permit intentional page overflow with a concrete reason
  --ignore-request-failure REGEX
                           Ignore one known failed/HTTP-error URL pattern; repeatable
  --help                   Show this help
`);
  process.exit(exitCode);
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) usage(0);
  const values = {
    root: process.cwd(),
    url: "",
    output: "",
    width: 0,
    height: 0,
    dpr: 1,
    locale: "en-US",
    timezone: "UTC",
    theme: "light",
    reducedMotion: "reduce",
    waitFor: "",
    waitMs: 250,
    selector: "",
    storageState: "",
    fixtureId: "",
    browserExecutable: "",
    fullPage: false,
    horizontalOverflowReason: "",
    ignoreRequestFailures: [],
  };
  const valueOptions = new Map([
    ["--root", "root"],
    ["--url", "url"],
    ["--output", "output"],
    ["--width", "width"],
    ["--height", "height"],
    ["--dpr", "dpr"],
    ["--locale", "locale"],
    ["--timezone", "timezone"],
    ["--theme", "theme"],
    ["--reduced-motion", "reducedMotion"],
    ["--wait-for", "waitFor"],
    ["--wait-ms", "waitMs"],
    ["--selector", "selector"],
    ["--storage-state", "storageState"],
    ["--fixture-id", "fixtureId"],
    ["--browser-executable", "browserExecutable"],
    ["--allow-horizontal-overflow", "horizontalOverflowReason"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--full-page") {
      values.fullPage = true;
      continue;
    }
    if (option === "--ignore-request-failure") {
      if (argv[index + 1] === undefined) {
        console.error("--ignore-request-failure requires a regular expression");
        usage(2);
      }
      values.ignoreRequestFailures.push(argv[index + 1]);
      index += 1;
      continue;
    }
    const key = valueOptions.get(option);
    if (!key || argv[index + 1] === undefined) {
      console.error(`Unknown or incomplete option: ${option}`);
      usage(2);
    }
    values[key] = argv[index + 1];
    index += 1;
  }
  values.width = Number(values.width);
  values.height = Number(values.height);
  values.dpr = Number(values.dpr);
  values.waitMs = Number(values.waitMs);
  return values;
}

function safeUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return `${parsed.protocol}[REDACTED]`;
    }
    parsed.username = "";
    parsed.password = "";
    const sensitive = /(?:access_?token|api_?key|auth|client_?secret|code|credential|jwt|password|private_?key|refresh_?token|secret|session|sig|signature|token)/i;
    for (const key of [...parsed.searchParams.keys()]) {
      if (sensitive.test(key)) parsed.searchParams.set(key, "[REDACTED]");
    }
    const redactedHash = parsed.hash.replace(
      /([#?&])([^=&#]+)=([^&#]*)/g,
      (match, separator, rawKey) => {
        let key = rawKey;
        try {
          key = decodeURIComponent(rawKey);
        } catch {
          // Preserve malformed fragments while still checking their raw key.
        }
        return sensitive.test(key)
          ? `${separator}${rawKey}=[REDACTED]`
          : match;
      },
    );
    return `${parsed.origin}${parsed.pathname}${parsed.search}${redactedHash}`;
  } catch {
    return "invalid-url";
  }
}

function redactText(value) {
  return String(value)
    .replace(/https?:\/\/[^\s)\]}]+/gi, (url) => safeUrl(url))
    .replace(
      /\b(access_?token|api_?key|auth|client_?secret|credential|jwt|password|private_?key|refresh_?token|secret|session|signature|token)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    )
    .slice(0, 2000);
}

function portablePath(root, filePath) {
  const relative = path.relative(root, filePath);
  if (relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join("/");
  }
  return path.basename(filePath);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
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

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const root = path.resolve(args.root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`App root does not exist: ${root}`);
  }
  if (!/^https?:\/\//i.test(args.url)) {
    throw new Error("--url must be an http(s) URL");
  }
  if (!args.output) throw new Error("--output is required");
  if (path.extname(args.output).toLowerCase() !== ".png") {
    throw new Error("--output must use a .png extension");
  }
  if (!Number.isInteger(args.width) || args.width <= 0) {
    throw new Error("--width must be a positive integer");
  }
  if (!Number.isInteger(args.height) || args.height <= 0) {
    throw new Error("--height must be a positive integer");
  }
  if (!Number.isFinite(args.dpr) || args.dpr <= 0) {
    throw new Error("--dpr must be positive");
  }
  if (!Number.isFinite(args.waitMs) || args.waitMs < 0 || args.waitMs > 60_000) {
    throw new Error("--wait-ms must be between 0 and 60000");
  }
  if (!["light", "dark", "no-preference"].includes(args.theme)) {
    throw new Error("--theme must be light, dark, or no-preference");
  }
  if (!["reduce", "no-preference"].includes(args.reducedMotion)) {
    throw new Error("--reduced-motion must be reduce or no-preference");
  }
  if (args.selector && args.fullPage) {
    throw new Error("--selector and --full-page are mutually exclusive");
  }
  if (args.fixtureId && args.storageState) {
    throw new Error("--fixture-id and --storage-state are mutually exclusive state setup modes");
  }
  if (args.fixtureId && !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(args.fixtureId)) {
    throw new Error("--fixture-id must be a stable 2-128 character identifier");
  }
  if (
    args.horizontalOverflowReason &&
    args.horizontalOverflowReason.trim().length < 8
  ) {
    throw new Error("--allow-horizontal-overflow requires a concrete reason");
  }
  const ignoredRequestPatterns = args.ignoreRequestFailures.map((value) => {
    const normalized = value.replace(/\s+/g, "");
    if ([".*", "^.*$", ".+", "^.+$", "^", "$"].includes(normalized) || normalized.length < 4) {
      throw new Error(`Overbroad --ignore-request-failure regex is not allowed: ${value}`);
    }
    try {
      const pattern = new RegExp(value);
      if (isOverbroadFailurePattern(pattern)) {
        throw new Error(`Overbroad --ignore-request-failure regex is not allowed: ${value}`);
      }
      return pattern;
    } catch (cause) {
      throw new Error(`Invalid --ignore-request-failure regex ${value}: ${cause.message}`);
    }
  });
  const appOriginProbe = `${new URL(args.url).origin}/__figma_app_probe__`;
  if (
    ignoredRequestPatterns.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(appOriginProbe);
    })
  ) {
    throw new Error("--ignore-request-failure must not suppress the app's whole origin");
  }

  const packagePath = path.join(root, "package.json");
  if (!fs.existsSync(packagePath)) {
    throw new Error(`package.json not found at app root: ${root}`);
  }
  const projectRequire = createRequire(packagePath);
  let playwright;
  let playwrightPackage = "";
  try {
    playwright = projectRequire("playwright");
    playwrightPackage = "playwright";
  } catch {
    try {
      playwright = projectRequire("@playwright/test");
      playwrightPackage = "@playwright/test";
    } catch (cause) {
      throw new Error(
        "Neither playwright nor @playwright/test is installed in the target " +
          "project. Use existing browser tooling or add Playwright only when " +
          "appropriate and authorized.",
        { cause },
      );
    }
  }
  if (!playwright?.chromium) {
    throw new Error(
      "The target project's Playwright package does not expose chromium.",
    );
  }
  let playwrightVersion = "unresolved";
  try {
    playwrightVersion = projectRequire(`${playwrightPackage}/package.json`).version;
  } catch {
    // Some package managers hide package.json exports; package identity is still recorded.
  }

  const output = path.resolve(args.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const outputParts = path.parse(output);
  const diagnosticsPath = path.join(
    outputParts.dir,
    `${outputParts.name}.diagnostics.json`,
  );
  for (const [label, destination] of [
    ["screenshot output", output],
    ["diagnostics output", diagnosticsPath],
  ]) {
    if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) {
      throw new Error(`Refusing to write ${label} through a symbolic link: ${destination}`);
    }
    if (fs.existsSync(destination) && !fs.lstatSync(destination).isFile()) {
      throw new Error(`${label} is not a file: ${destination}`);
    }
  }
  const storageState = args.storageState ? path.resolve(args.storageState) : undefined;
  if (storageState && !fs.existsSync(storageState)) {
    throw new Error(`Storage-state file does not exist: ${storageState}`);
  }
  const browserExecutable = args.browserExecutable
    ? path.resolve(args.browserExecutable)
    : undefined;
  if (browserExecutable && !fs.existsSync(browserExecutable)) {
    throw new Error(`Browser executable does not exist: ${browserExecutable}`);
  }

  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const responseErrors = [];
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: browserExecutable,
  });
  let captureTempDirectory = "";
  try {
    captureTempDirectory = fs.mkdtempSync(
      path.join(path.dirname(output), ".figma-capture-"),
    );
    const temporaryOutput = path.join(captureTempDirectory, "capture.png");
    const temporaryDiagnostics = path.join(captureTempDirectory, "diagnostics.json");
    const context = await browser.newContext({
      viewport: { width: args.width, height: args.height },
      deviceScaleFactor: args.dpr,
      locale: args.locale,
      timezoneId: args.timezone,
      colorScheme: args.theme,
      reducedMotion: args.reducedMotion,
      storageState,
    });
    const page = await context.newPage();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(redactText(message.text()));
    });
    page.on("pageerror", (error) => pageErrors.push(redactText(error.message)));
    page.on("requestfailed", (request) => {
      const failure = request.failure();
      const url = safeUrl(request.url());
      requestFailures.push({
        url,
        error: failure?.errorText ?? "request failed",
        ignored: ignoredRequestPatterns.some((pattern) => pattern.test(url)),
      });
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      const url = safeUrl(response.url());
      responseErrors.push({
        url,
        status: response.status(),
        ignored: ignoredRequestPatterns.some((pattern) => pattern.test(url)),
      });
    });

    await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    try {
      await page.waitForLoadState("networkidle", { timeout: 5_000 });
    } catch {
      // Long-lived connections are common; fonts/images and explicit readiness
      // below are the deterministic gates.
    }
    if (args.waitFor) {
      await page.locator(args.waitFor).waitFor({ state: "visible", timeout: 15_000 });
    }
    if (args.fullPage) {
      await page.evaluate(async () => {
        const pause = () => new Promise((resolve) => setTimeout(resolve, 40));
        const step = Math.max(240, Math.floor(window.innerHeight * 0.75));
        const maximumHeight = 2_000_000;
        const deadline = performance.now() + 25_000;
        let y = 0;
        let lastHeight = document.documentElement.scrollHeight;
        let stableAtEnd = 0;
        let completed = false;
        for (let iteration = 0; iteration < 750; iteration += 1) {
          if (performance.now() > deadline) break;
          const height = document.documentElement.scrollHeight;
          lastHeight = height;
          if (height > maximumHeight) {
            throw new Error(`Full-page capture exceeded ${maximumHeight}px safety limit`);
          }
          const end = Math.max(0, height - window.innerHeight);
          if (y < end) {
            y = Math.min(end, y + step);
            stableAtEnd = 0;
          } else {
            stableAtEnd += 1;
          }
          window.scrollTo(0, y);
          await pause();
          if (stableAtEnd >= 2 && document.documentElement.scrollHeight === height) {
            completed = true;
            break;
          }
        }
        if (!completed) {
          throw new Error(
            `Full-page lazy-content scroll did not stabilize within 25s (last height ${lastHeight}px)`,
          );
        }
        window.scrollTo(0, 0);
        await pause();
      });
    }
    await page.evaluate(async (timeoutMs) => {
      const readiness = (async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        const pendingImages = [...document.images]
          .filter((image) => !image.complete)
          .map(
            (image) =>
              new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
              }),
          );
        await Promise.all(pendingImages);
      })();
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Font/image readiness timed out")), timeoutMs);
      });
      await Promise.race([readiness, timeout]);
    }, 15_000);
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-delay: 0s !important;
          animation-duration: 0s !important;
          animation-iteration-count: 1 !important;
          caret-color: transparent !important;
          scroll-behavior: auto !important;
          transition-delay: 0s !important;
          transition-duration: 0s !important;
        }
      `,
    });
    if (args.waitMs) await page.waitForTimeout(args.waitMs);

    const brokenImages = (
      await page.evaluate(() =>
        [...document.images]
          .filter(
            (image) =>
              image.currentSrc && (!image.complete || image.naturalWidth === 0),
          )
          .map((image) => ({
            source: image.currentSrc,
            alt: image.alt || null,
          })),
      )
    ).map((image) => ({
      source: safeUrl(image.source),
      alt: redactText(image.alt ?? ""),
    }));

    if (args.selector) {
      const locator = page.locator(args.selector);
      if ((await locator.count()) !== 1) {
        throw new Error(`--selector must resolve to exactly one element: ${args.selector}`);
      }
      await locator.screenshot({ path: temporaryOutput, animations: "disabled" });
    } else {
      await page.screenshot({
        path: temporaryOutput,
        fullPage: args.fullPage,
        animations: "disabled",
      });
    }
    fs.renameSync(temporaryOutput, output);

    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    const diagnostics = {
      url: safeUrl(args.url),
      output: portablePath(root, output),
      outputSha256: sha256(output),
      viewport: {
        width: args.width,
        height: args.height,
        deviceScaleFactor: args.dpr,
      },
      locale: args.locale,
      timezone: args.timezone,
      theme: args.theme,
      reducedMotion: args.reducedMotion,
      readySelector: args.waitFor || null,
      fullPage: args.fullPage,
      selector: args.selector || null,
      customBrowserExecutable: Boolean(browserExecutable),
      allowHorizontalOverflow: Boolean(args.horizontalOverflowReason),
      horizontalOverflowReason: args.horizontalOverflowReason || null,
      ignoredRequestFailurePatterns: args.ignoreRequestFailures,
      stateSetup: storageState
        ? { kind: "storage-state", sha256: sha256(storageState) }
        : args.fixtureId
          ? { kind: "fixture-route", fixtureId: args.fixtureId }
          : { kind: "none" },
      runtime: {
        kind: "browser-automation",
        tool: playwrightPackage,
        toolVersion: playwrightVersion,
        browserVersion: browser.version(),
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        userAgent,
      },
      dimensions,
      consoleErrors,
      pageErrors,
      requestFailures,
      responseErrors,
      brokenImages,
    };
    fs.writeFileSync(temporaryDiagnostics, JSON.stringify(diagnostics, null, 2) + "\n");
    fs.renameSync(temporaryDiagnostics, diagnosticsPath);
    console.log(JSON.stringify(diagnostics, null, 2));
    await context.close();

    const runtimeFailure =
      (dimensions.horizontalOverflow && !args.horizontalOverflowReason) ||
      consoleErrors.length > 0 ||
      pageErrors.length > 0 ||
      requestFailures.some((failure) => !failure.ignored) ||
      responseErrors.some((response) => !response.ignored) ||
      brokenImages.length > 0;
    return runtimeFailure ? 1 : 0;
  } finally {
    await browser.close();
    if (captureTempDirectory) {
      fs.rmSync(captureTempDirectory, { recursive: true, force: true });
    }
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 2;
  });
