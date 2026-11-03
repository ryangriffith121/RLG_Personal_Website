"""Builds prototypes/_shared/data/site-data.js from the live site's database.

  _data/portfolio.db               the 27 projects on RyanLGriffith.com (read-only here)
  prototypes/_tools/new_projects.json   newer projects + text for empty database rows
  ~/Desktop/Dev/<project>/...      source screenshots for the new projects (copied in)

It also writes WebP thumbnails (prototypes/_shared/media/thumbs/<slug>.webp) and copies the
DEEPWELL PICO-8 web build next to the other demos. All paths in the output are relative to
the repository root; each prototype prefixes them with its own path to the root.

Run:  python prototypes/_tools/build_data.py
"""
import html
import json
import re
import shutil
import sqlite3
import sys
from datetime import date
from pathlib import Path

from PIL import Image

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parent.parent
SHARED = REPO / "prototypes" / "_shared"
MEDIA = SHARED / "media"
THUMBS = MEDIA / "thumbs"
PROJ_MEDIA = MEDIA / "projects"
GEN = MEDIA / "generated"
DEV = Path.home() / "Desktop" / "Dev"
for d in (THUMBS, PROJ_MEDIA, SHARED / "data", SHARED / "demos"):
    d.mkdir(parents=True, exist_ok=True)

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], 1)}

# Playable PICO-8 exports already in the repo, keyed by project slug.
DEMOS = {
    "the-kingdom": "Demos/the_kingdom/kingdom.html",
    "density": "Demos/density/density.html",
    "gatsby-game": "Demos/gatsby_game/greatgatsby.html",
    "rotation-simulator": "Demos/rotation_sim/rotationsim.html",
}

# "Built with", from the Project Book's index.
STACK = {
    "custom-calc": ["ESP32", "KiCad", "TFT_eSPI", "SolidWorks"],
    "perlin-noise": ["C++", "SFML"],
    "mpy-stocks": ["ESP32", "MicroPython", "I²C OLED", "Yahoo Finance"],
    "dot-matrix-sim": ["C++", "SFML", "OpenCV"],
    "bl4s-2026": ["KiCad", "SiPMs", "SolidWorks", "Python", "Matplotlib"],
    "website-v4": ["HTML", "CSS", "JavaScript", "PHP"],
    "tcob-code": ["Python", "Arduino", "RGB LED", "webcam.js"],
    "skull-2026": ["Blender", "Photoshop", "Affinity"],
    "jpl-2025": ["SolidWorks", "Scrap wood", "3D printing", "Power tools"],
    "spotify-player": ["JavaScript", "Spotify Web API", "Vite", "Raspberry Pi"],
    "website-v3": ["PHP", "SQLite", "SQL"],
    "ryan-logo": ["Illustrator", "Photoshop", "After Effects"],
    "raycast-fps": ["Python", "Pygame"],
    "mitsubishi-design": ["Illustrator", "Photoshop"],
    "ai-image-detector": ["ML.NET", "Chrome extension", "Web server"],
    "the-kingdom": ["PICO-8", "Lua"],
    "rotation-simulator": ["PICO-8", "Lua"],
    "jpl-2024": ["VEX Robotics", "Wood", "Hot glue"],
    "micro": ["Pencil", "Illustrator"],
    "untitled-skull": ["Blender", "Pixel art"],
    "interloper": ["Playdate SDK", "Lua", "Blender"],
    "density": ["PICO-8", "Lua"],
    "gatsby-game": ["PICO-8", "Lua"],
    "disk-launcher": ["SolidWorks", "3D printing", "Laser cutter"],
    "cnc-yoyo": ["CNC mill", "G-code"],
    "typhlosion-mockup": ["Pixel art", "GBC palette"],
    "wheels": ["Watch Face Studio", "Wear OS"],
}

REPOS = {
    "bl4s-2026": "https://github.com/ryangriffith121/BL4S_Cherenkov_Simulator",
    "custom-calc": "https://github.com/ryangriffith121/Custom_Calculator_ESP32",
    "perlin-noise": "https://github.com/ryangriffith121/Perlin_Noise_GFX",
    "mpy-stocks": "https://github.com/ryangriffith121/MicroPython_Stocks",
    "dot-matrix-sim": "https://github.com/ryangriffith121/Dot_Matrix_Visualizer",
    "website-v4": "https://github.com/ryangriffith121/RLG_Personal_Website",
    "website-v3": "https://github.com/ryangriffith121/RLG_Personal_Website",
}

# Small, obvious typos in the database text.
TYPO_FIXES = [
    ("RyanLGriffith,com", "RyanLGriffith.com"),
    ("Hisuian Typhlosian", "Hisuian Typhlosion"),
    ("to date.This project", "to date. This project"),
    ("Adobe Illustrator  and", "Adobe Illustrator and"),
    ("</a>. of my website", "</a> of my website"),
]

ANCHOR = re.compile(r"<a\s+href=['\"’‘]?([^'\"’‘\s>]+)['\"’‘]?[^>]*>(.*?)</a>", re.S | re.I)


def parse_date(text):
    m = re.match(r"\s*([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})", text or "")
    if not m:
        raise ValueError(f"unparsed date: {text!r}")
    return date(int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2)))


def clean_text(raw):
    """Database text -> safe HTML: escape everything, rebuild the few links, fix spacing."""
    if not raw:
        return ""
    s = raw.replace("\r", "")
    for a, b in TYPO_FIXES:
        s = s.replace(a, b)
    out, pos = [], 0
    for m in ANCHOR.finditer(s):
        out.append(html.escape(s[pos:m.start()], quote=False))
        href, label = m.group(1).replace("\\", "/"), html.escape(m.group(2), quote=False)
        slug = next((k for k, v in DEMOS.items() if v.lower() == href.lower()), None)
        if slug:
            out.append(f'<a href="demos.html#{slug}">{label}</a>')
        elif href.startswith("project.php?id="):
            out.append(f'<a href="project.html?id={href.split("=", 1)[1]}">{label}</a>')
        else:
            out.append(label)
        pos = m.end()
    out.append(html.escape(s[pos:], quote=False))
    s = "".join(out)
    s = re.sub(r"\s*\n\s*", " ", s).strip()
    s = re.sub(r" {2,}", " ", s)
    s = s.replace(" .", ".")
    return s


def summary_text(raw):
    s = clean_text(raw)
    s = re.sub(r"(…|\.\.\.)\s*$", "", s).strip()
    if s and s[-1] not in ".!?":
        s += "."
    return s


def norm_path(p):
    return p.strip().replace("\\", "/") if p else ""


def img_info(rel):
    path = REPO / rel
    if not path.exists():
        print(f"  ! missing image {rel}", file=sys.stderr)
        return None
    with Image.open(path) as im:
        w, h = im.size
        anim = getattr(im, "is_animated", False)
    return {"src": rel, "w": w, "h": h, "anim": bool(anim)}


def make_thumb(src_rel, slug, pixel=False, width=900):
    """WebP thumbnail for grids. Pixel art is scaled with nearest-neighbour to stay crisp."""
    src = REPO / src_rel
    out = THUMBS / f"{slug}.webp"
    with Image.open(src) as im:
        im.seek(0)
        frame = im.convert("RGBA")
    if pixel or max(frame.size) <= 600:
        scale = max(1, width // frame.width)
        frame = frame.resize((frame.width * scale, frame.height * scale), Image.NEAREST)
    if frame.width > width:
        frame = frame.resize((width, round(frame.height * width / frame.width)), Image.LANCZOS)
    has_alpha = frame.getchannel("A").getextrema()[0] < 255
    (frame if has_alpha else frame.convert("RGB")).save(out, "WEBP", quality=82, method=6)
    small = frame.convert("RGB").resize((1, 1), Image.BOX).getpixel((0, 0))
    return {"src": out.relative_to(REPO).as_posix(), "w": frame.width, "h": frame.height,
            "tone": "#%02x%02x%02x" % small, "alpha": bool(has_alpha)}


def copy_new_media(slug, source_dir, names, pixel):
    """Copy a new project's screenshots in; PNGs become lossless WebP, GIFs are kept."""
    dest = PROJ_MEDIA / slug
    dest.mkdir(parents=True, exist_ok=True)
    rels = []
    for name in names:
        src = DEV / source_dir / name
        stem = name.replace("/", "_").rsplit(".", 1)[0]
        if name.lower().endswith(".gif"):
            out = dest / f"{stem}.gif"
            if src.exists():
                shutil.copy2(src, out)
        else:
            out = dest / f"{stem}.webp"
            if src.exists():
                with Image.open(src) as im:
                    im.convert("RGB").save(out, "WEBP", lossless=pixel, quality=88, method=6)
        if out.exists():
            rels.append(out.relative_to(REPO).as_posix())
        else:
            print(f"  ! {slug}: no source for {name} and no earlier copy", file=sys.stderr)
    return rels


def load_db():
    con = sqlite3.connect(REPO / "_data" / "portfolio.db")
    con.row_factory = sqlite3.Row
    tabs = {r["slug"]: dict(r) for r in con.execute("SELECT * FROM PortfolioTabs")}
    pages = {r["slug"]: dict(r) for r in con.execute("SELECT * FROM PortfolioPage")}
    con.close()
    return tabs, pages


def build():
    extra = json.loads((TOOLS / "new_projects.json").read_text(encoding="utf-8"))
    tabs, pages = load_db()
    projects = []

    for slug, tab in tabs.items():
        page = pages.get(slug, {})
        fill = extra["fill"].get(slug, {})
        cats = [c.strip() for c in (tab["categories"] or "").split(",") if c.strip()]
        d = parse_date(page.get("date") or tab["date"])
        desc = clean_text(page.get("description")) or html.escape(fill.get("description", ""), quote=False)
        learned = clean_text(page.get("whatilearned"))
        takeaway = clean_text(page.get("takeaway"))
        if learned and learned == desc:          # Untitled (Skull) repeats its description
            learned = ""
        if takeaway and takeaway == learned:     # Density repeats What I Learned
            takeaway = ""
        imgs = [norm_path(p) for p in (page.get("images") or "").split(",") if norm_path(p)]
        imgs = [i for i in (img_info(p) for p in imgs) if i]
        for r in fill.get("renders", []):
            info = img_info(f"prototypes/_shared/media/generated/{r}.webp")
            if info:
                imgs.append(info)
        for p in fill.get("extra_images", []):
            info = img_info(p)
            if info and info["src"] not in [i["src"] for i in imgs]:
                imgs.append(info)
        thumb_src = norm_path(tab["thumbnail"]) or (imgs[0]["src"] if imgs else "")
        pixel = slug in ("the-kingdom", "density", "gatsby-game", "rotation-simulator", "typhlosion-mockup")
        projects.append({
            "slug": slug,
            "title": tab["title"],
            "iso": d.isoformat(),
            "cats": [c for c in cats if c != "featured"],
            "featured": "featured" in cats,
            "summary": summary_text(tab["description"]),
            "description": desc,
            "learned": learned,
            "takeaway": takeaway,
            "highlights": fill.get("highlights", []),
            "stack": STACK.get(slug, []),
            "images": imgs,
            "thumb": make_thumb(thumb_src, slug, pixel) if thumb_src else None,
            "demo": slug if slug in DEMOS else None,
            "repo": REPOS.get(slug),
            "note": fill.get("note"),
            "status": None,
            "isNew": False,
        })

    for p in extra["projects"]:
        d = parse_date(p["date"])
        cats = p["categories"]
        if "source_dir" in p:
            rels = copy_new_media(p["slug"], p["source_dir"], p["images"], p.get("pixel", False))
        else:
            rels = [f"prototypes/_shared/media/generated/{n}.webp" for n in p.get("renders", []) + p.get("captures", [])]
        imgs = [i for i in (img_info(r) for r in rels) if i]
        thumb_src = imgs[0]["src"]
        if p.get("thumb_from"):
            stem = p["thumb_from"].replace("/", "_").rsplit(".", 1)[0]
            thumb_src = next(i["src"] for i in imgs if Path(i["src"]).stem == stem)
        demo = None
        if p.get("demo"):
            dd = p["demo"]
            dest = SHARED / "demos" / p["slug"]
            dest.mkdir(parents=True, exist_ok=True)
            for f in (dd["html"], dd["js"]):
                src = DEV / dd["src"] / f
                if src.exists():
                    shutil.copy2(src, dest / f)
            DEMOS[p["slug"]] = (dest / dd["html"]).relative_to(REPO).as_posix()
            demo = p["slug"]
        projects.append({
            "slug": p["slug"],
            "title": p["title"],
            "iso": d.isoformat(),
            "cats": [c for c in cats if c != "featured"],
            "featured": "featured" in cats,
            "summary": p["summary"],
            "description": html.escape(p["description"], quote=False),
            "learned": "",
            "takeaway": "",
            "highlights": p.get("highlights", []),
            "stack": p.get("stack", []),
            "images": imgs,
            "thumb": make_thumb(thumb_src, p["slug"], p.get("pixel", False)),
            "demo": demo,
            "repo": p.get("repo"),
            "note": p.get("note"),
            "status": p.get("status"),
            "isNew": True,
        })

    projects.sort(key=lambda p: (p["iso"], p["title"]), reverse=True)
    for n, p in enumerate(sorted(projects, key=lambda p: (p["iso"], p["title"])), 1):
        p["no"] = n

    demos = []
    demo_blurbs = {
        "deepwell": "Turn, tip and roll cubes down a 5 × 5 well. Arrows move; hold Z or X with a direction to rotate.",
        "the-kingdom": "Rule an electrical kingdom: keep both power and politics above zero. Bigmode 2025 Game Jam.",
        "density": "Procedurally generated floors and score-based enemy pathfinding.",
        "gatsby-game": "Four short driving levels that follow The Great Gatsby.",
        "rotation-simulator": "Two arms rotating at variable speeds, drawing their paths.",
    }
    for slug, path in DEMOS.items():
        p = next(x for x in projects if x["slug"] == slug)
        poster = next((i["src"] for i in p["images"] if i["src"].endswith("pico8_title.webp")), p["thumb"]["src"])
        demos.append({"slug": slug, "title": p["title"], "src": path, "blurb": demo_blurbs.get(slug, p["summary"]),
                      "thumb": poster, "iso": p["iso"]})
    demos.sort(key=lambda d: d["iso"], reverse=True)

    certs = [
        {"title": "PCEP – Certified Entry-Level Python Programmer", "short": "Python PCEP", "issuer": "Python Institute",
         "iso": "2025-04-30", "img": "_assets/portfolio/_certs/python.png"},
        {"title": "Adobe Certified Professional: Visual Design Using Adobe Photoshop", "short": "Adobe Certified Professional",
         "issuer": "Adobe", "iso": "2024-09-05", "img": "_assets/portfolio/_certs/photoshop.png"},
        {"title": "SOLIDWORKS Design Associate (CSWA)", "short": "SOLIDWORKS CSWA", "issuer": "Dassault Systèmes",
         "iso": "2023-03-22", "img": "_assets/portfolio/_certs/solidworks.png"},
        {"title": "Autodesk Certified User: Inventor", "short": "Autodesk Inventor", "issuer": "Autodesk",
         "iso": "2022-10-26", "img": "_assets/portfolio/_certs/inventor.png"},
    ]
    for c in certs:
        info = img_info(c["img"])
        c["w"], c["h"] = info["w"], info["h"]

    about = [
        "Ryan is a driven, intellectually curious person who approaches the world with a maker's instinct and a scientist's need to understand not just what is true, but why and how we know. He is the kind of person who encounters a problem, whether technical, ethical, or creative, and responds by building something. That impulse isn't purely academic; it's rooted in a genuine desire to make things better, more trustworthy, and more accessible to others.",
        "Technically, Ryan is fluent across an unusually wide range of disciplines. He is comfortable in software and hardware alike, moving between programming, circuit design, mechanical fabrication, CAD modeling, machine learning, and digital art with confidence and curiosity. He doesn't specialize narrowly. He connects domains, bringing an engineer's rigor to creative work and a designer's eye to technical problems. The result is a body of work that is as varied as it is accomplished.",
        "What motivates Ryan runs deeper than personal achievement. He is drawn to questions with real-world stakes, problems at the intersection of technology and society where thoughtful solutions can have meaningful impact. He is also motivated by the people around him. He invests in communities, supports peers, and consistently prioritizes the success of the group alongside his own. Leadership, for Ryan, is less about standing out and more about making sure others have the space and support to contribute.",
        "In terms of character, those who work alongside Ryan consistently describe the same qualities: patience, calm, reliability, and kindness. He is the person a team turns to when things get difficult, not because he has all the answers, but because he stays steady, listens carefully, and works through problems methodically rather than reactively. He is self-motivated and disciplined, but never at the expense of the people around him.",
        "Ryan's combination of technical depth, creative range, ethical awareness, and genuine collaborative spirit makes him someone who will contribute meaningfully to any environment he enters and who will make that environment better for everyone in it.",
    ]

    counts = {c: sum(1 for p in projects if c in p["cats"]) for c in ("program", "engineer", "art")}
    data = {
        "generated": date.today().isoformat(),
        "profile": {
            "name": "Ryan L. Griffith",
            "first": "Ryan", "last": "Griffith",
            "roles": ["Programmer", "Engineer", "Artist"],
            "school": "Computer Science, CU Boulder",
            "location": "Boulder, Colorado",
            "about": about,
            "portrait": "prototypes/_shared/media/generated/portrait.webp",
            "portraitDuo": "prototypes/_shared/media/generated/portrait_duotone.webp",
            "portraitSignal": "prototypes/_shared/media/generated/portrait_signal.webp",
            "logoMask": "prototypes/_shared/media/generated/logo_mask.png",
            "logo": "_assets/portfolio/_thumbnails/logov2.png",
            "favicon": "_assets/icons/logov2_websmall.png",
            "links": [
                {"label": "GitHub", "href": "https://github.com/ryangriffith121"},
                {"label": "LinkedIn", "href": "https://www.linkedin.com/in/ryan-griffith-aa3517347/"},
            ],
            "email": "",
        },
        "bl4s": {
            "team": "Centauri Stars",
            "school": "Centaurus High School, Lafayette, Colorado",
            "facts": [
                {"k": "712", "v": "proposals from 89 countries"},
                {"k": "5", "v": "winning teams worldwide"},
                {"k": "2 wks", "v": "of beam time at DESY, Hamburg"},
                {"k": "16", "v": "SiPM channels on Ryan's PCB"},
            ],
            "lines": [
                "Custom SiPM PCB designed in KiCad",
                "Mounts for remote translation stages",
                "Monte Carlo photon simulation in Python",
                "Cherenkov ring reconstructed from beam data",
            ],
            "captions": {
                "_assets/portfolio/bl4s-2026/ring.gif": "Cherenkov ring reconstructed from SiPM scans, DESY II test beam, Hamburg, 2026",
                "_assets/portfolio/bl4s-2026/data.jpg": "Real scan (top) against the simulated ring (bottom), runs 972–984, 2026",
                "_assets/portfolio/bl4s-2026/sim.jpg": "Monte Carlo photon paths inside the 50 cm quartz bar, 2026",
                "_assets/portfolio/bl4s-2026/pcb.png": "Centauri Stars SiPM DIRC Board 1, designed in KiCad, 2026",
                "_assets/portfolio/bl4s-2026/darkbox+mount.png.jpg": "Dark box and translation-stage mount, SolidWorks, 2026",
                "_assets/portfolio/bl4s-2026/setup.png": "Quartz bar, PCB and digitizer inside the dark box, DESY, 2026",
            },
        },
        "counts": {**counts, "projects": len(projects), "certs": len(certs), "demos": len(demos),
                   "years": sorted({p["iso"][:4] for p in projects})},
        "projects": projects,
        "demos": demos,
        "certs": certs,
    }
    out = SHARED / "data" / "site-data.js"
    body = json.dumps(data, ensure_ascii=False, indent=1)
    out.write_text("/* Generated by prototypes/_tools/build_data.py — do not edit by hand. */\n"
                   f"window.RLG_DATA = {body};\n", encoding="utf-8")
    print(f"wrote {out.relative_to(REPO)}: {len(projects)} projects, {len(demos)} demos, {len(certs)} certs")
    print("counts", data["counts"])


def globe_dots():
    """Land dots for the ORBIT globe, reused from the Market Dashboard project."""
    src = DEV / "market-dashboard" / "data" / "static" / "globe_dots.json"
    out = SHARED / "data" / "globe-dots.js"
    if not src.exists():
        print("  ! market-dashboard globe_dots.json not found; keeping", out.name, file=sys.stderr)
        return
    dots = json.loads(src.read_text(encoding="utf-8"))
    flat = ",".join(f"{round(d['lon'], 1)},{round(d['lat'], 1)}" for d in dots)
    out.write_text("/* Land dots (lon,lat pairs) from the Market Dashboard project's globe_dots.json */\n"
                   f"window.RLG_GLOBE = [{flat}];\n", encoding="utf-8")
    print(f"wrote {out.relative_to(REPO)}: {len(dots)} dots")


if __name__ == "__main__":
    build()
    globe_dots()
