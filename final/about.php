<?php
require_once __DIR__ . '/inc/layout.php';
$pr = profile();
$c = counts();
// how many projects each tool shows up in (matched against every project's stack)
$uses = function (array $words) {
    $n = 0;
    foreach (projects() as $p) {
        $hay = strtolower(implode(' ', $p['stack']));
        foreach ($words as $w) {
            if (strpos($hay, strtolower($w)) !== false) {
                $n++;
                break;
            }
        }
    }
    return $n;
};
$tools = [
    ['Code', 't-indigo', [['Python', 'Pygame · ML', ['python', 'pygame']], ['C++', 'SFML · OpenCV', ['c++']], ['Lua', 'PICO-8 · SUGAR · Playdate', ['lua', 'pico-8', 'sugar']],
        ['JavaScript', 'Web APIs', ['javascript']], ['PHP + SQL', 'SQLite', ['php', 'sql']]]],
    ['Hardware', 't-lime', [['KiCad', 'PCBs', ['kicad']], ['ESP32 · Teensy', 'I²C · SPI', ['esp32', 'teensy']], ['SiPMs', 'Detectors', ['sipm']],
        ['CNC · 3D print', 'G-code', ['cnc', '3d printing', 'g-code']]]],
    ['Design', 't-pink', [['SolidWorks', 'CSWA', ['solidworks']], ['Blender', 'Modelling', ['blender']], ['Photoshop', 'Certified', ['photoshop']],
        ['Illustrator', 'Vector', ['illustrator']], ['Pixel art', 'Aseprite', ['pixel']]]],
];
page_head([
    'title' => 'About Ryan L. Griffith — CS at CU Boulder, CERN BL4S 2026 winner',
    'description' => 'Ryan L. Griffith is a programmer, engineer and artist studying computer science at CU Boulder, and part of Team Centauri Stars, a CERN Beamline for Schools 2026 winner.',
    'path' => 'about.php',
    'page' => 'about',
    'type' => 'profile',
    'image' => 'media/og/site.jpg',
    'theme' => '#e9ff97',
    'jsonld' => [person_ld(), ['@type' => 'ProfilePage', 'url' => url('about.php'), 'name' => 'About Ryan L. Griffith', 'mainEntity' => ['@id' => url('#ryan')]],
        breadcrumbs_ld([['Home', ''], ['About', 'about.php']])],
]);
?>
  <section class="ahead t-lime" aria-labelledby="hello">
    <div>
      <p class="mono">About · Ryan L. Griffith · Boulder, Colorado</p>
      <h1 class="ahead__hello" id="hello"><span class="fit" data-fit data-max="420">Hello.</span><span class="sr-only"> I'm Ryan L. Griffith.</span></h1>
      <p class="ahead__lede">Computer science at CU Boulder. Part of Team Centauri Stars, one of five winners of CERN's Beamline for Schools 2026.</p>
    </div>
    <div class="portrait"><img src="<?= e($pr['portraitDuo']) ?>" alt="Ryan L. Griffith sitting on a rock above Boulder, Colorado" width="1000" height="1000" fetchpriority="high">
      <img class="color" src="<?= e($pr['portrait']) ?>" alt="" width="1000" height="1000" loading="lazy"><?= corners() ?></div>
  </section>

  <section class="t-grey" aria-labelledby="tool-title">
    <div class="shead"><h2 class="h2" id="tool-title">Toolbox.</h2><p class="mono">The numbers count projects on this site that use each tool</p></div>
    <div class="tools3">
      <?php foreach ($tools as [$h, $t, $rows]): ?>
      <div class="<?= $t ?>" data-reveal><?= corners() ?><h3><?= e($h) ?></h3><ul>
        <?php foreach ($rows as [$name, $note, $words]): $n = $uses($words); ?>
        <li><span><?= e($name) ?></span><span><?= e($note) ?><?= $n ? ' · <b>' . $n . '</b>' : '' ?></span></li>
        <?php endforeach; ?></ul></div>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="bio t-grey" aria-label="Biography">
    <p class="bio__lede"><?= e($pr['about'][0]) ?></p>
    <div class="prose"><?php foreach (array_slice($pr['about'], 1) as $t): ?><p><?= e($t) ?></p><?php endforeach; ?></div>
  </section>

  <section class="t-grey" aria-labelledby="cred-title">
    <div class="shead"><h2 class="h2" id="cred-title">Certified.</h2><p class="mono">Earned 2022–2025 · click to enlarge</p></div>
    <div class="stickers" id="certs">
      <?php foreach (certs() as $i => $ct): ?>
      <div class="sticker <?= ['t-indigo', 't-lime', 't-pink', 't-deep'][$i % 4] ?>" style="--r:<?= ['-2deg', '1.5deg', '-1deg', '2deg'][$i % 4] ?>">
        <div class="mono sticker__top"><span><?= sprintf('%02d', $i + 1) ?></span><span><?= e(fmt_date($ct['iso'], 'short')) ?></span></div>
        <button type="button" data-cert="<?= $i ?>" data-src="<?= e($ct['image']) ?>" data-cap="<?= e($ct['title'] . ' — ' . $ct['issuer'] . ', ' . fmt_date($ct['iso'])) ?>" aria-label="View the <?= e($ct['title']) ?> certificate"><?= img(['src' => $ct['image'], 'w' => $ct['width'], 'h' => $ct['height']], '') ?></button>
        <h3><?= e($ct['short']) ?></h3><p class="mono"><?= e($ct['issuer']) ?></p>
      </div>
      <?php endforeach; ?>
    </div>
  </section>
<?php page_foot();
