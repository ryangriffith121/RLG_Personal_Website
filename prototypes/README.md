# RyanLGriffith.com redesign prototypes

Three complete redesigns of the site, inspired by [albedo.com](https://albedo.com): bold indigo, chartreuse and pink, giant type, technical labels and data used as design. They run side by side with the current PHP site and change none of its files.

| | Prototype | Direction |
|---|---|---|
| 01 | **[Orbit](orbit/index.html)** | Closest to Albedo. Indigo, chartreuse and space grey on a ruled three-column grid, with a pill nav and status capsule, a draggable dot-globe hero, a "how I work" grid that lights up, and a custom GRIFFITH wordmark. |
| 02 | **[Telemetry](telemetry/index.html)** | Mission control. Void black with chartreuse signal colour, a pointer-steered Cherenkov-ring detector simulation, a HUD frame, a boot sequence, a `/` command palette and a mission-log work view. |
| 03 | **[Spectrum](spectrum/index.html)** | Colour-block poster. Programming is indigo, engineering chartreuse and art pink. Variable-width type is stretched to fill each block, letters swell near the pointer, featured work sits in a sticky stacked deck, and the index is a duotone mosaic. |

Each prototype has the same five pages: **home**, **work** (filter, sort, search, grid/list), **project** (`project.html?id=<slug>`, with image viewer, lightbox and previous/next), **about** (bio and certifications) and **demos** (the PICO-8 games, playable in the page). [`index.html`](index.html) links all three.

## View them

The demos need a web server (browsers block PICO-8 carts over `file://`). From the repository root:

```bash
node prototypes/_tools/serve.mjs 5180
```

Then open <http://localhost:5180/prototypes/>. Everything is static HTML, CSS and JavaScript, so the `prototypes/` folder also works as-is on the current host, with no PHP needed.

## What's in the data

All three prototypes read one generated file, `_shared/data/site-data.js`, built from the live site's database:

- **27 projects** from `_data/portfolio.db` (`PortfolioTabs` + `PortfolioPage`), including descriptions, "What I learned", takeaways and image lists. The database is only read, never changed.
- **5 new projects** from `_tools/new_projects.json`:
  - **HOLLOWDEEP** and **DEEPWELL**, from your past Claude Code sessions ("Gothic medieval FPS game", "Pico-8 3D chess game"), with their screenshots. DEEPWELL's PICO-8 web build is playable on every Demos page.
  - **Custom MP3 Player**, **Market Dashboard** and **Custom Keyboard PCB**, from `Desktop/Dev`.
- **Custom Calculator** was in the database with no text or images. It now has a description, specs and new renders.

To rebuild after editing the database or `new_projects.json`:

```bash
python prototypes/_tools/build_data.py
```

### Please review

- **New copy is a draft.** The text for the five new projects and the calculator comes from each project's README and the Project Book. It has no "What I learned" or "Takeaway" sections, because those should be in your words. Edit it in `_tools/new_projects.json`.
- **New home-page copy**, such as Orbit's "How I work" principles and the hero lines, paraphrases your About text and project takeaways.
- **Small typo fixes** are applied at build time only, not in the database. For example "RyanLGriffith,com" becomes "RyanLGriffith.com" and "Typhlosian" becomes "Typhlosion". Dates are re-parsed, so "February 2rd" becomes "February 2". Two duplicated fields are hidden: Untitled (Skull)'s "What I learned" repeats its description, and Density's takeaway repeats its "What I learned".
- **No email address is published.** The contact sections link GitHub and LinkedIn. To add an email, set `"email"` in the profile block of `build_data.py`.

## Generated media

Everything in `_shared/media/` is made by scripts in `_tools/`:

| Media | Made by |
|---|---|
| Calculator renders (hero, exploded, top) | `blender/render_calculator.py`, run in Blender 5 on the project's own `Calculator.blend`. Your colours are kept, and the screen shows the firmware's test graphics. |
| MP3 player concept renders (exterior, x-ray) | `blender/render_mp3_concept.py`, modelled from the README's dimensions and parts list. Labelled as a concept, not the SolidWorks model. |
| Keyboard schematic blueprint | `kicad-cli sch export svg` → `rasterize_svg.mjs` → recoloured in `make_media.py` |
| Market Dashboard screenshots | `capture_market.mjs`, taken from the dashboard running in `--offline` mode |
| Duotone portraits, logo mask | `make_media.py` |
| Thumbnails (WebP) and new-project images | `build_data.py` |
| Chooser previews | `make_previews.mjs` |
| Globe land dots | Reused from the Market Dashboard's `globe_dots.json` |

## Tests

```bash
cd prototypes/_tools && npm install
node test_layout.mjs                           # all prototypes, sample of project pages
node test_layout.mjs orbit,telemetry,spectrum --all-projects
node test_layout.mjs orbit --selftest          # proves the checks catch real defects
node motion_smoke.mjs http://localhost:5180/prototypes/   # with animations on
```

`test_layout.mjs` uses your installed Chrome (through `playwright-core`) to load every page at 375, 820, 1280 and 1920 px wide. On each page it fails on:

- text overlapping other text
- text covered by anything drawn on top of it
- controls overlapping each other
- text pushed off-screen or clipped
- horizontal overflow
- broken images, script errors and failed requests

It also checks behaviour: every filter count, search, sort, list view, URL state, the image viewer and lightbox, fallback for unknown projects, demo loading, mobile menus and every internal link. `--selftest` injects known bugs and confirms each one is caught.

## Layout

```
prototypes/
  index.html            chooser page
  orbit/ telemetry/ spectrum/
    index.html work.html project.html about.html demos.html
    css/  js/
  _shared/
    data/site-data.js   generated: projects, demos, certifications, profile
    data/globe-dots.js  generated: land dots for Orbit's globe
    js/core.js          data helpers, filtering, lightbox, reveal-on-scroll
    js/wordmark.js      the custom GRIFFITH letterforms (SVG)
    media/  demos/
  _tools/               build, media, preview and test scripts
```

Fonts come from Google Fonts: Instrument Sans, Geist Mono, JetBrains Mono, Space Grotesk, Unbounded, Anybody and DM Mono. Colours follow Albedo's palette; no Albedo assets, logos or copy are used.
