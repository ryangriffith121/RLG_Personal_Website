const carousel = document.querySelector(".carousel");
const slides = document.querySelectorAll(".slide");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const title = document.getElementById("carousel-title");
const desc = document.getElementById("carousel-desc");

// Array of Titles and Descriptions
const projectData = [
    { title: "Project One", desc: "Description for Project One" },
    { title: "Project Two", desc: "Description for Project Two" },
    { title: "Project Three", desc: "Description for Project Three" }
];

let currentIndex = 0;

// Function to Update Slide
function updateSlide() {
    carousel.style.transform = `translateX(-${currentIndex * 100}%)`;
    title.textContent = projectData[currentIndex].title;
    desc.textContent = projectData[currentIndex].desc;
}

// Next Button
nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateSlide();
});

// Prev Button
prevBtn.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateSlide();
});

// Auto Slide
setInterval(() => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateSlide();
}, 7500);