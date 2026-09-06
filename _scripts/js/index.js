(function () {
    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    const dots = Array.from({ length: 30 }, () => ({
        x: Math.random() * 2 * canvas.width - canvas.width,
        y: Math.random() * 2 * canvas.height - canvas.height,
        r: Math.random() * 2000 + 5000,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        ax: (Math.random() - 0.5) * 0.1,
        ay: (Math.random() - 0.5) * 0.1,
        time: 0,
        color: 'hsl(' + Math.floor(Math.random() * 360) + ', 100%, 30%)'
    }));

    function draw() {
        canvas.width = canvas.offsetWidth; 
        canvas.height = canvas.offsetHeight;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        dots.forEach(d => {
            d.time += 0.01;

            const speed = Math.hypot(d.vx, d.vy);
            const speedCap = 2;

            if (speed < speedCap) {
                d.vx += d.ax;
                d.vy += d.ay;
            }

            d.x += d.vx;
            d.y += d.vy;

            if (d.x < (-canvas.width * 0.5) || d.x > canvas.width * 1.5) d.vx *= -1;
            if (d.y < (-canvas.height * 0.5) || d.y > canvas.height * 1.5) d.vy *= -1;

            if (d.time > 20) {
                d.ax = (Math.random() - 0.5) * 0.01;
                d.ay = (Math.random() - 0.5) * 0.01;
                d.time = 0;
            }

            gradient = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
            gradient.addColorStop(0, d.color);
            gradient.addColorStop(0.1, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r*100, 0, 2 * Math.PI);
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }

    draw();
})();