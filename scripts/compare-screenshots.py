#!/usr/bin/env python3
"""Compare equal-sized screenshots and emit overlay, heatmap, and JSON metrics."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageChops, UnidentifiedImageError, __version__ as pillow_version
except ImportError as exc:  # pragma: no cover - environment-dependent
    raise SystemExit(
        "Pillow is required. Use the workspace Python runtime or install Pillow "
        "in an isolated environment."
    ) from exc


def mismatch_gate(value: str) -> float:
    parsed = float(value)
    if not 0 <= parsed <= 0.05:
        raise argparse.ArgumentTypeError(
            "must be between 0 and 0.05; use measurement/manual review for larger diffs"
        )
    return parsed


def channel_threshold(value: str) -> int:
    parsed = int(value)
    if not 0 <= parsed <= 32:
        raise argparse.ArgumentTypeError(
            "must be between 0 and 32; larger values can hide real color differences"
        )
    return parsed


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def pixel_sha256(image: Image.Image) -> str:
    normalized = image.convert("RGBA")
    digest = hashlib.sha256()
    digest.update(
        f"RGBA:{normalized.width}x{normalized.height}\0".encode("ascii")
    )
    digest.update(normalized.tobytes())
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Compare screenshots without resizing. Metrics are diagnostic; "
            "human review of the overlay and heatmap remains required."
        )
    )
    parser.add_argument("reference", type=Path, nargs="?", help="Reference PNG/JPEG")
    parser.add_argument("actual", type=Path, nargs="?", help="Implementation PNG/JPEG")
    parser.add_argument(
        "--fingerprint",
        type=Path,
        help="Print a canonical decoded-pixel fingerprint for one image and exit",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("comparison"),
        help="Directory for overlay.png, diff.png, and comparison.json",
    )
    parser.add_argument(
        "--pixel-threshold",
        type=channel_threshold,
        default=16,
        help="A pixel differs when any RGBA channel delta exceeds this value",
    )
    parser.add_argument(
        "--max-mismatch-ratio",
        type=mismatch_gate,
        help="Optional failure gate from 0 to 0.05; omit for measurement-only mode",
    )
    args = parser.parse_args()
    if args.fingerprint:
        if args.reference or args.actual:
            parser.error("--fingerprint cannot be combined with comparison inputs")
    elif not args.reference or not args.actual:
        parser.error("reference and actual images are required")
    return args


def main() -> int:
    args = parse_args()
    if args.fingerprint:
        fingerprint_path = args.fingerprint.resolve()
        if not fingerprint_path.is_file():
            print("ERROR fingerprint image does not exist", file=sys.stderr)
            return 2
        with Image.open(fingerprint_path) as opened:
            normalized = opened.convert("RGBA")
        print(
            json.dumps(
                {
                    "width": normalized.width,
                    "height": normalized.height,
                    "mode": "RGBA",
                    "pixelSha256": pixel_sha256(normalized),
                },
                indent=2,
            )
        )
        return 0

    reference_path = args.reference.resolve()
    actual_path = args.actual.resolve()
    output_dir = args.output_dir.resolve()
    overlay_path = output_dir / "overlay.png"
    diff_path = output_dir / "diff.png"
    report_path = output_dir / "comparison.json"

    for label, path in (("reference", reference_path), ("actual", actual_path)):
        if not path.is_file():
            print(f"ERROR {label} image does not exist: {path}", file=sys.stderr)
            return 2

    if reference_path.samefile(actual_path):
        print(
            "ERROR reference and actual must be distinct files from distinct capture steps",
            file=sys.stderr,
        )
        return 2

    output_dir.mkdir(parents=True, exist_ok=True)
    for output_path in (overlay_path, diff_path, report_path):
        if output_path in (reference_path, actual_path) or (
            output_path.exists()
            and any(output_path.samefile(input_path) for input_path in (reference_path, actual_path))
        ):
            print(
                f"ERROR output would overwrite an input image: {output_path}",
                file=sys.stderr,
            )
            return 2
        if output_path.is_symlink():
            print(
                f"ERROR refusing to write comparison output through a symbolic link: {output_path}",
                file=sys.stderr,
            )
            return 2

    reference_hash = sha256(reference_path)
    actual_hash = sha256(actual_path)

    with Image.open(reference_path) as opened_reference:
        reference = opened_reference.convert("RGBA")
    with Image.open(actual_path) as opened_actual:
        actual = opened_actual.convert("RGBA")

    if reference.size != actual.size:
        payload = {
            "status": "dimension-mismatch",
            "referenceSize": list(reference.size),
            "actualSize": list(actual.size),
            "message": "Screenshots must use the same viewport; resizing is forbidden.",
        }
        print(json.dumps(payload, indent=2))
        return 2

    difference = ImageChops.difference(reference, actual)
    bands = difference.split()
    intensity = ImageChops.lighter(
        ImageChops.lighter(bands[0], bands[1]),
        ImageChops.lighter(bands[2], bands[3]),
    )
    binary = intensity.point(
        lambda value: 255 if value > args.pixel_threshold else 0
    )

    total_pixels = reference.width * reference.height
    intensity_histogram = intensity.histogram()
    mismatch_pixels = sum(intensity_histogram[args.pixel_threshold + 1 :])
    mismatch_ratio = mismatch_pixels / total_pixels if total_pixels else 0.0

    difference_histogram = difference.histogram()
    channel_count = total_pixels * 4
    absolute_sum = 0
    squared_sum = 0
    max_channel_delta = 0
    for channel in range(4):
        offset = channel * 256
        for delta in range(256):
            count = difference_histogram[offset + delta]
            absolute_sum += delta * count
            squared_sum += delta * delta * count
            if count and delta > max_channel_delta:
                max_channel_delta = delta

    mean_absolute_error = absolute_sum / channel_count if channel_count else 0.0
    root_mean_square_error = (
        math.sqrt(squared_sum / channel_count) if channel_count else 0.0
    )
    bounding_box = binary.getbbox()

    def atomic_image_save(image: Image.Image, destination: Path) -> None:
        descriptor, temporary_name = tempfile.mkstemp(
            dir=output_dir, prefix=f".{destination.stem}-", suffix=".png"
        )
        os.close(descriptor)
        temporary = Path(temporary_name)
        try:
            image.save(temporary, format="PNG")
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)

    overlay_image = Image.blend(reference, actual, 0.5)
    atomic_image_save(overlay_image, overlay_path)
    heat = intensity.point(
        lambda value: 0
        if value <= args.pixel_threshold
        else min(255, 64 + (value - args.pixel_threshold) * 3)
    )
    black = Image.new("L", reference.size, 0)
    diff_image = Image.merge("RGB", (heat, black, black))
    atomic_image_save(diff_image, diff_path)

    gate_passed = (
        None
        if args.max_mismatch_ratio is None
        else mismatch_ratio <= args.max_mismatch_ratio
    )
    payload = {
        "tool": "kodety-aidoff/compare-screenshots",
        "version": 2,
        "runtime": {
            "pythonVersion": platform.python_version(),
            "pillowVersion": pillow_version,
        },
        "status": "measured" if gate_passed is None else ("passed" if gate_passed else "failed"),
        "reference": os.path.relpath(reference_path, output_dir),
        "actual": os.path.relpath(actual_path, output_dir),
        "referenceSha256": reference_hash,
        "actualSha256": actual_hash,
        "width": reference.width,
        "height": reference.height,
        "pixelThreshold": args.pixel_threshold,
        "maxMismatchRatio": args.max_mismatch_ratio,
        "mismatchPixels": mismatch_pixels,
        "totalPixels": total_pixels,
        "mismatchRatio": mismatch_ratio,
        "meanAbsoluteError": mean_absolute_error,
        "rootMeanSquareError": root_mean_square_error,
        "maxChannelDelta": max_channel_delta,
        "changedBoundingBox": list(bounding_box) if bounding_box else None,
        "overlay": overlay_path.name,
        "overlaySha256": sha256(overlay_path),
        "overlayPixelSha256": pixel_sha256(overlay_image),
        "diff": diff_path.name,
        "diffSha256": sha256(diff_path),
        "diffPixelSha256": pixel_sha256(diff_image),
        "humanReviewRequired": True,
    }
    descriptor, temporary_name = tempfile.mkstemp(
        dir=output_dir, prefix=".comparison-", suffix=".json"
    )
    os.close(descriptor)
    temporary_report = Path(temporary_name)
    try:
        temporary_report.write_text(
            json.dumps(payload, indent=2) + "\n", encoding="utf-8"
        )
        os.replace(temporary_report, report_path)
    finally:
        temporary_report.unlink(missing_ok=True)
    print(json.dumps(payload, indent=2))

    return 1 if gate_passed is False else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, UnidentifiedImageError, ValueError) as exc:
        print(
            f"ERROR screenshot comparison could not read or write an artifact "
            f"({type(exc).__name__})",
            file=sys.stderr,
        )
        raise SystemExit(2) from None
