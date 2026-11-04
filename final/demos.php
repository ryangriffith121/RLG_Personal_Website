<?php
require_once __DIR__ . '/inc/layout.php';
$demos = demos();
$games = [];
foreach ($demos as $i => $d) {
    $games[] = ['@type' => 'ListItem', 'position' => $i + 1, 'item' => ['@type' => 'VideoGame', 'name' => $d['title'],
        'url' => url('project.php?id=' . $d['slug']), 'gamePlatform' => 'Web browser', 'applicationCategory' => 'Game',
        'description' => $d['blurb'], 'author' => ['@id' => url('#ryan')]]];
}
page_head([
    'title' => 'Play Ryan L. Griffith\'s PICO-8 games in the browser — Arcade',
    'description' => 'Five PICO-8 games by Ryan L. Griffith you can play right in the browser: ' . implode(', ', array_column($demos, 'title')) . '.',
    'path' => 'demos.php',
    'page' => 'demos',
    'theme' => '#e5197f',
    'jsonld' => [['@type' => 'CollectionPage', 'name' => 'Arcade', 'url' => url('demos.php'), 'mainEntity' => ['@type' => 'ItemList', 'itemListElement' => $games]],
        breadcrumbs_ld([['Home', ''], ['Demos', 'demos.php']])],
]);
$first = $demos[0];
?>
  <header class="ihead t-pink">
    <h1 class="ihead__word"><span class="fit" data-fit data-max="380">Arcade</span><span class="sr-only">: play Ryan L. Griffith's PICO-8 games</span></h1>
    <div class="ihead__sub"><p class="mono"><?= count($demos) ?> PICO-8 cartridges, playable in the browser</p><p class="mono">Arrows to move · Z and X to act</p></div>
  </header>
  <div class="t-grey arcade-wrap">
    <div class="arcade">
      <ul class="carts" id="carts" aria-label="Cartridges">
        <?php foreach ($demos as $i => $d): $p = project($d['slug']); ?>
        <li><button class="cart <?= ['t-lime', 't-pink', 't-indigo', 't-paper', 't-deep'][$i % 5] ?>" type="button" data-slug="<?= e($d['slug']) ?>" aria-current="<?= $i === 0 ? 'true' : 'false' ?>">
          <img src="<?= e($d['poster']) ?>" alt="" width="72" height="72" loading="lazy">
          <span><span class="mono">Cart <?= sprintf('%02d', $i + 1) ?> · <?= e(fmt_date($d['iso'], 'year')) ?></span><strong><?= e($d['title']) ?></strong>
            <span class="mono cart__meta"><?= e($p ? implode(' · ', array_slice($p['stack'], 0, 2)) : 'PICO-8') ?></span></span></button></li>
        <?php endforeach; ?>
      </ul>
      <section aria-label="Player">
        <div class="bezel"><?= corners('lime') ?>
          <div class="bezel__bar"><span class="mono" id="bz-title"><?= e($first['title']) ?> · PICO-8</span>
            <div class="bezel__btns"><button type="button" id="bz-full">Fullscreen</button><a id="bz-open" href="<?= e($first['path']) ?>" target="_blank" rel="noopener">New tab ↗</a></div></div>
          <div class="screen" id="screen"><button class="screen__poster" type="button" aria-label="Play <?= e($first['title']) ?>"><img src="<?= e($first['poster']) ?>" alt=""><span class="btn">Press start ▶</span></button></div>
        </div>
        <div class="arcade__info"><p id="arcade-blurb"><?= e($first['blurb']) ?></p><a class="btn" id="arcade-link" href="project.php?id=<?= e($first['slug']) ?>">Project page <span class="arr" aria-hidden="true">→</span></a></div>
      </section>
    </div>
  </div>
  <script type="application/json" id="demos-data"><?= json_encode(array_map(function ($d) {
      return ['slug' => $d['slug'], 'title' => $d['title'], 'src' => $d['path'], 'poster' => $d['poster'], 'blurb' => $d['blurb']]; }, $demos), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
<?php page_foot();
