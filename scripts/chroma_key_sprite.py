"""Turn an ImageGen chroma-key sprite into a transparent RGBA PNG."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def remove_green_screen(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA")
    pixels = np.asarray(image, dtype=np.float32) / 255.0
    red, green, blue, original_alpha = np.moveaxis(pixels, -1, 0)

    green_dominance = green - np.maximum(red, blue)
    hue_strength = np.clip((green_dominance - 0.10) / 0.24, 0.0, 1.0)
    luminance_strength = np.clip((green - 0.28) / 0.52, 0.0, 1.0)
    key_strength = hue_strength * luminance_strength
    alpha = np.minimum(original_alpha, 1.0 - key_strength)

    pixels[..., 1] = np.minimum(green, np.maximum(red, blue) + 0.05)
    pixels[..., 3] = alpha
    pixels[alpha <= 0.001, :3] = 0.0

    result = Image.fromarray(np.rint(pixels * 255).astype(np.uint8), mode="RGBA")
    target.parent.mkdir(parents=True, exist_ok=True)
    result.save(target, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    remove_green_screen(args.source, args.target)


if __name__ == "__main__":
    main()
