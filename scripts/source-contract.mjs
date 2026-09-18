import fs from "node:fs";

export function createSourceContract(map, root, mapLabel, helpers) {
  const {
    record, addError, addWarning, projectFile, fingerprintImage, sha256,
    containsSensitiveAssignment, duplicates,
  } = helpers;
  const mode = map.sourceMode === undefined ? "figma" : map.sourceMode;
  if (!["figma", "screenshot"].includes(mode)) {
    addError(`${mapLabel}: sourceMode must be figma or screenshot`);
  }
  const screenshotMode = mode === "screenshot";
  const referenceKind = screenshotMode ? "screenshot" : "figma";
  const sources = new Map();
  const ids = [];
  const targetedIds = new Set();

  if (screenshotMode) {
    if ("figma" in map) {
      addError(`${mapLabel}: screenshot mode must not contain a figma object`);
    }
    const screenshots = Array.isArray(map.screenshots) ? map.screenshots : [];
    if (!screenshots.length) {
      addError(`${mapLabel}: screenshots must contain at least one supplied source image`);
    }
    screenshots.forEach((rawSource, index) => {
      const source = record(rawSource);
      const context = `${mapLabel}, screenshots[${index}]`;
      if (!source) {
        addError(`${context}: must be an object`);
        return;
      }
      const validId = typeof source.id === "string" && /^[A-Za-z0-9_-]+$/.test(source.id);
      if (!validId) addError(`${context}: id must use letters, numbers, underscore, or hyphen`);
      else ids.push(source.id);
      if (typeof source.name !== "string" || !source.name.trim()) {
        addError(`${context}: name is required`);
      }
      const pixelSize = record(source.pixelSize);
      if (
        !pixelSize || !Number.isInteger(pixelSize.width) || pixelSize.width <= 0 ||
        !Number.isInteger(pixelSize.height) || pixelSize.height <= 0
      ) {
        addError(`${context}: pixelSize requires positive integer width and height`);
      }
      const sourcePath = projectFile(root, source.path, `${context}.path`, true);
      const validHash = typeof source.sha256 === "string" && /^[a-f0-9]{64}$/i.test(source.sha256);
      if (!validHash) addError(`${context}: supplied screenshot requires a SHA-256 hash`);
      if (sourcePath && fs.existsSync(sourcePath)) {
        if (validHash && sha256(sourcePath) !== source.sha256.toLowerCase()) {
          addError(`${context}: screenshot SHA-256 does not match current bytes`);
        }
        const inspected = fingerprintImage(sourcePath);
        if (inspected.error || !inspected.fingerprint) {
          addError(`${context}: supplied screenshot cannot be decoded (${inspected.error ?? "no pixel fingerprint"})`);
        } else if (
          inspected.fingerprint.width !== pixelSize?.width ||
          inspected.fingerprint.height !== pixelSize?.height
        ) {
          addError(`${context}: pixelSize does not match decoded screenshot dimensions`);
        }
      }
      if (validId) sources.set(source.id, { ...source, absolutePath: sourcePath });
    });
  } else {
    if ("screenshots" in map) {
      addError(`${mapLabel}: screenshots require sourceMode screenshot`);
    }
    const figma = record(map.figma);
    if (!figma) addError(`${mapLabel}: figma must be an object`);
    if (figma) {
      if (typeof figma.fileKey !== "string" || !figma.fileKey.trim()) {
        addError(`${mapLabel}.figma.fileKey: non-empty file key is required`);
      }
      try {
        const figmaUrl = new URL(figma.fileUrl);
        const segments = figmaUrl.pathname.split("/").filter(Boolean);
        if (
          figmaUrl.protocol !== "https:" || figmaUrl.username || figmaUrl.password ||
          containsSensitiveAssignment(figma.fileUrl) ||
          !["figma.com", "www.figma.com"].includes(figmaUrl.hostname) ||
          !["design", "file", "proto"].includes(segments[0]) || !segments[1] ||
          segments[1] !== figma.fileKey || !figmaUrl.searchParams.get("node-id")
        ) {
          addError(`${mapLabel}.figma.fileUrl: valid node-specific Figma URL matching fileKey is required`);
        }
      } catch {
        addError(`${mapLabel}.figma.fileUrl: valid node-specific Figma URL is required`);
      }
    }
    const nodes = Array.isArray(figma?.nodes) ? figma.nodes : [];
    if (!nodes.length) addError(`${mapLabel}: figma.nodes must contain at least one source node`);
    nodes.forEach((rawNode, index) => {
      const node = record(rawNode);
      const context = `${mapLabel}, figma.nodes[${index}]`;
      if (!node) {
        addError(`${context}: must be an object`);
        return;
      }
      const validId = typeof node.nodeId === "string" && node.nodeId.trim();
      if (!validId) addError(`${context}: nodeId is required`);
      else ids.push(node.nodeId);
      if (typeof node.name !== "string" || !node.name.trim()) {
        addError(`${context}: name is required`);
      }
      const frameSize = record(node.frameSize);
      if (
        !frameSize || typeof frameSize.width !== "number" || frameSize.width <= 0 ||
        typeof frameSize.height !== "number" || frameSize.height <= 0
      ) {
        addError(`${context}: frameSize requires positive natural width and height`);
      }
      if (validId) sources.set(node.nodeId, node);
    });
    const hasVerifiedTarget = (Array.isArray(map.targets) ? map.targets : [])
      .some((target) => record(target)?.status === "verified");
    if (
      typeof figma?.version !== "string" || !figma.version.trim() ||
      /(?:\boptional\b|\bimmutable\s+version\b|\blast[- ]modified\s+marker\b|\blatest\b|\bunknown\b|\btodo\b|\btbd\b|^(?:none|null|version)$)/i.test(figma.version.trim())
    ) {
      const message = `${mapLabel}.figma.version: record an immutable version or last-modified marker`;
      if (hasVerifiedTarget) addError(`${message} before marking a target verified`);
      else addWarning(message);
    }
  }

  duplicates(ids).forEach((id) => addError(
    `${mapLabel}: duplicate ${screenshotMode ? "screenshot id" : "Figma nodeId"} ${id}`,
  ));
  const sourceFor = (target) => sources.get(screenshotMode ? target.sourceId : target.nodeId);

  return {
    screenshotMode,
    referenceKind,
    validateTarget(target, context) {
      const key = screenshotMode ? "sourceId" : "nodeId";
      const forbiddenKey = screenshotMode ? "nodeId" : "sourceId";
      if (forbiddenKey in target) {
        addError(`${context}: ${forbiddenKey} is not allowed in ${referenceKind} mode`);
      }
      if (typeof target[key] !== "string" || !sources.has(target[key])) {
        addError(`${context}: ${key} must reference ${screenshotMode ? "screenshots" : "figma.nodes"}`);
      } else {
        targetedIds.add(target[key]);
      }
      if (![referenceKind, "inferred"].includes(target.referenceKind)) {
        addError(`${context}: referenceKind must be ${referenceKind} or inferred`);
      }
    },
    validateReference(target, referencePath, context) {
      if (!screenshotMode || target.referenceKind !== "screenshot") return;
      const source = sourceFor(target);
      if (!source || !referencePath || referencePath !== source.absolutePath) {
        addError(`${context}: reference must use the registered screenshot source path`);
      } else if (
        fs.existsSync(referencePath) && typeof source.sha256 === "string" &&
        sha256(referencePath) !== source.sha256.toLowerCase()
      ) {
        addError(`${context}: reference bytes do not match the registered screenshot SHA-256`);
      }
    },
    validateCapture(target, viewport, capture, context) {
      if (target.referenceKind !== referenceKind) return;
      const source = sourceFor(target);
      const size = record(screenshotMode ? source?.pixelSize : source?.frameSize);
      if (!size) return;
      const divisor = screenshotMode ? viewport?.deviceScaleFactor ?? 1 : 1;
      const width = size.width / divisor;
      const height = size.height / divisor;
      const label = screenshotMode ? "screenshot pixelSize / deviceScaleFactor" : "Figma frame's natural size";
      if (capture.mode === "viewport" && (width !== viewport?.width || height !== viewport?.height)) {
        addError(`${context}: viewport must match the ${label}`);
      }
      if (capture.mode === "fullPage" && width !== viewport?.width) {
        addError(`${context}: full-page viewport width must match the ${label}`);
      }
    },
    expectedPixels(target, viewport) {
      const source = sourceFor(target);
      if (screenshotMode) return record(source?.pixelSize);
      const size = record(source?.frameSize) ?? viewport;
      const dpr = viewport.deviceScaleFactor ?? 1;
      return { width: Math.round(size.width * dpr), height: Math.round(size.height * dpr) };
    },
    validateAttribution(entry, context) {
      if (screenshotMode) {
        if ("figmaNodeId" in entry) {
          addError(`${context}: figmaNodeId is not allowed in screenshot mode`);
        }
        if (typeof entry.sourceId !== "string" || !sources.has(entry.sourceId)) {
          addError(`${context}: sourceId must reference screenshots`);
        }
      } else {
        if ("sourceId" in entry) addError(`${context}: sourceId is not allowed in figma mode`);
        if (typeof entry.figmaNodeId !== "string" || !entry.figmaNodeId.trim()) {
          addError(`${context}: figmaNodeId is required`);
        }
      }
    },
    validateCoverage() {
      sources.forEach((_, id) => {
        if (!targetedIds.has(id)) {
          addError(`${mapLabel}: ${screenshotMode ? "Screenshot source" : "Figma source node"} has no target: ${id}`);
        }
      });
    },
  };
}
