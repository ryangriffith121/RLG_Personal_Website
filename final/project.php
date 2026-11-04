<?php
require_once __DIR__ . '/inc/layout.php';
$p = project(qs('id'));
if (!$p) {
    require __DIR__ . '/404.php';
    exit;
}
$nb = neighbours($p['slug']);
$imgs = $p['images'];
$caps = [];
foreach ($imgs as $i => $im) {
    $caps[] = 'Fig. ' . ($i + 1) . ' — ' . ($im['caption'] ?: $p['title']);
}
$colors = ['program' => '#412db5', 'engineer' => '#e9ff97', 'art' => '#e5197f'];
// search snippets run to about 160 characters: short summaries get the tools added, as many as fit
$desc = $p['summary'];
for ($k = min(4, count($p['stack'])); $k > 0 && strlen($desc) < 120; $k--) {
    $more = $desc . ' Built with ' . implode(', ', array_slice($p['stack'], 0, $k)) . '.';
    if (strlen($more) <= 160) {
        $desc = $more;
    }
}
// "<Project> — <discipline> project by Ryan L. Griffith", or just the name when that runs past ~65 characters
$title = $p['title'] . ' — ' . CATS[$p['cats'][0]] . ' project by Ryan L. Griffith';
if (strlen($title) > 67) {
    $title = $p['title'] . ' — Ryan L. Griffith';
}
$work = ['@type' => 'CreativeWork', '@id' => url('project.php?id=' . $p['slug'] . '#work'), 'name' => $p['title'], 'headline' => $p['title'],
    'description' => $p['summary'], 'url' => url('project.php?id=' . $p['slug']), 'datePublished' => $p['iso'],
    'image' => array_values(array_filter([$p['og'] ? url($p['og']) : null, $imgs ? url($imgs[0]['src']) : null])),
    'author' => ['@id' => url('#ryan')], 'creator' => ['@id' => url('#ryan')], 'isPartOf' => ['@id' => url('#site')],
    'genre' => array_map(function ($k) { return CATS[$k]; }, $p['cats']), 'keywords' => implode(', ', $p['stack']), 'inLanguage' => 'en'];
if ($p['repo']) {
    $work['sameAs'] = $p['repo'];
}
page_head([
    'title' => $title,
    'ogtitle' => $p['title'] . ' · Ryan L. Griffith',
    'description' => $desc,
    'path' => 'project.php?id=' . $p['slug'],
    'image' => $p['og'] ?: 'media/og/site.jpg',
    'imagealt' => $p['title'] . ', a project by Ryan L. Griffith',
    'type' => 'article',
    'page' => 'project',
    'theme' => $colors[$p['cats'][0]],
    'jsonld' => [$work, breadcrumbs_ld([['Home', ''], ['Work', 'portfolio.php'], [$p['title'], 'project.php?id=' . $p['slug']]])],
]);
?>
  <header class="phead <?= theme($p) ?>">
    <div class="phead__crumbs mono"><a href="portfolio.php">← Index</a><span><?= e(rlg_id($p)) ?> · <?= e(fmt_date($p['iso'])) ?></span></div>
    <div class="phead__grid<?= $p['cut'] ? '' : ' phead__grid--solo' ?>">
      <div class="phead__text">
        <h1 class="p-title" id="p-title"><?= e($p['title']) ?></h1>
        <p class="p-sum"><?= e($p['summary']) ?></p>
        <div class="meta">
          <?php foreach ($p['cats'] as $k): ?><span class="tag"><?= e(CATS[$k]) ?></span><?php endforeach; ?>
          <?php if ($p['featured']): ?><span class="tag">Featured</span><?php endif; ?>
          <?php if ($p['status']): ?><span class="tag"><?= e($p['status']) ?></span><?php endif; ?>
        </div>
      </div>
      <?php if ($p['cut'] && $p['cut']['kind'] === 'photo'): ?><div class="phead__photo"><div class="pimg<?= $p['pixel'] ? ' pimg--pixel' : '' ?>"><?= img($p['cut'], '', '', true) ?></div><?= corners() ?></div>
      <?php elseif ($p['cut']): ?><div class="phead__cut"><?= img($p['cut'], '', '', true) ?></div><?php endif; ?>
    </div>
  </header>

  <section class="dossier t-ink" aria-label="Project data">
    <dl class="dossier__grid mono">
      <div><dt>ID</dt><dd><?= e(rlg_id($p)) ?></dd></div>
      <div><dt>Logged</dt><dd><?= e(fmt_date($p['iso'], 'dot')) ?></dd></div>
      <div><dt>Class</dt><dd><?= e(cats_label($p)) ?></dd></div>
      <div class="span2"><dt>Stack</dt><dd><?= e(implode(' · ', $p['stack']) ?: '—') ?></dd></div>
      <div><dt>Media</dt><dd><?= count($imgs) ?> image<?= count($imgs) === 1 ? '' : 's' ?></dd></div>
      <div><dt>Status</dt><dd><?= e($p['status'] ?: 'Complete') ?></dd></div>
      <?php if ($p['demo']): ?><div><dt>Demo</dt><dd><a href="demos.php#<?= e($p['demo']) ?>">Play in the browser →</a></dd></div><?php endif; ?>
      <?php if ($p['repo']): ?><div><dt>Source</dt><dd><a href="<?= e($p['repo']) ?>" target="_blank" rel="noopener">GitHub ↗</a></dd></div><?php endif; ?>
    </dl>
  </section>

  <?php if ($imgs): ?>
  <section class="gallery t-grey" aria-label="Images">
    <div class="stage" id="stage"><?= img($imgs[0], $p['title'] . ' — image 1 of ' . count($imgs), $p['pixel'] ? 'pixel' : '', true) ?>
      <button class="zoom" type="button" aria-label="Open image 1 full screen"></button><?= corners() ?></div>
    <div class="stage__bar">
      <span class="counter" id="counter" aria-hidden="true">01/<?= sprintf('%02d', count($imgs)) ?></span>
      <p class="mono" id="cap" aria-live="polite"><?= e($caps[0]) ?></p>
      <div class="arrows"<?= count($imgs) < 2 ? ' hidden' : '' ?>><button type="button" id="prev" aria-label="Previous image">←</button><button type="button" id="next" aria-label="Next image">→</button></div>
    </div>
    <?php if (count($imgs) > 1): ?>
    <div class="thumbs" id="thumbs">
      <?php foreach ($imgs as $i => $im): ?><button type="button" aria-label="Show image <?= $i + 1 ?>" aria-current="<?= $i === 0 ? 'true' : 'false' ?>"><?= img($im, '', $p['pixel'] ? 'pixel' : '') ?></button><?php endforeach; ?>
    </div>
    <?php endif; ?>
    <script type="application/json" id="gallery-data"><?= json_encode(['title' => $p['title'], 'pixel' => $p['pixel'], 'images' => array_map(function ($im, $cap) {
        return ['src' => $im['src'], 'w' => $im['w'], 'h' => $im['h'], 'cap' => $cap]; }, $imgs, $caps)], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
  </section>
  <?php endif; ?>

  <section class="story t-grey" aria-label="About this project">
    <?php
    $blocks = [['The project', '<div class="prose"><p>' . ($p['description'] ?: e($p['summary'])) . '</p></div>' . ($p['note'] ? '<p class="note mono">' . e($p['note']) . '</p>' : ''), 't-paper']];
    if ($p['learned']) {
        $blocks[] = ['What I learned', '<div class="prose"><p>' . $p['learned'] . '</p></div>', theme($p)];
    }
    if ($p['takeaway']) {
        $blocks[] = ['Takeaway', '<div class="prose"><p>' . $p['takeaway'] . '</p></div>', 't-deep'];
    }
    if ($p['highlights']) {
        $hl = '<ul class="hl">';
        foreach ($p['highlights'] as $i => $h) {
            $hl .= '<li><span>' . ($i + 1) . '</span>' . e($h) . '</li>';
        }
        $blocks[] = ['Highlights', $hl . '</ul>', $p['learned'] ? 't-ink' : theme($p)];
    }
    $acts = '';
    if ($p['demo']) {
        $acts .= '<a class="btn btn--solid" href="demos.php#' . e($p['demo']) . '">Play it <span class="arr" aria-hidden="true">→</span></a>';
    }
    if ($p['repo']) {
        $acts .= '<a class="btn" href="' . e($p['repo']) . '" target="_blank" rel="noopener">GitHub ↗</a>';
    }
    if ($acts) {
        $blocks[0][1] .= '<div class="acts">' . $acts . '</div>';
    }
    foreach ($blocks as $i => [$h, $body, $t]): ?>
    <div class="<?= $t ?><?= count($blocks) === 2 && $i === 0 ? ' span-2' : '' ?>" data-reveal><?= corners() ?><h2><?= e($h) ?></h2><?= $body ?></div>
    <?php endforeach; ?>
  </section>

  <nav class="pn" aria-label="More projects">
    <?php foreach ([[$nb['older'], '← Older'], [$nb['newer'], 'Newer →']] as [$o, $label]): ?>
    <a class="<?= theme($o) ?>" href="project.php?id=<?= e($o['slug']) ?>"><span class="mono"><?= e($label) ?> · <?= e(rlg_id($o)) ?></span><h3><?= e($o['title']) ?></h3></a>
    <?php endforeach; ?>
  </nav>
<?php page_foot();
