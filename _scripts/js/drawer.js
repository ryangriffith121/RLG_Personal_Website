document.addEventListener("DOMContentLoaded", function () {
    const hamburger = document.getElementById("hamburger");
    const closeBtn = document.getElementById("close-btn");
    const drawer = document.getElementById("drawer");
    const body = document.body;

    hamburger.addEventListener("click", function () {
        body.classList.add("drawer-open");
    });

    closeBtn.addEventListener("click", function () {
        body.classList.remove("drawer-open");
    });
});