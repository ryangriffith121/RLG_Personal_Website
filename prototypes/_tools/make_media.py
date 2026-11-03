"""Turns the raw renders and captures in .cache/ into web-ready media in _shared/media/generated/.

Inputs (made by the Blender scripts, capture_market.mjs and rasterize_svg.mjs):
  .cache/calc_hero.png, calc_exploded.png, calc_top.png       (transparent renders)
  .cache/mp3_concept_hero.png, mp3_concept_xray.png             (transparent renders)
  .cache/market_dashboard.png, market_chart.png, ...            (screenshots)
  .cache/kb/kb_schematic_raw.png                                (KiCad schematic on white)
Also builds a one-colour mask of the Ryan logo and duotone versions of the portrait.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageChops
import numpy as np

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parent.parent
CACHE = TOOLS / ".cache"
OUT = REPO / "prototypes" / "_shared" / "media" / "generated"
OUT.mkdir(parents=True, exist_ok=True)

INDIGO = (65, 45, 181)
LIME = (233, 255, 151)
LAV = (217, 212, 226)
NIGHT = (15, 14, 25)


def save_webp(im, name, quality=86, lossless=False, max_w=None):
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    path = OUT / f"{name}.webp"
    im.save(path, "WEBP", quality=quality, lossless=lossless, method=6)
    print(f"  {path.relative_to(REPO)}  {im.size[0]}x{im.size[1]}  {path.stat().st_size // 1024} KB")
    return im


def trim_alpha(im, pad=24):
    """Crop a transparent render to its visible pixels plus padding."""
    bbox = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def renders():
    for name in ("calc_hero", "calc_exploded", "mp3_concept_hero", "mp3_concept_xray"):
        src = CACHE / f"{name}.png"
        if src.exists():
            save_webp(trim_alpha(Image.open(src).convert("RGBA")), name, max_w=1600)
    top = CACHE / "calc_top.png"
    if top.exists():  # rotate so the screen sits above the keys, as the user sees it
        save_webp(trim_alpha(Image.open(top).convert("RGBA").rotate(180)), "calc_top", max_w=1400)


def captures():
    for name in ("market_dashboard", "market_chart", "market_heatmap", "market_globe"):
        src = CACHE / f"{name}.png"
        if src.exists():
            save_webp(Image.open(src).convert("RGB"), name, quality=84, max_w=1600)


def schematic_blueprint():
    """Recolour the KiCad export: wires to lime, symbols and text to lavender, on deep indigo."""
    src = CACHE / "kb" / "kb_schematic_raw.png"
    if not src.exists():
        return
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    lum = rgb.mean(axis=2) / 255.0
    ink = np.clip((1.0 - lum) * 1.6, 0, 1)[..., None]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    wire = ((g > r + 25) & (g > b + 10))[..., None]           # KiCad draws wires green
    bg = np.array((30, 21, 92), np.float32)
    col = np.where(wire, np.array(LIME, np.float32), np.array(LAV, np.float32))
    out = bg * (1 - ink) + col * ink
    im = Image.fromarray(out.clip(0, 255).astype(np.uint8))
    # crop to content with a margin, then add a faint 20 px grid like a drafting sheet
    bbox = Image.fromarray((ink[..., 0] * 255).astype(np.uint8)).point(lambda v: 255 if v > 40 else 0).getbbox()
    x0, y0, x1, y1 = bbox
    m = 40
    im = im.crop((max(0, x0 - m), max(0, y0 - m), min(im.width, x1 + m), min(im.height, y1 + m)))
    grid = Image.new("RGB", im.size, (30, 21, 92))
    ga = np.asarray(grid).copy()
    ga[::24, :, :] = (44, 33, 120)
    ga[:, ::24, :] = (44, 33, 120)
    base = np.asarray(im).astype(np.int16)
    bgmask = (np.abs(base - np.array((30, 21, 92))).sum(axis=2) < 6)[..., None]
    final = np.where(bgmask, ga, base).astype(np.uint8)
    save_webp(Image.fromarray(final), "kb_schematic", quality=90, max_w=1800)


def logo_mask():
    """A white-on-transparent version of the RYAN logo, for CSS masks and recolouring."""
    src = REPO / "_assets" / "portfolio" / "_thumbnails" / "logov2.png"
    im = Image.open(src).convert("RGBA")
    a = im.getchannel("A")
    rgb = np.asarray(im.convert("RGB")).astype(np.int16)
    dark = (rgb.sum(axis=2) < 90)                              # the black gaps between letters
    alpha = np.asarray(a).copy()
    alpha[dark] = 0
    mask = Image.new("RGBA", im.size, (255, 255, 255, 0))
    mask.putalpha(Image.fromarray(alpha))
    mask = mask.resize((512, 512), Image.LANCZOS)
    path = OUT / "logo_mask.png"
    mask.save(path, optimize=True)
    print(f"  {path.relative_to(REPO)}  {path.stat().st_size // 1024} KB")


def portrait():
    src = REPO / "_assets" / "images" / "aboutmephoto.png"
    im = Image.open(src).convert("RGB")
    save_webp(im, "portrait", quality=86, max_w=1000)
    g = ImageOps.grayscale(im)
    g = ImageOps.autocontrast(g, cutoff=1)
    # indigo -> lavender duotone (Albedo-style team portrait)
    duo = ImageOps.colorize(g, black=(32, 20, 104), white=(236, 233, 246), mid=(129, 115, 204))
    save_webp(duo, "portrait_duotone", quality=86, max_w=1000)
    # lime-on-night version for the dark prototype
    duo2 = ImageOps.colorize(g, black=NIGHT, white=LIME, mid=(96, 77, 198))
    save_webp(duo2, "portrait_signal", quality=86, max_w=1000)


if __name__ == "__main__":
    print("renders");    renders()
    print("captures");   captures()
    print("schematic");  schematic_blueprint()
    print("logo");       logo_mask()
    print("portrait");   portrait()
