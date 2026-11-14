// Start-screen animated mini-globe domain pill thumbnails
(function initStartDomainThumbs() {
  const canvases = document.querySelectorAll('canvas.start-domain-thumb[data-thumb]');
  if (!canvases.length) return;
  const palettes = {
    ice: { bg: '#03172e', accent: '#e0f2fe', rim: '#38bdf8' },
    antarctica: { bg: '#062017', accent: '#d1fae5', rim: '#10b981' },
    air: { bg: '#0b2038', accent: '#fae8ff', rim: '#38bdf8' },
    greenness: { bg: '#042217', accent: '#a7f3d0', rim: '#34d399' },
    temperature: { bg: '#29061d', accent: '#fce7f3', rim: '#ec4899' },
    rainfall: { bg: '#0a1e3f', accent: '#eff6ff', rim: '#60a5fa' }
  };
  function drawThumbs(now) {
    const loading = document.getElementById('loading-screen');
    if (loading && loading.classList.contains('fade-out')) return;
    const t = now * 0.0014;
    canvases.forEach((cv, idx) => {
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const w = cv.width, h = cv.height, cx = w / 2, cy = h / 2, r = w * 0.44;
      const pal = palettes[cv.dataset.thumb] || palettes.ice;
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
      grad.addColorStop(0, pal.accent);
      grad.addColorStop(0.55, pal.rim);
      grad.addColorStop(1, pal.bg);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx + Math.sin(t + idx) * 2.5, cy, r * 0.65, r * 0.32, 0.35, 0, Math.PI * 2);
      ctx.stroke();
    });
    requestAnimationFrame(drawThumbs);
  }
  requestAnimationFrame(drawThumbs);
})();
