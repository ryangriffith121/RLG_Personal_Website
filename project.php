<?php

$dbFilePath = "_data\portfolio.db";

try {
    $pdo = new PDO("sqlite:" . $dbFilePath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    header("HTTP/1.0 500 Internal Server Error");
    die("Database connection failed");
}

$projectSlug = isset($_GET['id']) ? $_GET['id'] : null;

if (!$projectSlug) {
    header("HTTP/1.0 400 Bad Request");
    echo "<h1>Error: Project slug is missing.</h1>";
    exit();
}

$stmt = $pdo->prepare("SELECT * FROM PortfolioPage WHERE Slug = :Slug");
$stmt->execute([':Slug' => $projectSlug]);
$project = $stmt->fetch();

if (!$project) {
    header("HTTP/1.0 404 Not Found");
    echo "<h1>Project Not Found</h1>";
    exit();
}

$pageTitle = htmlspecialchars($project['title']);
$projectDate = htmlspecialchars($project['date']);
$projectDescription = $project['description'];
$projectLearned = $project['whatilearned'];
$projectTakeaway = $project['takeaway'];
$imagePaths = explode(',', $project['images']);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $pageTitle; ?> - Ryan Griffith</title>
    
    <meta name="author" content="Ryan L. Griffith" />

    <link rel="shortcut icon" href="_assets/icons/logov2_web.ico" />
    <link rel="icon" href="_assets/icons/logov2_weblarge.png" type="image/png" sizes="300x300" />
    <link rel="apple-touch-icon" sizes="150x150" href="_assets/icons/logov2_webmedium.png" />
    <link rel="apple-touch-icon" sizes="75x75" href="_assets/icons/logov2_websmall.png" />

    <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="_scripts/css/project.css">
    <link rel="stylesheet" href="_scripts/css/drawer.css">
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

    <div id="page-wrapper" style="align-items: center;">

        <header>
            <a href="index.html" class="home">
                <img src="_assets\icons\logov2_websmall.png" alt="Home" style="width: 50px; height: 50px;">
            </a>
            <button class="hamburger" id="hamburger">☰</button>
        </header>

        <h1><?php echo $pageTitle; ?></h1>

        <h2>
            <?php echo $projectDate; ?>
        </h2>

        <div class="bubble">
            <div class="container">
                <div class="carousel-container">
                    <div class="carousel">
                        <?php foreach ($imagePaths as $imagePath): ?>
                            <div class="slide"><img src="<?php echo htmlspecialchars(trim($imagePath)); ?>" alt="<?php echo $pageTitle; ?>"></div>
                        <?php endforeach; ?>    
                    </div>

                    <button id="prev">&lt;</button>
                    <button id="next">&gt;</button>
                </div>

                <div class="side-text">
                    <label >Description:</label>
                    <h4><?php echo $projectDescription; ?></h4>

                    <label >What I Learned:</label>
                    <h4><?php echo $projectLearned; ?></h4>

                    <label >Takeaway:</label>
                    <h4><?php echo $projectTakeaway; ?></h4>
                </div>
            </div>
        </div>
        <footer>
            <p>Copyright © <span id="year"></span></p>
        </footer>
    </div>

    <script src="_scripts\js\project.js"></script>

    <script src="_scripts\js\drawer.js"></script>

    <script>
        document.getElementById("year").textContent = new Date().getFullYear();

        document.addEventListener("DOMContentLoaded", function () {
            const hamburger = document.getElementById("hamburger");
            const menu = document.getElementById("menu");

            hamburger.addEventListener("click", function () {
                menu.classList.toggle("show");
            });

            document.addEventListener("click", function (event) {
                if (!menu.contains(event.target) && !hamburger.contains(event.target)) {
                    menu.classList.remove("show");
                }
            });
        });
    </script>
</body>
</html>
