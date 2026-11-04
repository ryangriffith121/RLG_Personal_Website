<?php
/* XML sitemap, built from the database so new projects appear on their own. robots.txt points here. */
require_once __DIR__ . '/inc/site.php';
header('Content-Type: application/xml; charset=utf-8');
$latest = projects()[0]['iso'];
$pages = [['', 'weekly', '1.0'], ['portfolio.php', 'weekly', '0.9'], ['about.php', 'monthly', '0.7'], ['demos.php', 'monthly', '0.6']];
echo '<?xml version="1.0" encoding="UTF-8"?>', "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<?php foreach ($pages as [$path, $freq, $prio]): ?>
  <url><loc><?= e(url($path)) ?></loc><lastmod><?= $latest ?></lastmod><changefreq><?= $freq ?></changefreq><priority><?= $prio ?></priority></url>
<?php endforeach; foreach (projects() as $p): ?>
  <url><loc><?= e(url('project.php?id=' . $p['slug'])) ?></loc><lastmod><?= e($p['iso']) ?></lastmod><changefreq>yearly</changefreq><priority><?= $p['featured'] ? '0.8' : '0.6' ?></priority><?php
    foreach (array_slice($p['images'], 0, 3) as $im): ?><image:image><image:loc><?= e(url($im['src'])) ?></image:loc></image:image><?php endforeach; ?></url>
<?php endforeach; ?>
</urlset>
