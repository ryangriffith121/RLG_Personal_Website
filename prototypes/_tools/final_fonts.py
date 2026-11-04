"""Self-hosts the final site's fonts (SIL Open Font License): Anybody, Instrument Sans, DM Mono.

Run:  python prototypes/_tools/final_fonts.py
Fetches Google Fonts' CSS, keeps the Latin subset, downloads the WOFF2 files into
final/assets/fonts/ and writes final/assets/fonts/fonts.css with local URLs. Also saves an
Anybody TrueType to .cache/final/fonts for drawing the Open Graph cards with PIL.
"""
import re, urllib.request
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
OUT = TOOLS.parent.parent / "final" / "assets" / "fonts"
CACHE = TOOLS / ".cache" / "final" / "fonts"
FAMILIES = "family=Anybody:wdth,wght@50..150,400..900&family=Instrument+Sans:wght@400..700&family=DM+Mono:wght@400;500"
MODERN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def get(url, ua=MODERN):
    req = urllib.request.Request(url, headers={"User-Agent": ua})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    css = get(f"https://fonts.googleapis.com/css2?{FAMILIES}&display=swap").decode()
    blocks = re.findall(r"/\* ([a-z-]+) \*/\s*(@font-face\s*{[^}]+})", css)
    out = ["/* Self-hosted from Google Fonts (SIL Open Font License), Latin subset. Built by final_fonts.py. */"]
    for subset, block in blocks:
        if subset != "latin":
            continue
        fam = re.search(r"font-family: '([^']+)'", block).group(1)
        weight = re.search(r"font-weight: ([\d ]+);", block).group(1).replace(" ", "-")
        url = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)
        name = f"{fam.lower().replace(' ', '-')}-{weight}.woff2"
        (OUT / name).write_bytes(get(url))
        out.append(block.replace(url, name))
        print(f"{name:34} {(OUT / name).stat().st_size // 1024} KB")
    (OUT / "fonts.css").write_text("\n".join(out) + "\n", encoding="utf-8")
    # static TrueType cuts for PIL (Google serves TTF to clients that do not announce WOFF2)
    for name, fam in [("Anybody-Heavy.ttf", "Anybody:wdth,wght@125,850"), ("Anybody-Semi.ttf", "Anybody:wdth,wght@100,600"),
                      ("DMMono.ttf", "DM+Mono:wght@500")]:
        ttf_css = get(f"https://fonts.googleapis.com/css2?family={fam}", ua="python-urllib").decode()
        ttf = re.search(r"url\((https://[^)]+\.ttf)\)", ttf_css)
        if ttf:
            (CACHE / name).write_bytes(get(ttf.group(1)))
            print(f"{name:34} {(CACHE / name).stat().st_size // 1024} KB (for the share images)")


if __name__ == "__main__":
    main()
