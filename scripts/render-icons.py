#!/usr/bin/env python3
"""Rasterize the Linguarium SVG icon into all the PNG sizes the PWA needs.

Runs cairosvg over icons/icon.svg (rounded app icon) and icons/icon-square.svg
(full-bleed square) to produce:
  icons/icon-192.png           - regular PWA icon (any)
  icons/icon-512.png           - regular PWA icon (any)
  icons/icon-512-maskable.png  - maskable (full bleed, safe zone)
  icons/apple-touch-icon.png   - 180x180 for iOS home screens
Also emits a small visual sanity report (mean brightness, ink coverage) so a
broken/blank render is caught immediately.
"""

from pathlib import Path

import cairosvg
from PIL import Image

ICONS = Path(__file__).resolve().parents[1] / "icons"


def render(src: str, dst: str, size: int) -> None:
    svg = (ICONS / src).read_text()
    cairosvg.svg2png(bytestring=svg.encode(), write_to=str(ICONS / dst), output_width=size, output_height=size)
    img = Image.open(ICONS / dst).convert("RGBA")
    px = list(img.getdata())
    opaque = [p for p in px if p[3] > 200]
    mean = sum(sum(p[:3]) for p in opaque) / (len(opaque) * 3) if opaque else 0
    print(f"{dst}: {size}x{size}, {len(opaque)}/{len(px)} opaque px, mean brightness {mean:.0f}")
    assert len(opaque) > (size * size) / 3, f"{dst} looks mostly empty"
    assert 40 < mean < 240, f"{dst} looks blank or inverted"


render("icon.svg", "icon-192.png", 192)
render("icon.svg", "icon-512.png", 512)
render("icon-square.svg", "icon-512-maskable.png", 512)
render("icon-square.svg", "apple-touch-icon.png", 180)
print("icons OK")
