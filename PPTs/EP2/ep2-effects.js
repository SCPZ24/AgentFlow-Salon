(function () {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const dots = document.querySelectorAll('.dot-field');
  window.addEventListener('pointermove', (event) => {
    const x = (event.clientX / window.innerWidth * 100).toFixed(2) + '%';
    const y = (event.clientY / window.innerHeight * 100).toFixed(2) + '%';
    dots.forEach((el) => {
      el.style.setProperty('--mx', x);
      el.style.setProperty('--my', y);
    });
  }, { passive: true });

  const canvas = document.getElementById('splash-cursor');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let hue = 205;
  const splashes = [];
  const pointer = { x: -9999, y: -9999, px: -9999, py: -9999 };

  function resize() {
    dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function addSplash(x, y, force) {
    hue = (hue + 18) % 360;
    splashes.push({
      x,
      y,
      r: 10 + force * 0.15,
      life: 1,
      hue,
      vx: (Math.random() - .5) * force * .025,
      vy: (Math.random() - .5) * force * .025
    });
    if (splashes.length > 38) splashes.splice(0, splashes.length - 38);
  }

  function onPointerMove(event) {
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    const dx = pointer.x - pointer.px;
    const dy = pointer.y - pointer.py;
    const speed = Math.sqrt(dx * dx + dy * dy);
    if (speed > 4) addSplash(pointer.x, pointer.y, clamp(speed, 10, 130));
  }

  function onPointerDown(event) {
    for (let i = 0; i < 7; i += 1) {
      addSplash(event.clientX + (Math.random() - .5) * 42, event.clientY + (Math.random() - .5) * 42, 90 + Math.random() * 70);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = splashes.length - 1; i >= 0; i -= 1) {
      const splash = splashes[i];
      splash.x += splash.vx;
      splash.y += splash.vy;
      splash.r += 2.8 + (1 - splash.life) * 10;
      splash.life *= .945;

      const gradient = ctx.createRadialGradient(splash.x, splash.y, 0, splash.x, splash.y, splash.r);
      gradient.addColorStop(0, `hsla(${splash.hue}, 96%, 68%, ${splash.life * .42})`);
      gradient.addColorStop(.42, `hsla(${(splash.hue + 48) % 360}, 96%, 64%, ${splash.life * .22})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(splash.x, splash.y, splash.r, 0, Math.PI * 2);
      ctx.fill();

      if (splash.life < .025) splashes.splice(i, 1);
    }

    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  requestAnimationFrame(draw);
})();
