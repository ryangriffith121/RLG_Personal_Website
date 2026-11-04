"""Media for the final site: transparent cut-outs, Open Graph cards and favicons.

Run after render_final.py (Blender), final_logos.mjs and final_fonts.py:
  python prototypes/_tools/make_final_media.py

final/media/cut/<slug>.webp   a transparent asset per project: studio renders for hardware, the
                              screenshot in a window for software and games, a die-cut sticker
                              for art, a round face for the watch face
final/media/og/<slug>.jpg     1200 x 630 share cards, in the project's discipline colour
final/media/og/site.jpg       the site's share card
final/favicon.ico, icon-*.png
"""
import json, math, re, hashlib, html
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parent.parent
FINAL = REPO / "final"
CUT = FINAL / "media" / "cut"
OG = FINAL / "media" / "og"
CACHE = TOOLS / ".cache" / "final"
RENDERS = CACHE / "renders"
GEN = REPO / "prototypes" / "_shared" / "media" / "generated"

INDIGO, DEEP, LIME, PINK, LAV, GREY, INK, PAPER = "#412db5", "#2d2178", "#e9ff97", "#e5197f", "#aba2d4", "#d9d4e2", "#0f0e19", "#fcfff0"
THEME = {"program": (INDIGO, LIME), "engineer": (LIME, DEEP), "art": (PINK, INK)}
FONT = {k: str(CACHE / "fonts" / f) for k, f in (("heavy", "Anybody-Heavy.ttf"), ("semi", "Anybody-Semi.ttf"), ("mono", "DMMono.ttf"))}

# how each project is shown as a cut-out
KIND = {
    "custom-calc": ("render", RENDERS / "calc_final_hero.png"),
    "bl4s-2026": ("render", RENDERS / "bl4s_board.png"),
    "disk-launcher": ("render", RENDERS / "launcher.png"),
    "jpl-2025": ("render", RENDERS / "jpl_parts.png"),
    "skull-2026": ("render", RENDERS / "skull.png"),
    "mp3-player": ("render", GEN / "mp3_concept_hero.webp"),
    "ryan-logo": ("logo", CACHE / "logos" / "mark-indigo.png"),
    "wheels": ("watch", None),
    "micro": ("diecut", None),
    "untitled-skull": ("sticker", None), "mitsubishi-design": ("sticker", None), "tcob-code": ("sticker", None),
    "the-kingdom": ("pixel", None), "density": ("pixel", None), "gatsby-game": ("pixel", None),
    "rotation-simulator": ("pixel", None), "typhlosion-mockup": ("pixel", None),
}
WINDOW = {"hollowdeep", "deepwell", "raycast-fps", "market-dashboard", "website-v4", "website-v3", "ai-image-detector",
          "dot-matrix-sim", "perlin-noise", "custom-keyboard", "interloper"}
# photos stay photos (duotone tiles): mpy-stocks, jpl-2024, cnc-yoyo, spotify-player


def load_data():
    s = (REPO / "prototypes" / "_shared" / "data" / "site-data.js").read_text(encoding="utf-8")
    return json.loads(s[s.index("=") + 1:].strip().rstrip(";"))


def rgba(hexcol, a=255):
    h = hexcol.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def trim(im, pad=0):
    box = im.getchannel("A").getbbox()
    im = im.crop(box) if box else im
    if pad:
        out = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
        out.alpha_composite(im, (pad, pad))
        im = out
    return im


def fit(im, side):
    s = side / max(im.size)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS) if s < 1 else im


def shadow(im, blur=22, dy=16, alpha=0.38, color=INK):
    """Soft drop shadow under an RGBA image (canvas grows to fit)."""
    pad = blur * 3
    a = im.getchannel("A").point(lambda v: int(v * alpha))
    sh = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    layer = Image.new("RGBA", im.size, rgba(color))
    layer.putalpha(a)
    sh.alpha_composite(layer, (pad, pad + dy))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    sh.alpha_composite(im, (pad, pad))
    return trim(sh)


def rounded_mask(size, r, corners=(True, True, True, True)):
    w, h = size
    m = Image.new("L", (w * 2, h * 2), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), r * 2, fill=255, corners=corners)
    return m.resize(size, Image.LANCZOS)


def cover(im, w, h, pixel=False):
    s = max(w / im.width, h / im.height)
    rs = im.resize((max(w, round(im.width * s)), max(h, round(im.height * s))), Image.NEAREST if pixel else Image.LANCZOS)
    x, y = (rs.width - w) // 2, (rs.height - h) // 2
    return rs.crop((x, y, x + w, y + h))


def window(src, title, pixel=False):
    """The screenshot in a rounded window: ink frame, three palette dots, the title in mono."""
    shot = Image.open(src).convert("RGBA")
    aspect = min(1.78, max(1.25, shot.width / shot.height))
    W = 880
    H = round(W / aspect)
    bar, b, r = 56, 10, 28
    frame = Image.new("RGBA", (W + b * 2, H + bar + b), (0, 0, 0, 0))
    frame.paste(Image.new("RGBA", frame.size, rgba(INK)), (0, 0), rounded_mask(frame.size, r))
    d = ImageDraw.Draw(frame)
    for i, c in enumerate((PINK, LIME, LAV)):
        cx = 30 + i * 26
        d.ellipse((cx - 8, bar / 2 - 8, cx + 8, bar / 2 + 8), fill=rgba(c))
    f = ImageFont.truetype(FONT["mono"], 19)
    label = title.upper()
    while f.getlength(label) > W - 140 and len(label) > 4:
        label = label[:-2]
    d.text((104, bar / 2), label, font=f, fill=rgba(GREY), anchor="lm")
    content = cover(shot, W, H, pixel)
    frame.paste(content, (b, bar), rounded_mask((W, H), r - 10, corners=(False, False, True, True)))
    return shadow(frame)


def sticker(src, angle):
    """Rectangular art on a white card, a little crooked, with a shadow."""
    art = fit(Image.open(src).convert("RGBA"), 820)
    pad = 22
    card = Image.new("RGBA", (art.width + pad * 2, art.height + pad * 2), (0, 0, 0, 0))
    card.paste(Image.new("RGBA", card.size, (255, 255, 255, 255)), (0, 0), rounded_mask(card.size, 16))
    card.alpha_composite(art, (pad, pad))
    card = card.rotate(angle, resample=Image.BICUBIC, expand=True)
    return shadow(card)


def diecut(src, angle):
    """Art on white: drop the white, then a thick white die-cut border and a shadow."""
    art = fit(Image.open(src).convert("RGBA"), 820)
    px = art.load()
    for y in range(art.height):
        for x in range(art.width):
            r, g, b, a = px[x, y]
            m = min(r, g, b)
            if m > 236:
                px[x, y] = (r, g, b, max(0, min(a, int((255 - m) * 255 / 19))))
    alpha = art.getchannel("A")
    grow = alpha.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.GaussianBlur(1.5))
    out = Image.new("RGBA", art.size, (0, 0, 0, 0))
    white = Image.new("RGBA", art.size, (255, 255, 255, 255))
    out.paste(white, (0, 0), grow)
    out.alpha_composite(art)
    out = trim(out, 30).rotate(angle, resample=Image.BICUBIC, expand=True)
    return shadow(out)


def watch(src):
    """The watch face, round, in a deep indigo bezel."""
    face = Image.open(src).convert("RGBA")
    s = min(face.size)
    face = face.crop(((face.width - s) // 2, (face.height - s) // 2, (face.width + s) // 2, (face.height + s) // 2)).resize((760, 760), Image.LANCZOS)
    size = 860
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.ellipse((0, 0, size - 1, size - 1), fill=rgba(DEEP))
    d.ellipse((18, 18, size - 19, size - 19), outline=rgba(LAV), width=4)
    d.rounded_rectangle((size - 14, size // 2 - 50, size + 20, size // 2 + 50), 10, fill=rgba(LIME))
    out = out.crop((0, 0, size + 20, size)) if False else out
    m = Image.new("L", (760, 760), 0)
    ImageDraw.Draw(m).ellipse((0, 0, 759, 759), fill=255)
    out.paste(face, (50, 50), m)
    return shadow(out)


def logo(src):
    """The RY/AN mark: indigo with a chartreuse offset, like a print misregistration."""
    mark = trim(Image.open(src).convert("RGBA"))
    off = 26
    out = Image.new("RGBA", (mark.width + off, mark.height + off), (0, 0, 0, 0))
    lime = Image.new("RGBA", mark.size, rgba(LIME))
    lime.putalpha(mark.getchannel("A"))
    out.alpha_composite(lime, (off, off))
    out.alpha_composite(mark, (0, 0))
    return shadow(out, blur=18, dy=12, alpha=0.3)


def angle_for(slug):
    return (int(hashlib.md5(slug.encode()).hexdigest()[:4], 16) % 7 - 3) * 0.9 or 1.8


def make_cuts(projects):
    CUT.mkdir(parents=True, exist_ok=True)
    made = {}
    for p in projects:
        slug = p["slug"]
        thumb = REPO / p["thumb"]["src"]
        kind, src = KIND.get(slug, ("window", None) if slug in WINDOW else (None, None))
        if not kind:
            continue
        if kind == "render":
            im = shadow(fit(trim(Image.open(src).convert("RGBA")), 1100), blur=26, dy=22, alpha=0.32)
        elif kind == "window":
            im = window(thumb, p["title"])
        elif kind == "pixel":
            im = window(thumb, p["title"], pixel=True)
        elif kind == "sticker":
            im = sticker(thumb, angle_for(slug))
        elif kind == "diecut":
            im = diecut(REPO / p["images"][0]["src"], angle_for(slug))
        elif kind == "watch":
            im = watch(thumb)
        elif kind == "logo":
            im = logo(src)
        im = fit(im, 1100)
        out = CUT / f"{slug}.webp"
        im.save(out, "WEBP", quality=86, alpha_quality=92, method=6)
        made[slug] = {"src": out.relative_to(FINAL).as_posix(), "w": im.width, "h": im.height, "kind": kind}
        print(f"cut {slug:22} {kind:8} {im.width}x{im.height} {out.stat().st_size // 1024} KB")
    return made


# ------------------------------------------------------------------ Open Graph cards
def wrap(text, font, width, max_lines):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if font.getlength(t) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while font.getlength(lines[-1] + "…") > width and " " in lines[-1]:
            lines[-1] = lines[-1].rsplit(" ", 1)[0]
        lines[-1] += "…"
    return lines


def og_project(p, cut):
    bg, fg = THEME[p["cats"][0]]
    im = Image.new("RGBA", (1200, 630), rgba(bg))
    d = ImageDraw.Draw(im)
    mono, semi = ImageFont.truetype(FONT["mono"], 24), ImageFont.truetype(FONT["semi"], 30)
    y, m = p["iso"].split("-")[:2]
    month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][int(m) - 1]
    names = {"program": "PROGRAMMING", "engineer": "ENGINEERING", "art": "ART"}
    label = f"RLG-{p['no']:03d} · {month} {y} · {' · '.join(names[c] for c in p['cats'])}"
    if mono.getlength(label) > 600:
        label = f"RLG-{p['no']:03d} · {month} {y} · {' · '.join({'program': 'PRG', 'engineer': 'ENG', 'art': 'ART'}[c] for c in p['cats'])}"
    d.text((64, 60), label, font=mono, fill=rgba(fg))
    size = 96
    while size > 44:
        heavy = ImageFont.truetype(FONT["heavy"], size)
        lines = wrap(p["title"].upper(), heavy, 600, 9)
        if len(lines) <= 3 and all(heavy.getlength(l) <= 600 for l in lines):
            break
        size -= 4
    lines = wrap(p["title"].upper(), heavy, 600, 3)
    yy = 120
    for line in lines:
        d.text((60, yy), line, font=heavy, fill=rgba(fg))
        yy += int(size * 0.98)
    for line in wrap(html.unescape(p["summary"]), semi, 600, 3 if len(lines) < 3 else 2):
        d.text((64, yy + 18), line, font=semi, fill=rgba(fg))
        yy += 40
    d.text((64, 566), "ryanlgriffith.com", font=mono, fill=rgba(fg))
    if cut:
        art = Image.open(FINAL / cut["src"]).convert("RGBA")
        art.thumbnail((500, 520))
        im.alpha_composite(art, (1200 - 40 - art.width + (500 - art.width) // 2, (630 - art.height) // 2))
    else:
        photo = cover(Image.open(REPO / p["thumb"]["src"]).convert("RGBA"), 470, 520)
        im.paste(photo, (690, 55), rounded_mask((470, 520), 28))
    return im.convert("RGB")


def og_site(cut):
    im = Image.new("RGBA", (1200, 630), rgba(INDIGO))
    d = ImageDraw.Draw(im)
    bands = [(INDIGO, LIME, "PROGRAMMER"), (LIME, DEEP, "ENGINEER"), (PINK, INK, "ARTIST")]
    heavy = ImageFont.truetype(FONT["heavy"], 66)
    for i, (bg, fg, word) in enumerate(bands):
        y0 = 250 + i * 127
        d.rectangle((0, y0, 1200, y0 + 127), fill=rgba(bg))
        d.text((56, y0 + 64), word, font=heavy, fill=rgba(fg), anchor="lm")
    d.rectangle((0, 0, 1200, 250), fill=rgba(GREY))
    word = Image.open(CACHE / "logos" / "word-ink.png").convert("RGBA")
    word = trim(word)
    word.thumbnail((520, 140))
    im.alpha_composite(word, (56, 52))
    mono = ImageFont.truetype(FONT["mono"], 26)
    d.text((58, 206), "BOULDER, COLORADO · RYANLGRIFFITH.COM", font=mono, fill=rgba(DEEP))
    art = Image.open(FINAL / cut["src"]).convert("RGBA")
    art.thumbnail((450, 450))
    im.alpha_composite(art, (1200 - art.width - 24, 630 - art.height - 14))
    return im.convert("RGB")


def favicons():
    icons = CACHE / "logos"
    for s, name in ((180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png"), (32, "favicon-32.png")):
        Image.open(icons / f"icon-{s}.png").save(FINAL / name)
    big = Image.open(icons / "icon-48.png")
    big.save(FINAL / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


def main():
    data = load_data()
    cuts = make_cuts(data["projects"])
    OG.mkdir(parents=True, exist_ok=True)
    for p in data["projects"]:
        og_project(p, cuts.get(p["slug"])).save(OG / f"{p['slug']}.jpg", quality=84, optimize=True, progressive=True)
    og_site(cuts["custom-calc"]).save(OG / "site.jpg", quality=86, optimize=True, progressive=True)
    favicons()
    (CACHE / "cuts.json").write_text(json.dumps(cuts, indent=1), encoding="utf-8")
    print(len(cuts), "cut-outs,", len(data["projects"]) + 1, "share cards, favicons")


if __name__ == "__main__":
    main()
