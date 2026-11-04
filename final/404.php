<?php
/* Not found: unknown project ids (project.php) and, on Apache, missing pages (.htaccess). */
require_once __DIR__ . '/inc/layout.php';
http_response_code(404);
page_head([
    'title' => 'Not found — Ryan L. Griffith',
    'description' => 'That page is not here. Find Ryan L. Griffith\'s projects, demos and about page instead.',
    'path' => '404.php',
    'page' => 'notfound',
    'noindex' => true,
    'theme' => '#e5197f',
]);
$p = projects()[0];
?>
  <section class="lost t-pink" aria-labelledby="lost-title">
    <p class="mono">Error 404 · nothing logged at this address</p>
    <h1 class="lost__word" id="lost-title"><span class="fit" data-fit data-max="420">Lost.</span><span class="sr-only"> This page was not found.</span></h1>
    <p class="lost__lede">That link points at something that is not here. Try the search, or start from one of these:</p>
    <div class="lost__btns">
      <a class="btn btn--ink" href="portfolio.php">Every project <span class="arr" aria-hidden="true">→</span></a>
      <a class="btn" href="project.php?id=<?= e($p['slug']) ?>">The newest: <?= e($p['title']) ?></a>
      <a class="btn" href="./">Home</a>
    </div>
  </section>
<?php page_foot();
