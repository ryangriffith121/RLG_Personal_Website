<?php
require_once __DIR__ . '/inc/layout.php';
$c = counts();
$all = projects();
// the old site linked portfolio.php?filter=recent|oldest|alphabetical|reverse_alphabetical
$legacy = ['recent' => 'recent', 'oldest' => 'oldest', 'alphabetical' => 'az', 'reverse_alphabetical' => 'za'];
$sort = qs('sort') ?: ($legacy[qs('filter')] ?? 'recent');
if (!in_array($sort, ['recent', 'oldest', 'az', 'za'], true)) {
    $sort = 'recent';
}
$sorted = $all;
if ($sort === 'oldest') {
    $sorted = array_reverse($all);
} elseif ($sort === 'az' || $sort === 'za') {
    usort($sorted, function ($a, $b) { return strcasecmp($a['title'], $b['title']); });
    if ($sort === 'za') {
        $sorted = array_reverse($sorted);
    }
}
$chips = [['all', 'Everything', $c['projects']], ['featured', 'Featured', $c['featured']], ['program', 'Programming', $c['program']],
    ['engineer', 'Engineering', $c['engineer']], ['art', 'Art', $c['art']], ['new', 'New', $c['new']]];
$labels = array_column($chips, 1, 0);
// ?cat=, ?q= and ?view= are applied here too, so the links from the home page bands and the
// search box work before (or without) site.js; site.js then takes over and keeps the URL in step
$cat = isset($labels[qs('cat')]) ? qs('cat') : 'all';
$q = qs('q', 80);
$view = qs('view') === 'list' ? 'list' : 'grid';
$words = preg_split('/\s+/', lower($q), -1, PREG_SPLIT_NO_EMPTY) ?: [];
$matches = function (array $p) use ($cat, $words) {
    if (($cat === 'featured' && !$p['featured']) || ($cat === 'new' && !$p['isNew']) || (isset(CATS[$cat]) && !in_array($cat, $p['cats'], true))) {
        return false;
    }
    $hay = project_hay($p);
    foreach ($words as $w) {
        if (strpos($hay, $w) === false) {
            return false;
        }
    }
    return true;
};
$big = $cat === 'all' && !$words && $sort === 'recent';
$shown = count(array_filter($sorted, $matches));
$line = $shown . ' of ' . $c['projects'] . ' projects' . ($cat !== 'all' ? ' · ' . $labels[$cat] : '') . ($q !== '' ? ' · “' . $q . '”' : '');

$items = [];
foreach ($all as $i => $p) {
    $items[] = ['@type' => 'ListItem', 'position' => $i + 1, 'url' => url('project.php?id=' . $p['slug']), 'name' => $p['title']];
}
$years = [];
foreach (array_reverse($all) as $p) {
    $years[$p['year']][] = $p;
}

page_head([
    'title' => 'Work — ' . $c['projects'] . ' projects in code, hardware and art | Ryan L. Griffith',
    'description' => 'Every project by Ryan L. Griffith since 2023: PICO-8 and Lua games, ESP32 and KiCad hardware, a CERN detector, Blender renders and pixel art. Filter, sort and search.',
    'path' => 'portfolio.php',
    'page' => 'portfolio',
    'jsonld' => [['@type' => 'CollectionPage', 'name' => 'Work', 'url' => url('portfolio.php'), 'about' => ['@id' => url('#ryan')],
        'mainEntity' => ['@type' => 'ItemList', 'numberOfItems' => count($items), 'itemListElement' => $items]],
        breadcrumbs_ld([['Home', ''], ['Work', 'portfolio.php']])],
]);
?>
  <header class="ihead t-indigo">
    <h1 class="ihead__word"><span class="fit" data-fit data-max="380">Index</span><span class="sr-only"> of projects by Ryan L. Griffith</span></h1>
    <div class="ihead__sub"><p class="mono">Every project since January 2023, coloured by discipline</p><p class="mono">Indigo programming · Chartreuse engineering · Pink art</p></div>
  </header>
  <div class="controls t-grey">
    <div class="pills" id="chips" role="group" aria-label="Filter by discipline">
      <?php foreach ($chips as [$k, $label, $n]): ?><button class="pill-btn" type="button" data-cat="<?= $k ?>" aria-pressed="<?= $k === $cat ? 'true' : 'false' ?>"><?= e($label) ?><sup><?= $n ?></sup></button><?php endforeach; ?>
    </div>
    <form class="tools" id="tools" action="portfolio.php" method="get" role="search">
      <input type="hidden" name="cat" id="cat-input" value="<?= e($cat) ?>">
      <input type="hidden" name="view" id="view-input" value="<?= e($view) ?>">
      <label class="field"><span class="sr-only">Search projects</span><input id="q" name="q" type="search" placeholder="Search projects" autocomplete="off" maxlength="80" value="<?= e($q) ?>"></label>
      <label class="field field--sel"><span class="sr-only">Sort projects</span><select id="sort" name="sort">
        <?php foreach (['recent' => 'Newest first', 'oldest' => 'Oldest first', 'az' => 'A – Z', 'za' => 'Z – A'] as $k => $label): ?><option value="<?= $k ?>"<?= $k === $sort ? ' selected' : '' ?>><?= e($label) ?></option><?php endforeach; ?>
      </select></label>
      <div class="seg" role="group" aria-label="View"><button type="button" data-view="grid" aria-pressed="<?= $view === 'grid' ? 'true' : 'false' ?>">Mosaic</button><button type="button" data-view="list" aria-pressed="<?= $view === 'list' ? 'true' : 'false' ?>">List</button></div>
      <noscript><button class="pill-btn" type="submit">Apply</button></noscript>
    </form>
  </div>
  <p class="result-line mono" id="result" aria-live="polite"><?= e($line) ?></p>
  <div class="results t-grey" id="results" data-view="<?= $view ?>">
    <div class="mosaic" id="mosaic">
      <?php foreach ($sorted as $p) { echo tile($p, $big && $p['featured'], !$matches($p)); } ?>
    </div>
    <div class="empty" id="empty"<?= $shown ? ' hidden' : '' ?>>
      <p id="empty-msg"><?= $q !== '' ? 'Nothing for “' . e($q) . '”.' : 'Nothing in this drawer yet.' ?></p>
      <a class="btn" id="reset" href="portfolio.php">Reset filters <span class="arr" aria-hidden="true">→</span></a>
    </div>
  </div>

  <section class="timeline t-paper" aria-labelledby="tl-title">
    <div class="shead"><h2 class="h2" id="tl-title">Timeline.</h2><p class="mono">One block per project, stacked up year by year · point at one</p></div>
    <ol class="tl" id="timeline" data-drop>
      <?php $d = 0; foreach ($years as $y => $list): ?>
      <li class="tl__year">
        <ol class="tl__stack">
          <?php foreach ($list as $k => $p): $d++; ?>
          <li><a class="tl__blk <?= theme($p) ?><?= $p['featured'] ? ' is-featured' : '' ?>" href="project.php?id=<?= e($p['slug']) ?>" data-slug="<?= e($p['slug']) ?>"
              style="--r:<?= (($p['no'] * 37) % 9) - 4 ?>deg;--d:<?= $d * 26 ?>ms" data-tip="<?= e(rlg_id($p) . ' · ' . $p['title'] . ' · ' . fmt_date($p['iso'], 'mono')) ?>">
              <?= img($p['thumb'], '') ?><span class="sr-only"><?= e($p['title'] . ', ' . fmt_date($p['iso'], 'month')) ?></span></a></li>
          <?php endforeach; ?>
        </ol>
        <h3 class="tl__label"><b><?= e($y) ?></b><span class="mono"><?= count($list) ?> project<?= count($list) === 1 ? '' : 's' ?></span></h3>
      </li>
      <?php endforeach; ?>
    </ol>
  </section>
<?php page_foot();
