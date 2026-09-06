<?php
$dbFilePath = "_data\portfolio.db";

try {
    $pdo = new PDO("sqlite:" . $dbFilePath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

$filterMode = isset($_GET['filter']) ? $_GET['filter'] : null; // recent, oldest, alphabetical, reverse_alphabetical

$orderBy = "unixdate";
$orderDir = "DESC";

switch ($filterMode) {
    case 'oldest':
        $orderBy = "unixdate";
        $orderDir = "ASC"; 
        break;
    case 'alphabetical':
        $orderBy = "title";
        $orderDir = "ASC"; 
        break;
    case 'reverse_alphabetical':
        $orderBy = "title";
        $orderDir = "DESC"; 
        break;
    case 'recent':
        $orderBy = "unixdate";
        $orderDir = "DESC";
        break;
}

$stmt = $pdo->prepare("SELECT id, slug, title, date, unixdate, description, thumbnail, categories FROM PortfolioTabs ORDER BY $orderBy $orderDir");
$stmt->execute();
$projects = $stmt->fetchAll();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ryan's Portfolio</title>
    <meta name="author" content="Ryan L. Griffith"/>

    <link rel="shortcut icon" href="_assets/icons/logov2_web.ico" />
    <link rel="icon" href="_assets/icons/logov2_weblarge.png" type="image/png" sizes="300x300" />
    <link rel="apple-touch-icon" sizes="150x150" href="_assets/icons/logov2_webmedium.png" />
    <link rel="apple-touch-icon" sizes="75x75" href="_assets/icons/logov2_websmall.png" />

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;700&display=swap" rel="stylesheet">
    
    <link href="_scripts\css\drawer.css" rel="stylesheet"/>
    <link href="_scripts\css\portfolio.css" rel="stylesheet"/>
    
</head>
<body>
    
    <nav class="drawer" id="drawer">
        <div class="drawer-header">
            <a href="index.html" class="home" style="opacity: 1;">
                <img src="_assets\icons\logov2_websmall.png" alt="Home" style="width: 50px; height: 50px;">
            </a>
            <button class="close-btn" id="close-btn" aria-label="Close Menu">&times;</button>
        </div>
        <div class="menu-links">
            <a href="index.html">Home</a>
            <a href="portfolio.php?filter=recent">Portfolio</a>
            <a href="about.html">About Me</a>
            <a href="demos.html">Demos</a>
        </div>
    </nav>
    
    <div id="page-wrapper">
        <header>
            <a href="index.html" class="home">
                <img src="_assets\icons\logov2_websmall.png" alt="Home" style="width: 50px; height: 50px;">
            </a>
            <button class="hamburger" id="hamburger">☰</button>
        </header>

        <section id="portfolio">
            <h2 style="font-size: 40px;">Portfolio</h2>
        </section>

        <section id="portfolio-type-selector">
            <div id="filter-buttons">
                <button id="project-btn" class="active">Projects</button>
                <button id="certificate-btn">Certifications</button>
            </div>  
        </section>

        <section id="portfolio-projects-description">
            <p>Welcome to my certification portfolio! Here, you'll find various certifications and achievements that I have earned and received through my studies and professional development.</p>
        </section>

        <section id="portfolio-projects-description">
           
            <p>Welcome to my project portfolio! Here, you'll find a collection of my work, including programming apps, artistic creations, and engineering contraptions.</p>

            <hr>

            <div id="category-buttons">
                <button onclick="goToFilter('recent')" <?php if ($filterMode === 'recent') echo 'class="active"'; ?>>Recent</button>
                <button onclick="goToFilter('oldest')" <?php if ($filterMode === 'oldest') echo 'class="active"'; ?>>Oldest</button>
                <button onclick="goToFilter('alphabetical')" <?php if ($filterMode === 'alphabetical') echo 'class="active"'; ?>>A - Z</button>
                <button onclick="goToFilter('reverse_alphabetical')" <?php if ($filterMode === 'reverse_alphabetical') echo 'class="active"'; ?>>Z - A</button>
            </div>  

            <hr>

            <div id="filter-buttons">
                <button data-filter="all" class="active">Show All</button>
                <button data-filter="featured">Featured</button>
                <button data-filter="program">Programming</button>
                <button data-filter="art">Art</button>
                <button data-filter="engineer">Engineering</button>
            </div>  
        </section>
        
        <section id="portfolio">
            <div class="portfolio-grid">
                
                <section id="certificates">

                    <div class="certificate-card">
                        <div class="certificate-info">
                            <h3>Python PCEP Certificate</h3>
                            <p>Earned: April 2025</p>
                        </div>
                        <img src="_assets\portfolio\_thumbnails\skull2026_3_2.png" alt="Python PCEP Certificate - Ryan Griffith">
                        <p> Earned through Test...</p>
                    </div>

                    <div class="certificate-card">
                        <img src="_assets\portfolio\_thumbnails\skull2026_3_2.png" alt="AWS Solutions Architect - Associate Certification - Ryan Griffith">
                        <div class="certificate-info">
                            <h3>AWS Solutions Architect - Associate</h3>
                            <p>Earned: January 2024</p>
                        </div>
                    </div>

                    <div class="certificate-card">
                        <img src="_assets\portfolio\_thumbnails\skull2026_3_2.png" alt="AWS Solutions Architect - Associate Certification - Ryan Griffith">
                        <div class="certificate-info">
                            <h3>AWS Solutions Architect - Associate</h3>
                            <p>Earned: January 2024</p>
                        </div>
                    </div>

                    <div class="certificate-card">
                        <img src="assets\portfolio\_thumbnails\skull2026_3_2.png" alt="AWS Solutions Architect - Associate Certification - Ryan Griffith">
                        <div class="certificate-info">
                            <h3>AWS Solutions Architect - Associate</h3>
                            <p>Earned: January 2024</p>
                        </div>
                    </div>

                </section>

                <section id="projects">

                    <?php if (!empty($projects)): ?>
                        <?php foreach ($projects as $project): ?>
                            <?php
                                $projectLink = 'project.php?id=' . htmlspecialchars($project['slug']);
                                $thumbnailPath = htmlspecialchars($project['thumbnail']);
                                $thumbnailAlt = htmlspecialchars($project['title']) . ' - Ryan Griffith';
                                $description = htmlspecialchars($project['description']);
                                $categories = htmlspecialchars($project['categories']);
                                $categoryArray = explode(',', $categories);
                            ?>
                            <div class="project-card" data-category="<?php echo $categories; ?>" data-link="<?php echo $projectLink; ?>">
                                <img src="<?php echo $thumbnailPath; ?>" alt="<?php echo $thumbnailAlt; ?>">
                                <div class="project-info">
                                    <h3><?php echo htmlspecialchars($project['title']); ?></h3>
                                    <div id="project-buttons">
                                        <?php foreach ($categoryArray as $category): ?>
                                            <?php
                                                $trimmedCategory = trim($category);
                                                if ($trimmedCategory === 'engineer') {
                                                    $displayCategory = 'Engineering';
                                                } elseif ($trimmedCategory === 'program') {
                                                    $displayCategory = 'Programming';
                                                } elseif ($trimmedCategory === 'featured') {
                                                    $displayCategory = 'Featured';
                                                } elseif ($trimmedCategory === 'art') {
                                                    $displayCategory = 'Art';
                                                } else {
                                                    $displayCategory = $trimmedCategory;
                                                }
                                            ?>
                                            <button><?php echo htmlspecialchars($displayCategory); ?></button>
                                        <?php endforeach; ?>
                                    </div>
                                    <p><?php echo $description; ?></p>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <p>No projects found.</p>
                    <?php endif; ?>

                </section>

            </div>
        </section>

        <footer>
            <p>Copyright © <span id="year"></span></p>
        </footer>
    </div>

    <script src="_scripts\js\drawer.js"></script>

    <script>
        document.getElementById("year").textContent = new Date().getFullYear();

        function goToFilter(id) {
            window.location.href = "portfolio.php?filter=" + id;
        }

        document.addEventListener("DOMContentLoaded", function () {
            const hamburger = document.getElementById("hamburger");
            const menu = document.getElementById("menu");
            const certificate_btn = document.getElementById("certificate-btn");
            const project_btn = document.getElementById("project-btn");

            hamburger.addEventListener("click", function () {
                menu.classList.toggle("show");
            });

            certificate_btn.addEventListener("click", function () {
                document.getElementById("certificate-info").style.visibility = "visible";
                document.getElementById("project-info").style.visibility = "hidden";
                document.getElementById("certificates").style.visibility = "visible";
                document.getElementById("projects").style.visibility = "hidden";
                certificate_btn.classList.add("active");
                project_btn.classList.remove("active");
            });

            project_btn.addEventListener("click", function () {
                document.getElementById("certificate-info").style.visibility = "hidden";
                document.getElementById("project-info").style.visibility = "visible";
                document.getElementById("certificates").style.visibility = "hidden";
                document.getElementById("projects").style.visibility = "visible";
                project_btn.classList.add("active");
                certificate_btn.classList.remove("active");
            });

            document.addEventListener("click", function (event) {
                if (!menu.contains(event.target) && !hamburger.contains(event.target)) {
                    menu.classList.remove("show");
                }
            });

            const filterButtons = document.querySelectorAll("#filter-buttons button");
            const projects = document.querySelectorAll(".project-card");

            projects.forEach(card => {
                card.addEventListener("click", function () {
                    const link = this.getAttribute("data-link");
                    if (link) {
                        window.location.href = link;
                    }
                });
            });

            filterButtons.forEach(button => {
                button.addEventListener("click", function () {
                    const filter = this.getAttribute("data-filter");

                    filterButtons.forEach(btn => btn.classList.remove("active"));
                    this.classList.add("active");

                    projects.forEach(project => {
                        const categories = project.getAttribute("data-category").split(",");
                        if (filter === "all" || categories.includes(filter)) {
                            project.style.display = "flex";
                            project.style.visibility = "visible";
                            project.style.position = "relative";
                        } else {
                            project.style.display = "flex";
                            project.style.visibility = "hidden";
                            project.style.position = "absolute";
                        }
                    });
                });
            });
        });
    </script>

</body>
</html>
