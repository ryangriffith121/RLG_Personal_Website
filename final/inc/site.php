<?php
/* RyanLGriffith.com: settings, the database and the helpers every page uses.
   Works on PHP 7.4+ with the pdo_sqlite extension. Content lives in data/portfolio.db:
   PortfolioTabs and PortfolioPage (the same tables as the old site, now with every entry) plus
   ProjectMeta, ProjectImages, Demos and Certifications for the extra detail. A project that only
   has the two original rows still shows up, with sensible defaults for the rest. */

const SITE_URL = 'https://ryanlgriffith.com/';
const SITE_NAME = 'Ryan L. Griffith';
const SITE_TAGLINE = 'Programmer, engineer and artist in Boulder, Colorado';
const SITE_DESC = 'Ryan L. Griffith builds games, circuit boards and art: a CERN Beamline for Schools 2026 winner studying computer science at CU Boulder.';

/* The closing line above the contact links on every page. Other options that were considered:
   'Come build something with me.' · 'Got something to build?' · 'Say hello.' · 'The workbench is open.' ·
   'Questions, ideas, side quests: send them over.' */
const CTA_LINE = 'Build something with me.';

const CATS = ['program' => 'Programming', 'engineer' => 'Engineering', 'art' => 'Art'];
const CAT_SHORT = ['program' => 'PRG', 'engineer' => 'ENG', 'art' => 'ART'];
const THEMES = ['program' => 't-indigo', 'engineer' => 't-lime', 'art' => 't-pink'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function e($s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        // RLG_DB lets the tests point a server at a scratch copy; the site itself never sets it
        $pdo = new PDO('sqlite:' . (getenv('RLG_DB') ?: __DIR__ . '/../data/portfolio.db'));
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    }
    return $pdo;
}

function has_table(string $name): bool
{
    static $tables = null;
    if ($tables === null) {
        $tables = db()->query("SELECT name FROM sqlite_master WHERE type = 'table'")->fetchAll(PDO::FETCH_COLUMN);
    }
    return in_array($name, $tables, true);
}

/* a query-string value as a plain string ('' when missing, or when someone sends ?x[]=…) */
function qs(string $key, int $max = 120): string
{
    $v = $_GET[$key] ?? '';
    return is_string($v) ? substr(trim($v), 0, $max) : '';
}

function lower(string $s): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
}

function json_list($value): array
{
    $v = is_string($value) && $value !== '' ? json_decode($value, true) : null;
    return is_array($v) ? $v : [];
}

/* every project, newest first; numbered RLG-001 (oldest) upwards */
function projects(): array
{
    static $list = null;
    if ($list !== null) {
        return $list;
    }
    $meta = has_table('ProjectMeta');
    $sql = 'SELECT t.id, t.slug, t.title, t.date AS tab_date, t.unixdate, t.description AS tab_desc, t.thumbnail, t.categories,
                   p.description, p.whatilearned, p.takeaway, p.images'
        . ($meta ? ', m.iso, m.featured, m.is_new, m.summary, m.stack, m.highlights, m.status, m.repo, m.demo, m.note,
                     m.thumb, m.thumb_w, m.thumb_h, m.tone, m.alpha, m.pixel, m.cutout, m.cutout_w, m.cutout_h, m.cutout_kind, m.og' : '')
        . ' FROM PortfolioTabs t LEFT JOIN PortfolioPage p ON p.slug = t.slug'
        . ($meta ? ' LEFT JOIN ProjectMeta m ON m.slug = t.slug' : '')
        . ' ORDER BY t.unixdate DESC, t.title';
    $images = [];
    if (has_table('ProjectImages')) {
        foreach (db()->query('SELECT * FROM ProjectImages ORDER BY slug, position') as $im) {
            $images[$im['slug']][] = ['src' => $im['path'], 'w' => (int) $im['width'], 'h' => (int) $im['height'],
                'anim' => (bool) $im['animated'], 'caption' => $im['caption']];
        }
    }
    $list = [];
    foreach (db()->query($sql) as $r) {
        $cats = array_values(array_filter(array_map('trim', explode(',', (string) $r['categories']))));
        $featured = !empty($r['featured']) || in_array('featured', $cats, true);
        $cats = array_values(array_filter($cats, function ($c) { return isset(CATS[$c]); }));
        if (!$cats) {
            $cats = ['program'];
        }
        $iso = !empty($r['iso']) ? $r['iso'] : gmdate('Y-m-d', (int) $r['unixdate'] - 7 * 3600);
        $imgs = $images[$r['slug']] ?? [];
        if (!$imgs && !empty($r['images'])) {          // an entry added with only the original two tables
            foreach (explode(',', $r['images']) as $src) {
                $src = trim(str_replace('\\', '/', $src));
                if ($src !== '') {
                    $imgs[] = ['src' => $src, 'w' => 0, 'h' => 0, 'anim' => false, 'caption' => null];
                }
            }
        }
        $thumb = !empty($r['thumb']) ? $r['thumb'] : str_replace('\\', '/', (string) $r['thumbnail']);
        $list[] = [
            'id' => (int) $r['id'],
            'slug' => $r['slug'],
            'title' => (string) $r['title'],
            'iso' => $iso,
            'year' => substr($iso, 0, 4),
            'cats' => $cats,
            'featured' => $featured,
            'isNew' => !empty($r['is_new']),
            'summary' => (string) ($r['summary'] ?? $r['tab_desc'] ?? ''),
            'description' => (string) ($r['description'] ?? ''),
            'learned' => (string) ($r['whatilearned'] ?? ''),
            'takeaway' => (string) ($r['takeaway'] ?? ''),
            'stack' => json_list($r['stack'] ?? null),
            'highlights' => json_list($r['highlights'] ?? null),
            'status' => $r['status'] ?? null,
            'repo' => $r['repo'] ?? null,
            'demo' => $r['demo'] ?? null,
            'note' => $r['note'] ?? null,
            'thumb' => ['src' => $thumb, 'w' => (int) ($r['thumb_w'] ?? 0), 'h' => (int) ($r['thumb_h'] ?? 0),
                'tone' => $r['tone'] ?? '#2d2178', 'alpha' => !empty($r['alpha'])],
            'cut' => !empty($r['cutout']) ? ['src' => $r['cutout'], 'w' => (int) $r['cutout_w'], 'h' => (int) $r['cutout_h'], 'kind' => $r['cutout_kind']] : null,
            'pixel' => !empty($r['pixel']),
            'og' => $r['og'] ?? null,
            'images' => $imgs,
        ];
    }
    // newest first, ties by title: the same order site.js uses when it re-sorts the work index
    usort($list, function ($a, $b) { return strcmp($b['iso'], $a['iso']) ?: strcasecmp($a['title'], $b['title']); });
    $asc = $list;
    usort($asc, function ($a, $b) { return [$a['iso'], $a['title']] <=> [$b['iso'], $b['title']]; });
    $no = [];
    foreach ($asc as $i => $p) {
        $no[$p['slug']] = $i + 1;
    }
    foreach ($list as &$p) {
        $p['no'] = $no[$p['slug']];
    }
    unset($p);
    return $list;
}

function project(?string $slug): ?array
{
    foreach (projects() as $p) {
        if ($p['slug'] === $slug) {
            return $p;
        }
    }
    return null;
}

/* older / newer neighbours by date, wrapping around */
function neighbours(string $slug): array
{
    $list = projects();
    $n = count($list);
    foreach ($list as $i => $p) {
        if ($p['slug'] === $slug) {
            return ['newer' => $list[($i - 1 + $n) % $n], 'older' => $list[($i + 1) % $n]];
        }
    }
    return ['newer' => $list[0], 'older' => $list[$n - 1]];
}

function demos(): array
{
    static $d = null;
    if ($d === null) {
        $d = has_table('Demos') ? db()->query('SELECT * FROM Demos ORDER BY position')->fetchAll() : [];
    }
    return $d;
}

function certs(): array
{
    static $c = null;
    if ($c === null) {
        $c = has_table('Certifications') ? db()->query('SELECT * FROM Certifications ORDER BY position')->fetchAll() : [];
    }
    return $c;
}

function counts(): array
{
    $c = ['program' => 0, 'engineer' => 0, 'art' => 0, 'featured' => 0, 'new' => 0];
    $years = [];
    foreach (projects() as $p) {
        foreach ($p['cats'] as $k) {
            $c[$k]++;
        }
        $c['featured'] += $p['featured'] ? 1 : 0;
        $c['new'] += $p['isNew'] ? 1 : 0;
        $years[$p['year']] = ($years[$p['year']] ?? 0) + 1;
    }
    ksort($years);
    return $c + ['projects' => count(projects()), 'demos' => count(demos()), 'certs' => count(certs()), 'years' => $years];
}

function rlg_id(array $p): string
{
    return 'RLG-' . str_pad((string) $p['no'], 3, '0', STR_PAD_LEFT);
}

/* long "October 11, 2026" | short "Oct 2026" | month "October 2026" | mono "OCT 2026" | dot "2026.10.11" | year */
function fmt_date(string $iso, string $style = 'long'): string
{
    [$y, $m, $d] = array_map('intval', explode('-', $iso));
    $name = MONTHS[$m - 1];
    switch ($style) {
        case 'short': return substr($name, 0, 3) . ' ' . $y;
        case 'month': return $name . ' ' . $y;
        case 'mono': return strtoupper(substr($name, 0, 3)) . ' ' . $y;
        case 'dot': return sprintf('%04d.%02d.%02d', $y, $m, $d);
        case 'year': return (string) $y;
        default: return $name . ' ' . $d . ', ' . $y;
    }
}

/* the words a project can be found by, on the work index and in its filters */
function project_hay(array $p): string
{
    return lower(implode(' ', [$p['title'], $p['summary'], implode(' ', $p['stack']), cats_label($p), cats_label($p, true),
        fmt_date($p['iso'], 'month'), rlg_id($p), $p['featured'] ? 'featured' : '']));
}

function cats_label(array $p, bool $short = false): string
{
    return implode(' · ', array_map(function ($c) use ($short) { return $short ? CAT_SHORT[$c] : CATS[$c]; }, $p['cats']));
}

function theme(array $p): string
{
    return THEMES[$p['cats'][0]] ?? 't-ink';
}

function url(string $path = ''): string
{
    return SITE_URL . ltrim($path, '/');
}

/* local asset with a cache-busting version */
function asset(string $path): string
{
    $file = __DIR__ . '/../' . $path;
    return e($path) . (is_file($file) ? '?v=' . filemtime($file) : '');
}

function img(array $im, string $alt, string $class = '', bool $eager = false): string
{
    $size = !empty($im['w']) ? ' width="' . (int) $im['w'] . '" height="' . (int) $im['h'] . '"' : '';
    return '<img' . ($class ? ' class="' . e($class) . '"' : '') . ' src="' . e($im['src']) . '" alt="' . e($alt) . '"' . $size
        . ($eager ? ' fetchpriority="high"' : ' loading="lazy"') . ' decoding="async">';
}

/* an inline SVG from assets/img, so the logos never wait on a request */
function svg(string $name, string $class = '', string $label = ''): string
{
    $svg = (string) @file_get_contents(__DIR__ . '/../assets/img/' . $name . '.svg');
    $attrs = ' class="' . e($class) . '"' . ($label ? ' role="img" aria-label="' . e($label) . '"' : ' aria-hidden="true" focusable="false"');
    return preg_replace('/^<svg /', '<svg' . $attrs . ' ', $svg, 1);
}

function profile(): array
{
    return [
        'name' => 'Ryan L. Griffith',
        'roles' => ['Programmer', 'Engineer', 'Artist'],
        'school' => 'Computer Science, CU Boulder',
        'location' => 'Boulder, Colorado',
        'email' => '',                              // left empty on purpose; add one to show it in the footer
        'links' => [
            ['label' => 'GitHub', 'href' => 'https://github.com/ryangriffith121'],
            ['label' => 'LinkedIn', 'href' => 'https://www.linkedin.com/in/ryan-griffith-aa3517347/'],
        ],
        'about' => [
            'Ryan is a driven, intellectually curious person who approaches the world with a maker\'s instinct and a scientist\'s need to understand not just what is true, but why and how we know. He is the kind of person who encounters a problem, whether technical, ethical, or creative, and responds by building something. That impulse isn\'t purely academic; it\'s rooted in a genuine desire to make things better, more trustworthy, and more accessible to others.',
            'Technically, Ryan is fluent across an unusually wide range of disciplines. He is comfortable in software and hardware alike, moving between programming, circuit design, mechanical fabrication, CAD modeling, machine learning, and digital art with confidence and curiosity. He doesn\'t specialize narrowly. He connects domains, bringing an engineer\'s rigor to creative work and a designer\'s eye to technical problems. The result is a body of work that is as varied as it is accomplished.',
            'What motivates Ryan runs deeper than personal achievement. He is drawn to questions with real-world stakes, problems at the intersection of technology and society where thoughtful solutions can have meaningful impact. He is also motivated by the people around him. He invests in communities, supports peers, and consistently prioritizes the success of the group alongside his own. Leadership, for Ryan, is less about standing out and more about making sure others have the space and support to contribute.',
            'In terms of character, those who work alongside Ryan consistently describe the same qualities: patience, calm, reliability, and kindness. He is the person a team turns to when things get difficult, not because he has all the answers, but because he stays steady, listens carefully, and works through problems methodically rather than reactively. He is self-motivated and disciplined, but never at the expense of the people around him.',
            'Ryan\'s combination of technical depth, creative range, ethical awareness, and genuine collaborative spirit makes him someone who will contribute meaningfully to any environment he enters and who will make that environment better for everyone in it.',
        ],
        'portrait' => 'media/about/portrait.webp',
        'portraitDuo' => 'media/about/portrait_duotone.webp',
    ];
}

/* the projects as compact JSON for the search palette, the feed and the koi pond */
function search_index(): array
{
    return array_map(function ($p) {
        return ['s' => $p['slug'], 't' => $p['title'], 'n' => rlg_id($p), 'd' => $p['iso'], 'c' => $p['cats'],
            'k' => implode(' ', $p['stack']), 'f' => $p['featured'], 'i' => count($p['images']),
            'h' => $p['thumb']['src'], 'm' => $p['summary']];
    }, projects());
}
