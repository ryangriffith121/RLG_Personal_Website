# RyanLGriffith.com — final site

The finished site, built from the Spectrum prototype (colour blocks, stretch-to-fit type, square
mosaic) with these additions:

- **From Orbit:** the translucent header, plus the globe with the DESY, CERN and JPL routes.
- **From Telemetry:** the search palette, the live feed along the bottom, the simple project data on
  each panel, and coloured rounded corners.
- **New:** a koi pond with one fish per project, drawn as smooth vector shapes. A fish's size
  follows how many images the project has.

Everything in this folder is the website, with every asset it uses. Nothing loads from another
server, and nothing renders 3D in the browser: the globe and the pond are plain Canvas 2D, and
all the 3D work is pre-rendered images.

## Run it locally

You need PHP 7.4 or newer with the `pdo_sqlite` extension (it ships with PHP; on Windows make sure
`extension=pdo_sqlite` is enabled in `php.ini`).

```bash
cd final
php -S localhost:8000
```

Then open <http://localhost:8000>.

Every link and asset path is relative, so the site also works from a subfolder. If you run
`php -S localhost:8000` from the repository root, open <http://localhost:8000/final/>.

## Put it online

Upload the contents of this folder to the web root. On Apache, `.htaccess` handles the rest:

- the 404 page;
- 301 redirects from the old `index.html`, `about.html`, `demos.html` and `Demos/<game>/` addresses;
- blocking `data/` and `inc/`;
- cache headers and compression.

Old `portfolio.php?filter=…` and `project.php?id=…` links keep working.

If the domain is not `https://ryanlgriffith.com/`, change `SITE_URL` in `inc/site.php`. Canonical
links, share cards, the JSON-LD and the sitemap are all built from it.

On nginx or another server without `.htaccess`, add rules that deny `/data/` and `/inc/`, and set
`error_page 404 /404.php`.

## What's where

| Path | What it is |
| --- | --- |
| `index.php` | Home: role bands, intro, marquee, featured deck, globe, numbers, latest mosaic, koi pond |
| `portfolio.php` | Work index: filter, search, sort, list view, the block timeline |
| `project.php?id=<slug>` | One project: header cut-out, data strip, gallery and lightbox, write-up, older/newer |
| `about.php` | About: hello and portrait, toolbox (with how many projects use each tool), bio, certificates |
| `demos.php` | Arcade: the five PICO-8 games, played in the page (`demos.php#<slug>` opens one) |
| `404.php`, `sitemap.php`, `robots.txt`, `site.webmanifest`, `favicon.*` | Error page and search-engine files |
| `inc/site.php` | Settings, the database, and helpers. Also the footer line `CTA_LINE`. |
| `inc/layout.php` | Page head (all metadata), nav, footer, feed, search palette and shared pieces |
| `assets/css/site.css` | All styles |
| `assets/js/site.js` | Menu, search palette (`/` or Ctrl+K), filters, gallery, lightbox, arcade, certificates |
| `assets/js/globe.js`, `assets/js/pond.js` | The globe and the koi pond (Canvas 2D) |
| `assets/fonts/` | Anybody, Instrument Sans and DM Mono, self-hosted (SIL Open Font License) |
| `assets/img/` | The logo mark and the horizontal RYAN word mark, as SVG |
| `media/` | Project images (`p/`), thumbnails, transparent cut-outs (`cut/`), share cards (`og/`), about, certificates, demo posters |
| `demos/` | The PICO-8 game files |
| `data/portfolio.db` | The SQLite database |

Every page is rendered by PHP and reads fine with JavaScript off. Scripts only add the motion and
interaction on top.

## The footer line

`CTA_LINE` in `inc/site.php` sets the line above the contact links on every page. It is
**"Build something with me."** Other options that were considered:

- Come build something with me.
- Got something to build?
- Say hello.
- The workbench is open.
- Questions, ideas, side quests: send them over.

## The database

`data/portfolio.db` keeps the old site's two tables and adds four:

| Table | Holds |
| --- | --- |
| `PortfolioTabs` | One row per project: `id, slug, title, date, unixdate, description, thumbnail, categories` (same as before) |
| `PortfolioPage` | One row per project: `id, slug, title, date, description, whatilearned, takeaway, images` (same as before) |
| `ProjectMeta` | Optional extras per slug: `iso` date, `featured`, `is_new`, `summary`, `stack` (JSON list), `highlights` (JSON list), `status`, `repo`, `demo`, `note`, thumbnail size and tone, `pixel` (crisp scaling), the `cutout` (a transparent asset; with `cutout_kind` `photo` it is the artwork itself, shown colourised like the photos), the `og` share card |
| `ProjectImages` | Gallery images per slug: `position, path, width, height, animated, caption` |
| `Demos` | The arcade cartridges: `slug, position, title, path, blurb, poster, iso` |
| `Certifications` | `position, title, short, issuer, iso, image, width, height` |

### Adding a project

The quickest way is the old way: add one row to `PortfolioTabs` and one to `PortfolioPage` with
the same `id` and `slug`. A few notes:

- `categories` is a comma list of `program`, `engineer`, `art` (and optionally `featured`). The
  first discipline colours the project.
- `images` is a comma list of paths relative to this folder, e.g. `media/p/my-slug/1.webp`. Put the
  files there.
- `unixdate` sets the order.

The project then shows up on the home page, the work index, the timeline, the feed, the search, the
sitemap and the pond, with sensible defaults: the summary comes from the tab description, and it
gets the site-wide share card.

For the full treatment (stack tags, highlights, a cut-out, a share card, image sizes and captions),
also add a `ProjectMeta` row and `ProjectImages` rows. Or edit the data in `prototypes/` and rebuild
(next section).

## Rebuilding the assets

The tools that made this folder live in `prototypes/_tools/`, run from the repository root:

1. `python prototypes/_tools/build_data.py` collects the project data from the live database and the
   project folders.
2. `python prototypes/_tools/final_fonts.py` downloads the fonts (Google Fonts' Latin files).
3. `node prototypes/_tools/final_logos.mjs` makes the logos and favicons from Ryan's own logo SVGs.
4. `python prototypes/_tools/make_final_media.py` makes the transparent cut-outs and the share cards.
   It needs Blender, which it uses through `blender/render_final.py` for the 3D cut-outs, including
   the recoloured calculator.
5. `python prototypes/_tools/build_final.py` writes `data/portfolio.db` and copies every image and
   game into this folder.

## Tests

```bash
cd prototypes/_tools
npm install
node test_final.mjs
```

The test starts its own `php -S` and checks the following in headless Chrome:

- every page at phone, tablet, laptop and wide sizes, for overlapping or cut-off text, sideways
  scrolling, broken images, console errors and PHP warnings;
- the filters, search, gallery, lightbox, certificates, arcade, menu, globe and pond;
- the metadata, sitemap and robots.txt;
- the pages with scripts turned off;
- a project added the old way.

Options:

- `--all-projects` checks every project page at all four sizes, not just at laptop size.
- `--shots` saves section screenshots to `prototypes/_tools/.cache/final-test/`.
- `--verbose` lists every passing check.
- `--base http://localhost:8000/` tests a server that is already running.
