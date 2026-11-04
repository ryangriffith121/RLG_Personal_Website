<?php
require_once __DIR__ . '/inc/layout.php';
$c = counts();
$all = projects();
$picks = array_values(array_filter(array_map('project', ['bl4s-2026', 'hollowdeep', 'deepwell', 'custom-calc', 'skull-2026', 'raycast-fps'])));
$latest = array_slice($all, 0, 9);          // one big tile + eight: fills the 4- and 2-column grids exactly
// the koi pond sizes each fish by its number of images; the legend shows the range
$imgCounts = array_map(function ($p) { return max(1, count($p['images'])); }, $all) ?: [1];
$koi = '<svg viewBox="0 0 48 20" aria-hidden="true" focusable="false"><path d="M46 10C46 6.2 41.5 5 36 5 28 5 20.5 8 14 8.9v2.2c6.5.9 14 3.9 22 3.9 5.5 0 10-1.2 10-5ZM17 10C13 8.5 8 4 2 3.2 4.6 6.4 6 8.4 7.2 10 6 11.6 4.6 13.6 2 16.8 8 16 13 11.5 17 10Z"/></svg>';
$deckThemes = ['t-indigo', 't-lime', 't-pink', 't-ink', 't-paper', 't-deep'];
// great-circle distance from Boulder, worked out the same way globe.js does for its labels
$km = function (float $lat, float $lon): string {
    $r = M_PI / 180;
    $a = 40.015 * $r;
    $b = $lat * $r;
    $d = acos(min(1, sin($a) * sin($b) + cos($a) * cos($b) * cos(($lon + 105.27) * $r)));
    return number_format(round($d * 6371)) . ' km';
};

page_head([
    'title' => 'Ryan L. Griffith — Programmer, Engineer & Artist in Boulder, CO',
    'description' => 'Games, circuit boards and art by Ryan L. Griffith, a CS student at CU Boulder and CERN Beamline for Schools 2026 winner. ' . $c['projects'] . ' projects since 2023.',
    'path' => '',
    'page' => 'home',
    'jsonld' => [person_ld(), ['@type' => 'ProfilePage', '@id' => url('#profile'), 'url' => url(), 'name' => SITE_NAME, 'mainEntity' => ['@id' => url('#ryan')]]],
]);
?>
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__top t-grey">
      <h1 class="mono" id="hero-title">Ryan L. Griffith — programmer, engineer and artist</h1>
      <p class="mono">Boulder, Colorado · <?= $c['projects'] ?> projects since 2023</p>
    </div>
    <?php foreach ([['program', 't-indigo', '01', 'Programmer'], ['engineer', 't-lime', '02', 'Engineer'], ['art', 't-pink', '03', 'Artist']] as [$k, $t, $n, $word]): ?>
    <a class="band <?= $t ?>" href="portfolio.php?cat=<?= $k ?>" aria-label="<?= e($word) ?>: see the <?= e(strtolower(CATS[$k])) ?> projects">
      <span class="band__meta mono"><span><?= $n ?> / <?= e(CATS[$k]) ?></span><span><?= $c[$k] ?> projects <span class="arr" aria-hidden="true">→</span></span></span>
      <span class="fit band__word" data-fit data-fit-h="0.74" aria-hidden="true"><?= e($word) ?></span>
    </a>
    <?php endforeach; ?>
  </section>

  <section class="intro t-grey" aria-label="Introduction">
    <p class="intro__line" data-reveal>I'm Ryan: a <em class="e-prg">programmer</em>, <em class="e-eng">engineer</em> and <em class="e-art">artist</em> who builds games, circuit boards and art in Boulder, Colorado.</p>
    <div class="intro__side" data-reveal>
      <dl class="stats mono">
        <div><dt>Studying</dt><dd>Computer science, CU Boulder</dd></div>
        <div><dt>Latest</dt><dd><a href="project.php?id=<?= e($all[0]['slug']) ?>"><?= e($all[0]['title']) ?></a> · <?= e(fmt_date($all[0]['iso'], 'mono')) ?></dd></div>
        <div><dt>Won</dt><dd><a href="project.php?id=bl4s-2026">CERN Beamline for Schools 2026</a></dd></div>
      </dl>
      <div class="intro__btns"><a class="btn btn--ink" href="portfolio.php">See all the work <span class="arr" aria-hidden="true">→</span></a><a class="btn" href="about.php">About me</a></div>
    </div>
  </section>

  <div class="marquee t-lime" aria-hidden="true"><div class="marquee__run">
    <?php for ($k = 0; $k < 2; $k++): ?><span>Programmer</span><span>✶</span><span>Engineer</span><span>✶</span><span>Artist</span><span>✶</span><span>CERN BL4S 2026</span><span>✶</span><span>CS @ CU Boulder</span><span>✶</span><?php endfor; ?>
  </div></div>

  <section class="deck t-grey" aria-labelledby="deck-title">
    <div class="deck__head"><h2 class="h2" id="deck-title">Featured.</h2><p class="mono">Six builds, stacked · scroll</p></div>
    <div class="deck__stack" data-stack>
      <?php foreach ($picks as $i => $p): ?>
      <article class="slide <?= $deckThemes[$i % 6] ?>" style="--i:<?= $i ?>" data-slug="<?= e($p['slug']) ?>">
        <div class="slide__text">
          <div class="slide__no mono"><span><?= sprintf('%02d / %02d', $i + 1, count($picks)) ?></span><span><?= e(rlg_id($p)) ?></span></div>
          <h3><?= e($p['title']) ?></h3>
          <p><?= e($p['summary']) ?></p>
          <?= stats($p, true) ?>
          <a class="btn btn--solid" href="project.php?id=<?= e($p['slug']) ?>">Open project <span class="arr" aria-hidden="true">→</span></a>
        </div>
        <div class="slide__img"><?= panel_img($p) ?><?= corners() ?></div>
      </article>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="globe t-deep" aria-labelledby="globe-title">
    <div class="globe__text">
      <p class="mono soft">Field notes</p>
      <h2 class="h2" id="globe-title">Boulder to the beamline.</h2>
      <p class="globe__lede">A CERN competition, a particle beam in Hamburg and two JPL challenges in California. The routes behind some of the biggest builds.</p>
      <ol class="routes">
        <li class="r-desy" data-route="desy"><span class="mono">DESY · Hamburg · <?= $km(53.575, 9.88) ?></span><strong>Two weeks of beam time for the SiPM detector, 2026</strong><a href="project.php?id=bl4s-2026">Beamline for Schools <span class="arr" aria-hidden="true">→</span></a></li>
        <li class="r-cern" data-route="cern"><span class="mono">CERN · Geneva · <?= $km(46.234, 6.055) ?></span><strong>Beamline for Schools 2026: one of five winning teams</strong><a href="project.php?id=bl4s-2026">The detector <span class="arr" aria-hidden="true">→</span></a></li>
        <li class="r-jpl" data-route="jpl"><span class="mono">JPL · Pasadena · <?= $km(34.2013, -118.1714) ?></span><strong>JPL Invention Challenge, 2024 and 2025</strong><a href="project.php?id=jpl-2025">The 2025 build <span class="arr" aria-hidden="true">→</span></a></li>
      </ol>
    </div>
    <div class="globe__stage" data-globe></div>
  </section>

  <section class="nums" aria-label="By the numbers">
    <div class="num t-indigo"><b data-count="<?= $c['projects'] ?>"><?= $c['projects'] ?></b><p>projects since January 2023: games, circuit boards, CAD and art.</p></div>
    <div class="num t-pink"><b>1 of 5</b><p>winning teams worldwide in CERN's Beamline for Schools 2026, from 712 proposals.</p></div>
    <div class="num t-lime"><b data-count="16">16</b><p>SiPM channels on the detector board Ryan designed in KiCad.</p></div>
    <div class="num t-deep"><b data-count="<?= $c['demos'] ?>"><?= $c['demos'] ?></b><p>PICO-8 games you can play in the browser, right here.</p></div>
    <div class="num t-paper"><b data-count="<?= $c['certs'] ?>"><?= $c['certs'] ?></b><p>certifications: Python, Photoshop, SolidWorks and Inventor.</p></div>
    <div class="num t-ink"><b>3</b><p>disciplines in one portfolio, and most projects use two of them.</p></div>
  </section>

  <section class="t-grey" aria-labelledby="latest-title">
    <div class="shead"><h2 class="h2" id="latest-title">Latest.</h2><a class="btn" href="portfolio.php">Full index <span class="arr" aria-hidden="true">→</span></a></div>
    <div class="wrap pad-b"><div class="mosaic">
      <?php foreach ($latest as $i => $p) { echo tile($p, $i === 0); } ?>
    </div></div>
  </section>

  <section class="pond t-ink" aria-labelledby="pond-title">
    <div class="pond__head">
      <h2 class="h2" id="pond-title">The pond.</h2>
      <p>One koi for every project. Its colour is the discipline, its size is how much went into the build, and the gold ones are featured. Point at a fish to see which project it is; click to open it.</p>
    </div>
    <div class="pond__water" data-pond>
      <p class="pond__tip mono is-idle" id="pond-tip" aria-hidden="true"></p>
    </div>
    <ul class="pond__legend mono" aria-label="Legend">
      <li><i class="dot dot--program"></i>Programming</li><li><i class="dot dot--engineer"></i>Engineering</li><li><i class="dot dot--art"></i>Art</li><li><i class="dot dot--gold"></i>Featured</li>
      <li class="pond__size"><span class="pond__koi"><?= $koi . $koi ?></span>Size: <?= min($imgCounts) ?> to <?= max($imgCounts) ?> images</li>
    </ul>
  </section>
<?php page_foot(['scripts' => ['assets/data/globe-dots.js', 'assets/js/globe.js', 'assets/js/pond.js']]);
