"""Builds the final site's database and copies every asset it uses into final/.

Run (after build_data.py and make_final_media.py):  python prototypes/_tools/build_final.py

final/data/portfolio.db
  PortfolioTabs, PortfolioPage  the live site's two tables with the same columns, now holding every
                                entry: the 27 from _data/portfolio.db plus the 5 new ones
  ProjectMeta                   the extra detail the new pages show: number, ISO date, flags, stack,
                                highlights, status, links, thumbnail and cut-out
  ProjectImages                 each gallery image with its size and caption
  Demos, Certifications
final/media/p/<slug>/           web copies of every project image: stills as WebP (lossless for
                                pixel art), animations as animated WebP
final/media/thumbs, certs, about
final/demos/<slug>/             the playable PICO-8 builds
final/assets/data/globe-dots.js
Originals stay where they are (_assets/, the project folders); only web copies go into final/.
"""
import json, re, shutil, sqlite3, html
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from PIL import Image, ImageSequence

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parent.parent
FINAL = REPO / "final"
SHARED = REPO / "prototypes" / "_shared"
PIXEL = re.compile(r"the-kingdom|density|gatsby|rotation|typhlosion|deepwell|hollowdeep|interloper")
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
# The live table lists disciplines alphabetically, but the site colours a project by its first one,
# so projects whose main discipline is not first alphabetically are listed lead-first here.
LEAD = {"bl4s-2026": ["engineer", "program", "art"]}


def load_data():
    s = (SHARED / "data" / "site-data.js").read_text(encoding="utf-8")
    return json.loads(s[s.index("=") + 1:].strip().rstrip(";"))


def fresh(src, dst):
    return dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime


def web_still(src, dst, pixel=False, side=1800):
    if not fresh(src, dst):
        dst.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(src) as im:
            im.seek(0)
            alpha = im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info)
            fr = im.convert("RGBA" if alpha else "RGB")
        if max(fr.size) > side:
            s = side / max(fr.size)
            fr = fr.resize((round(fr.width * s), round(fr.height * s)), Image.NEAREST if pixel else Image.LANCZOS)
        if pixel:
            fr.save(dst, "WEBP", lossless=True, method=6)
        else:
            fr.save(dst, "WEBP", quality=84, method=6)
    with Image.open(dst) as im:
        return im.size, False


def web_anim(src, dst, pixel=False, side=1000):
    """GIF -> animated WebP, keeping every frame's timing."""
    if not fresh(src, dst):
        dst.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(src) as im:
            frames, durations = [], []
            low_colour = len(im.getcolors(4096) or range(9999)) <= 64 if im.mode == "P" else False
            for fr in ImageSequence.Iterator(im):
                durations.append(max(20, fr.info.get("duration", 80)))
                f = fr.convert("RGBA")
                if max(f.size) > side:
                    s = side / max(f.size)
                    f = f.resize((round(f.width * s), round(f.height * s)), Image.NEAREST if pixel else Image.LANCZOS)
                frames.append(f)
        lossless = pixel or low_colour
        frames[0].save(dst, "WEBP", save_all=True, append_images=frames[1:], duration=durations, loop=0,
                       lossless=lossless, quality=72, method=4 if not lossless else 3)
    with Image.open(dst) as im:
        return im.size, getattr(im, "n_frames", 1) > 1


def web_copy(src_rel, dst_dir, pixel=False):
    """Copy one repo-relative image into final/ as WebP. Returns (final path, w, h, animated)."""
    src = REPO / src_rel
    stem = Path(src_rel).name.rsplit(".", 1)[0]
    dst = FINAL / dst_dir / f"{re.sub(r'[^A-Za-z0-9_.-]+', '-', stem)}.webp"
    if src.suffix.lower() == ".gif":
        (w, h), anim = web_anim(src, dst, pixel)
    elif src.suffix.lower() == ".webp" and not pixel and src.stat().st_size < 400_000:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        with Image.open(dst) as im:
            (w, h), anim = im.size, getattr(im, "n_frames", 1) > 1
    else:
        (w, h), anim = web_still(src, dst, pixel)
    return dst.relative_to(FINAL).as_posix(), w, h, anim


def long_date(iso):
    y, m, d = map(int, iso.split("-"))
    return f"{MONTHS[m - 1]} {d}, {y}"


def unix(iso):
    y, m, d = map(int, iso.split("-"))
    return int(datetime(y, m, d, tzinfo=timezone(timedelta(hours=-7))).timestamp())   # midnight in Boulder (MST), as the live data


def site_links(s):
    """The prototypes pointed links at their .html pages; the final site's pages are PHP."""
    return (s or "").replace('href="project.html?id=', 'href="project.php?id=').replace('href="demos.html#', 'href="demos.php#')


SCHEMA = """
CREATE TABLE "PortfolioTabs" ("id" INTEGER NOT NULL UNIQUE, "slug" TEXT NOT NULL UNIQUE, "title" TEXT, "date" TEXT,
  "unixdate" INTEGER, "description" TEXT, "thumbnail" TEXT, "categories" TEXT, PRIMARY KEY("id"));
CREATE TABLE "PortfolioPage" ("id" INTEGER NOT NULL, "slug" TEXT NOT NULL UNIQUE, "title" NUMERIC NOT NULL, "date" TEXT NOT NULL,
  "description" TEXT NOT NULL, "whatilearned" TEXT NOT NULL, "takeaway" TEXT NOT NULL, "images" TEXT, PRIMARY KEY("id" AUTOINCREMENT));
CREATE TABLE "ProjectMeta" (
  "slug" TEXT PRIMARY KEY, "iso" TEXT NOT NULL, "featured" INTEGER NOT NULL DEFAULT 0, "is_new" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT, "stack" TEXT, "highlights" TEXT, "status" TEXT, "repo" TEXT, "demo" TEXT, "note" TEXT,
  "thumb" TEXT, "thumb_w" INTEGER, "thumb_h" INTEGER, "tone" TEXT, "alpha" INTEGER DEFAULT 0, "pixel" INTEGER DEFAULT 0,
  "cutout" TEXT, "cutout_w" INTEGER, "cutout_h" INTEGER, "cutout_kind" TEXT, "og" TEXT);
CREATE TABLE "ProjectImages" ("slug" TEXT NOT NULL, "position" INTEGER NOT NULL, "path" TEXT NOT NULL, "width" INTEGER,
  "height" INTEGER, "animated" INTEGER DEFAULT 0, "caption" TEXT, PRIMARY KEY("slug", "position"));
CREATE TABLE "Demos" ("slug" TEXT PRIMARY KEY, "position" INTEGER, "title" TEXT, "path" TEXT, "blurb" TEXT, "poster" TEXT, "iso" TEXT);
CREATE TABLE "Certifications" ("position" INTEGER PRIMARY KEY, "title" TEXT, "short" TEXT, "issuer" TEXT, "iso" TEXT,
  "image" TEXT, "width" INTEGER, "height" INTEGER);
"""


def main():
    data = load_data()
    cuts = json.loads((TOOLS / ".cache" / "final" / "cuts.json").read_text(encoding="utf-8"))
    live = sqlite3.connect(REPO / "_data" / "portfolio.db")
    live_ids = {slug: i for i, slug in live.execute("SELECT id, slug FROM PortfolioTabs")}
    live.close()
    (FINAL / "data").mkdir(parents=True, exist_ok=True)
    db_path = FINAL / "data" / "portfolio.db"
    if db_path.exists():
        db_path.unlink()
    db = sqlite3.connect(db_path)
    db.executescript(SCHEMA)
    captions = data["bl4s"]["captions"]
    next_id = max(live_ids.values()) + 1
    total = 0
    for p in sorted(data["projects"], key=lambda q: (q["iso"], q["title"])):
        slug = p["slug"]
        pixel = bool(PIXEL.search(slug))
        pid = live_ids.get(slug)
        if pid is None:
            pid, next_id = next_id, next_id + 1
        imgs = []
        for k, im in enumerate(p["images"]):
            path, w, h, anim = web_copy(im["src"], f"media/p/{slug}", pixel)
            imgs.append((slug, k, path, w, h, int(anim), captions.get(im["src"])))
            total += 1
        thumb = FINAL / "media" / "thumbs" / f"{slug}.webp"
        thumb.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(REPO / p["thumb"]["src"], thumb)
        thumb_rel = thumb.relative_to(FINAL).as_posix()
        cats = LEAD.get(slug, p["cats"]) + (["featured"] if p["featured"] else [])
        summary = html.unescape(p["summary"])
        db.execute("INSERT INTO PortfolioTabs VALUES (?,?,?,?,?,?,?,?)",
                   (pid, slug, p["title"], long_date(p["iso"]), unix(p["iso"]), summary, thumb_rel, ",".join(cats)))
        db.execute("INSERT INTO PortfolioPage VALUES (?,?,?,?,?,?,?,?)",
                   (pid, slug, p["title"], long_date(p["iso"]), site_links(p["description"]), site_links(p["learned"]),
                    site_links(p["takeaway"]), ",".join(i[2] for i in imgs)))
        c = cuts.get(slug)
        db.execute("INSERT INTO ProjectMeta VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (slug, p["iso"], int(p["featured"]), int(p["isNew"]), summary, json.dumps(p["stack"], ensure_ascii=False),
                    json.dumps(p["highlights"], ensure_ascii=False), p["status"], p["repo"], p["demo"], p["note"],
                    thumb_rel, p["thumb"]["w"], p["thumb"]["h"], p["thumb"]["tone"], int(p["thumb"]["alpha"]), int(pixel),
                    c["src"] if c else None, c["w"] if c else None, c["h"] if c else None, c["kind"] if c else None,
                    f"media/og/{slug}.jpg"))
        db.executemany("INSERT INTO ProjectImages VALUES (?,?,?,?,?,?,?)", imgs)

    for k, d in enumerate(data["demos"]):
        src_dir = (REPO / d["src"]).parent
        dst_dir = FINAL / "demos" / d["slug"]
        if dst_dir.exists():
            shutil.rmtree(dst_dir)
        shutil.copytree(src_dir, dst_dir)
        poster = web_copy(d["thumb"], "media/demos", True)[0]
        db.execute("INSERT INTO Demos VALUES (?,?,?,?,?,?,?)", (d["slug"], k, d["title"], f"demos/{d['slug']}/{Path(d['src']).name}",
                                                                d["blurb"], poster, d["iso"]))
    for k, c in enumerate(data["certs"]):
        path, w, h, _ = web_copy(c["img"], "media/certs")
        db.execute("INSERT INTO Certifications VALUES (?,?,?,?,?,?,?,?)", (k, c["title"], c["short"], c["issuer"], c["iso"], path, w, h))
    db.commit()
    counts = {t: db.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0] for t in ("PortfolioTabs", "PortfolioPage", "ProjectMeta", "ProjectImages", "Demos", "Certifications")}
    db.close()

    pr = data["profile"]
    for key in ("portrait", "portraitDuo"):
        web_copy(pr[key], "media/about")
    (FINAL / "assets" / "data").mkdir(parents=True, exist_ok=True)
    shutil.copy2(SHARED / "data" / "globe-dots.js", FINAL / "assets" / "data" / "globe-dots.js")
    print("tables", counts)
    print(f"{total} gallery images, media folder:", round(sum(f.stat().st_size for f in (FINAL / 'media').rglob('*') if f.is_file()) / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
