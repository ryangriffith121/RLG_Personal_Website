<?php
/* The shell every page shares: <head> with search and share metadata, the translucent nav, the
   footer with the RYAN word mark, the live feed along the bottom and the search palette. */
require_once __DIR__ . '/site.php';

/* $m: title, description, path (canonical, relative to the site root), image (share card), type
   (website | article | profile), jsonld (list of schema.org objects), page (body data-page), theme */
function page_head(array $m): void
{
    $path = $m['path'] ?? '';
    $canonical = url($path);
    $image = url($m['image'] ?? 'media/og/site.jpg');
    $title = $m['title'];
    $desc = $m['description'] ?? SITE_DESC;
    $page = $m['page'] ?? '';
    $nav = [['portfolio', 'Work', 'portfolio.php'], ['about', 'About', 'about.php'], ['demos', 'Demos', 'demos.php'], ['contact', 'Contact', '#contact']];
    $graph = array_merge([website_ld()], $m['jsonld'] ?? []);
    ?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>document.documentElement.classList.add('js');setTimeout(function(){if(!window.RLG)document.documentElement.classList.remove('js')},4000)</script>
  <title><?= e($title) ?></title>
  <meta name="description" content="<?= e($desc) ?>">
  <link rel="canonical" href="<?= e($canonical) ?>">
  <meta name="robots" content="<?= !empty($m['noindex']) ? 'noindex, follow' : 'index, follow, max-image-preview:large' ?>">
  <meta name="author" content="<?= e(SITE_NAME) ?>">
  <meta name="theme-color" content="<?= e($m['theme'] ?? '#412db5') ?>">
  <meta property="og:site_name" content="<?= e(SITE_NAME) ?>">
  <meta property="og:type" content="<?= e($m['type'] ?? 'website') ?>">
  <meta property="og:title" content="<?= e($m['ogtitle'] ?? $title) ?>">
  <meta property="og:description" content="<?= e($desc) ?>">
  <meta property="og:url" content="<?= e($canonical) ?>">
  <meta property="og:image" content="<?= e($image) ?>">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="<?= e($m['imagealt'] ?? $title) ?>">
  <meta property="og:locale" content="en_US">
<?php if (($m['type'] ?? '') === 'profile'): ?>
  <meta property="profile:first_name" content="Ryan">
  <meta property="profile:last_name" content="Griffith">
<?php endif; ?>
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="<?= e($m['ogtitle'] ?? $title) ?>">
  <meta name="twitter:description" content="<?= e($desc) ?>">
  <meta name="twitter:image" content="<?= e($image) ?>">
  <link rel="icon" href="favicon.ico" sizes="any">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">
  <link rel="sitemap" type="application/xml" href="sitemap.php">
  <link rel="preload" href="assets/fonts/anybody-400-900.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/instrument-sans-400-700.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="<?= asset('assets/fonts/fonts.css') ?>">
  <link rel="stylesheet" href="<?= asset('assets/css/site.css') ?>">
  <script type="application/ld+json"><?= json_encode(['@context' => 'https://schema.org', '@graph' => $graph], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?></script>
</head>
<body data-page="<?= e($page) ?>">
<a class="skip" href="#main">Skip to content</a>
<header class="nav">
  <a class="nav__brand" href="./" aria-label="Ryan L. Griffith, home"><?= svg('logo-mark', 'nav__logo') ?><span>Ryan L. Griffith</span></a>
  <div class="nav__right">
    <nav class="nav__links" aria-label="Primary">
      <?php foreach ($nav as [$key, $label, $href]): ?><a href="<?= e($href) ?>"<?= $key === $page ? ' aria-current="page"' : '' ?>><?= e($label) ?></a><?php endforeach; ?>
    </nav>
    <button class="nav__search" type="button" id="open-palette" aria-haspopup="dialog" aria-controls="palette">Search <kbd>/</kbd></button>
    <button class="nav__menu" type="button" aria-expanded="false" aria-controls="menu">Menu</button>
  </div>
</header>
<div class="menu" id="menu" data-open="false" aria-hidden="true">
  <?php foreach ([['./', 'Home', 't-grey'], ['portfolio.php', 'Work', 't-indigo'], ['about.php', 'About', 't-lime'], ['demos.php', 'Demos', 't-pink'], ['#contact', 'Contact', 't-ink']] as $i => [$href, $label, $t]): ?>
  <a class="<?= $t ?>" href="<?= e($href) ?>"><?= e($label) ?><span><?= sprintf('%02d', $i) ?></span></a>
  <?php endforeach; ?>
</div>
<main id="main">
<?php
}

function page_foot(array $o = []): void
{
    $c = counts();
    $pr = profile();
    $feed = array_slice(projects(), 0, 16);
    ?>
</main>
<footer class="foot" id="contact">
  <div class="foot__cta t-lime">
    <h2 class="h2" data-reveal><?= e(CTA_LINE) ?></h2>
    <div class="foot__links">
      <?php foreach ($pr['links'] as $l): ?><a href="<?= e($l['href']) ?>" rel="me noopener" target="_blank"><span><?= e($l['label']) ?></span><span class="arr" aria-hidden="true">↗</span></a><?php endforeach; ?>
      <?php if ($pr['email']): ?><a href="mailto:<?= e($pr['email']) ?>"><span><?= e($pr['email']) ?></span><span class="arr" aria-hidden="true">→</span></a><?php endif; ?>
      <a href="portfolio.php"><span>All <?= $c['projects'] ?> projects</span><span class="arr" aria-hidden="true">→</span></a>
      <a href="demos.php"><span>Play the demos</span><span class="arr" aria-hidden="true">→</span></a>
    </div>
  </div>
  <div class="foot__mark t-ink">
    <a class="wordmark" href="./" aria-label="Ryan L. Griffith, home"><?= svg('logo-word', 'wordmark__svg') ?></a>
    <div class="foot__bottom mono"><span>© <?= date('Y') ?> Ryan L. Griffith · Boulder, Colorado</span>
      <nav aria-label="Footer"><a href="./">Home</a><a href="portfolio.php">Work</a><a href="about.php">About</a><a href="demos.php">Demos</a><a href="#main">Top ↑</a></nav></div>
  </div>
</footer>
<div class="feed" aria-hidden="true">
  <span class="feed__sig mono"><i class="led"></i>Feed</span>
  <div class="feed__track"><div class="feed__run mono">
    <?php for ($k = 0; $k < 2; $k++): foreach ($feed as $p): ?><a href="project.php?id=<?= e($p['slug']) ?>" tabindex="-1"><i class="dot dot--<?= e($p['cats'][0]) ?>"></i><?= e(rlg_id($p)) ?> · <?= e(strtoupper($p['title'])) ?> · <?= e(fmt_date($p['iso'], 'mono')) ?></a><?php endforeach; endfor; ?>
  </div></div>
  <span class="feed__count mono"><?= $c['projects'] ?> logged</span>
</div>
<div class="palette" id="palette" role="dialog" aria-modal="true" aria-label="Search projects and pages" hidden>
  <div class="palette__box">
    <div class="palette__in"><span aria-hidden="true">/</span><input id="palette-q" type="text" placeholder="Search projects, tools, years…" autocomplete="off" spellcheck="false" aria-label="Search" aria-controls="palette-list"></div>
    <ul id="palette-list" role="listbox" aria-label="Results"></ul>
    <div class="palette__foot mono"><span>↑ ↓ select</span><span>↵ open</span><span>esc close</span></div>
  </div>
</div>
<script type="application/json" id="rlg-index"><?= json_encode(search_index(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
<script src="<?= asset('assets/js/site.js') ?>" defer></script>
<?php foreach ($o['scripts'] ?? [] as $s): ?><script src="<?= asset($s) ?>" defer></script>
<?php endforeach; ?>
</body>
</html>
<?php
}

/* ------------------------------------------------------------ schema.org */
function person_ld(): array
{
    $pr = profile();
    return [
        '@type' => 'Person', '@id' => url('#ryan'), 'name' => $pr['name'], 'url' => url(),
        'image' => url($pr['portrait']), 'jobTitle' => 'Programmer, engineer and artist',
        'description' => SITE_DESC,
        'address' => ['@type' => 'PostalAddress', 'addressLocality' => 'Boulder', 'addressRegion' => 'CO', 'addressCountry' => 'US'],
        'affiliation' => ['@type' => 'CollegeOrUniversity', 'name' => 'University of Colorado Boulder'],
        'award' => 'CERN Beamline for Schools 2026, winning team (Centauri Stars)',
        'knowsAbout' => ['Programming', 'Game development', 'PICO-8', 'PCB design', 'KiCad', 'SolidWorks', 'Blender', 'Pixel art', 'Embedded systems', 'ESP32'],
        'sameAs' => array_column($pr['links'], 'href'),
    ];
}

function website_ld(): array
{
    return ['@type' => 'WebSite', '@id' => url('#site'), 'name' => SITE_NAME, 'url' => url(), 'inLanguage' => 'en', 'author' => ['@id' => url('#ryan')]];
}

function breadcrumbs_ld(array $trail): array
{
    $items = [];
    foreach ($trail as $i => [$name, $path]) {
        $items[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $name, 'item' => url($path)];
    }
    return ['@type' => 'BreadcrumbList', 'itemListElement' => $items];
}

/* ------------------------------------------------------------ shared pieces */
function corners(string $c = ''): string
{
    return '<i class="rc' . ($c ? ' rc--' . e($c) : '') . '" aria-hidden="true"></i>';
}

/* the image for a project panel: its transparent cut-out when there is one, else the thumbnail */
function panel_img(array $p, bool $eager = false): string
{
    if ($p['cut']) {
        return '<div class="pimg pimg--cut">' . img($p['cut'], '', '', $eager) . '</div>';
    }
    return '<div class="pimg' . ($p['pixel'] ? ' pimg--pixel' : '') . '">' . img($p['thumb'], '', '', $eager) . '</div>';
}

/* the few facts Telemetry showed on every card */
function stats(array $p, bool $full = false): string
{
    $rows = [['Logged', fmt_date($p['iso'], 'dot')], ['Class', cats_label($p, true)], ['Stack', implode(' · ', array_slice($p['stack'], 0, 3)) ?: '—']];
    if ($full) {
        $rows[] = ['Media', count($p['images']) . ' image' . (count($p['images']) === 1 ? '' : 's')];
        if ($p['status']) {
            $rows[] = ['Status', $p['status']];
        }
    }
    $out = '<dl class="stats mono">';
    foreach ($rows as [$k, $v]) {
        $out .= '<div><dt>' . e($k) . '</dt><dd>' . e($v) . '</dd></div>';
    }
    return $out . '</dl>';
}

/* one mosaic tile: square image, colour by discipline, a little data */
function tile(array $p, bool $big = false, bool $hidden = false): string
{
    $hay = project_hay($p);
    ob_start(); ?>
<article class="tile <?= theme($p) ?><?= $big ? ' tile--big' : '' ?><?= $p['featured'] ? ' is-featured' : '' ?>"<?= $hidden ? ' hidden' : '' ?> data-slug="<?= e($p['slug']) ?>" data-cats="<?= e(implode(' ', $p['cats'])) ?>"
  data-featured="<?= $p['featured'] ? 1 : 0 ?>" data-new="<?= $p['isNew'] ? 1 : 0 ?>" data-iso="<?= e($p['iso']) ?>" data-title="<?= e($p['title']) ?>" data-hay="<?= e($hay) ?>">
  <div class="tile__top mono"><span><?= e(rlg_id($p)) ?></span><span><?= e(fmt_date($p['iso'], 'mono')) ?></span></div>
  <div class="tile__img"><?= panel_img($p) ?><?= corners() ?></div>
  <h3><a href="project.php?id=<?= e($p['slug']) ?>" data-stretch><?= e($p['title']) ?></a></h3>
  <p class="sum"><?= e($p['summary']) ?></p>
  <?= stats($p) ?>
</article>
<?php return ob_get_clean();
}
