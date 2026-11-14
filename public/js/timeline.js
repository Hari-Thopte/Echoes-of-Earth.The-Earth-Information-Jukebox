// =============================================================
// 7. MASTER TIMELINE, MODALS, SHARE & POSTCARD
// =============================================================
function syncPlaybackButtonUI() {
  if (!tlPlayBtn) return;
  if (config.mode.current === 'film') {
    const paused = filmTimeline && filmTimeline.paused();
    tlPlayBtn.textContent = paused ? 'Resume' : 'Pause';
    if (tlScrubber) tlScrubber.disabled = true;
  } else {
    if (tlScrubber) tlScrubber.disabled = false;
    if (playback.mode === 'timeline' && config.timeline.playing) {
      tlPlayBtn.textContent = 'Pause';
    } else if (config.timeline.currentYear >= config.story.endYear && !config.overlay.seasonalMode) {
      tlPlayBtn.textContent = 'Replay';
    } else {
      tlPlayBtn.textContent = 'Play';
    }
  }
}

const masterTimeline = {
  play() {
    playback.mode = 'timeline';
    config.timeline.playing = true;
    if (config.timeline.currentYear >= config.story.endYear && !config.overlay.seasonalMode) {
      config.timeline.currentYear = config.story.startYear;
    }
    syncPlaybackButtonUI();
  },
  pause() {
    config.timeline.playing = false;
    if (playback.mode === 'timeline') playback.mode = 'idle';
    syncPlaybackButtonUI();
  },
  toggle() {
    if (config.mode.current === 'film' && filmTimeline) {
      const nextPaused = !filmTimeline.paused();
      filmTimeline.paused(nextPaused);
      syncPlaybackButtonUI();
      return;
    }
    if (config.timeline.playing) this.pause();
    else this.play();
  },
  scrub(yearValue) {
    const clamped = THREE.MathUtils.clamp(Number(yearValue), config.story.startYear, config.story.endYear);
    config.timeline.currentYear = clamped;
    this.syncUI();
    updateOverlayForCurrentYear(false);
  },
  syncBounds() {
    if (tlScrubber) {
      tlScrubber.min = String(config.story.startYear);
      tlScrubber.max = String(config.story.endYear);
    }
    this.scrub(config.timeline.currentYear);
  },
  syncUI() {
    const yr = Math.floor(config.timeline.currentYear);
    if (tlYearLabel) {
      tlYearLabel.textContent = config.overlay.seasonalMode
        ? `${MONTH_NAMES[Math.floor(config.overlay.seasonalMonthFloat - 1) % 12]} ${yr}`
        : String(yr);
    }
    if (tlScrubber) {
      tlScrubber.value = String(config.timeline.currentYear);
      tlScrubber.setAttribute('aria-valuetext', String(yr));
    }
  },
  tick(deltaSeconds) {
    if (!config.timeline.playing || playback.mode !== 'timeline') return;
    if (config.overlay.seasonalMode) {
      config.overlay.seasonalMonthFloat += deltaSeconds * 0.85;
      if (config.overlay.seasonalMonthFloat >= 13.0) config.overlay.seasonalMonthFloat = 1.0;
      this.syncUI();
      updateOverlayForCurrentYear(false);
      return;
    }
    const span = Math.max(1, config.story.endYear - config.story.startYear);
    const rate = span / Math.max(1, config.timeline.cycleDuration);
    config.timeline.currentYear += deltaSeconds * rate;
    if (config.timeline.currentYear >= config.story.endYear) {
      config.timeline.currentYear = config.story.endYear;
      this.pause();
    }
    this.syncUI();
    updateOverlayForCurrentYear(false);
  }
};
window.masterTimeline = masterTimeline;

if (tlPlayBtn) {
  tlPlayBtn.addEventListener('click', async () => {
    await ensureAudioStartedForInteractivePanel();
    masterTimeline.toggle();
  });
}
if (tlScrubber) {
  tlScrubber.addEventListener('input', (e) => {
    if (config.mode.current === 'film') return;
    masterTimeline.pause();
    masterTimeline.scrub(parseFloat(e.target.value));
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
  if (playback.mode === 'compare' || playback.mode === 'preview') playback.mode = 'idle';
}
document.querySelectorAll('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', closeAllModals);
});
const compareNavBtn = document.getElementById('compare-nav-btn');
const listenNavBtn = document.getElementById('listen-nav-btn');
const aboutNavBtn = document.getElementById('about-nav-btn');
if (compareNavBtn) compareNavBtn.addEventListener('click', () => { closeAllModals(); document.getElementById('compare-modal').classList.add('open'); });
if (listenNavBtn) listenNavBtn.addEventListener('click', () => { closeAllModals(); document.getElementById('listen-modal').classList.add('open'); });
if (aboutNavBtn) aboutNavBtn.addEventListener('click', () => { closeAllModals(); document.getElementById('about-modal').classList.add('open'); });

let compareAltInterval = null;
function hearCompareYear(yr) {
  if (compareAltInterval) { clearInterval(compareAltInterval); compareAltInterval = null; }
  const dom = getActiveDomain();
  playback.mode = 'compare';
  masterTimeline.scrub(yr);
  const yA = Number(compareSelectA.value), yB = Number(compareSelectB.value);
  const mA = yearMetricsMap.get(yA), mB = yearMetricsMap.get(yB);
  if (compareReadoutEl && mA && mB) {
    const diffStr = dom.formatDiff(mB.iceIndexPercent - mA.iceIndexPercent);
    compareReadoutEl.textContent = `A: ${yA}, ${dom.formatValue(mA.iceIndexPercent)} | B: ${yB}, ${dom.formatValue(mB.iceIndexPercent)} | Δ ${diffStr}`;
  }
}
const hearABtn = document.getElementById('compare-hear-a-btn');
const hearBBtn = document.getElementById('compare-hear-b-btn');
const altBtn = document.getElementById('compare-alt-btn');
const stopCompBtn = document.getElementById('compare-stop-btn');
if (hearABtn) hearABtn.addEventListener('click', async () => { await ensureAudioStartedForInteractivePanel(); hearCompareYear(Number(compareSelectA.value)); });
if (hearBBtn) hearBBtn.addEventListener('click', async () => { await ensureAudioStartedForInteractivePanel(); hearCompareYear(Number(compareSelectB.value)); });
if (altBtn) altBtn.addEventListener('click', async () => {
  await ensureAudioStartedForInteractivePanel();
  let toggle = false;
  hearCompareYear(Number(compareSelectA.value));
  compareAltInterval = setInterval(() => {
    toggle = !toggle;
    hearCompareYear(Number(toggle ? compareSelectB.value : compareSelectA.value));
  }, 4000);
});
if (stopCompBtn) stopCompBtn.addEventListener('click', () => {
  if (compareAltInterval) { clearInterval(compareAltInterval); compareAltInterval = null; }
  playback.mode = 'idle';
});

function triggerListenPreview(normVal, label) {
  ensureAudioStartedForInteractivePanel().then(() => {
    playback.mode = 'preview';
    soundState.currentActivity = normVal;
    soundState.currentRegionalActivity = normVal;
    const noteEl = document.getElementById('listen-preview-note');
    if (noteEl) noteEl.textContent = `Playing 3s preview: ${label} (activity ${normVal})`;
    setTimeout(() => { if (playback.mode === 'preview') playback.mode = 'idle'; }, 3000);
  });
}
const prevHighBtn = document.getElementById('preview-high-btn');
const prevMidBtn = document.getElementById('preview-mid-btn');
const prevLowBtn = document.getElementById('preview-low-btn');
if (prevHighBtn) prevHighBtn.addEventListener('click', () => triggerListenPreview(0.9, 'High Pack — warm major chords & bright harmonics'));
if (prevMidBtn) prevMidBtn.addEventListener('click', () => triggerListenPreview(0.5, 'Transitional — balanced mid-register notes'));
if (prevLowBtn) prevLowBtn.addEventListener('click', () => triggerListenPreview(0.1, 'Retreated Ice — sparse low minor voicings'));

if (iceColorsBtn) {
  iceColorsBtn.addEventListener('click', () => {
    config.overlay.style = config.overlay.style === 'ice' ? 'nasa' : 'ice';
    overlayUniforms.uStyleMode.value = config.overlay.style === 'ice' ? 0.0 : 1.0;
    iceColorsBtn.setAttribute('aria-pressed', String(config.overlay.style === 'ice'));
    iceColorsBtn.textContent = config.overlay.style === 'ice' ? 'Optical / LUT' : 'Thermal LUT';
    drawPolarStereographicInset(Math.floor(config.timeline.currentYear));
  });
}
if (captionsToggleBtn) {
  captionsToggleBtn.addEventListener('click', () => {
    config.a11y.captions = !config.a11y.captions;
    syncAudioControlsUI();
  });
}
const shareNavBtn = document.getElementById('share-nav-btn');
if (shareNavBtn) {
  shareNavBtn.addEventListener('click', async () => {
    syncUrlHashState();
    let shareUrl = window.location.href;
    const res = await apiRequest('/api/snapshots', {
      method: 'POST',
      body: JSON.stringify({
        domain: getActiveDomain().id,
        year: Math.floor(config.timeline.currentYear),
        mode: config.mode.current,
        audioStyle: config.audio.style,
        regionKey: selectedRegionKey,
        splitCurtainActive: config.overlay.splitCurtainActive,
        splitScreenX: config.overlay.splitScreenX,
        seasonalMode: config.overlay.seasonalMode,
        seasonalMonth: config.overlay.seasonalMonthFloat
      })
    });
    if (res && res.sharePath) {
      shareUrl = window.location.origin + res.sharePath;
      try { history.replaceState(null, '', res.sharePath); } catch (e) {}
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const dummy = document.createElement('textarea');
        dummy.value = shareUrl;
        document.body.appendChild(dummy);
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
      }
    } catch (e) {}
    showOverlayBannerNote(res ? 'Saved snapshot & copied shareable link' : 'Copied shareable link to clipboard');
  });
}
const postcardNavBtn = document.getElementById('postcard-nav-btn');
if (postcardNavBtn) {
  postcardNavBtn.addEventListener('click', () => {
    const dom = getActiveDomain();
    const yr = Math.floor(config.timeline.currentYear);
    const m = yearMetricsMap.get(yr);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = renderer.domElement.width;
    outCanvas.height = renderer.domElement.height;
    const ctx = outCanvas.getContext('2d');
    renderCompleteFrame(clock.getElapsedTime());
    ctx.drawImage(renderer.domElement, 0, 0);
    ctx.fillStyle = 'rgba(6, 10, 20, 0.85)';
    ctx.fillRect(24, outCanvas.height - 84, 560, 60);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${dom.name}, ${yr} — ${m ? dom.formatValue(m.iceIndexPercent) : '--'}`, 40, outCanvas.height - 54);
    ctx.fillStyle = dom.accentColor;
    ctx.font = '14px sans-serif';
    ctx.fillText(`Data: NASA GIBS (${dom.badgeDefault}) • Earth Jukebox`, 40, outCanvas.height - 32);
    outCanvas.toBlob((blob) => {
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `earth-jukebox-${dom.id}-${yr}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    });
  });
}

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
let settledTextures = 0;
const totalTextures = 5;

function configureTexture(tex, isSRGB) {
  if (isSRGB && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
}

function onTextureSettled() {
  settledTextures++;
  const pct = Math.min(100, Math.round((settledTextures / totalTextures) * 100));
  if (loaderBar) loaderBar.style.width = pct + '%';
  if (loaderLabel) loaderLabel.textContent = settledTextures >= totalTextures ? 'TELEMETRY READY' : `LOADING TEXTURES ${pct}%`;
}

function createProceduralEarthTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#dceefb');
  grad.addColorStop(0.12, '#0a2548');
  grad.addColorStop(0.5, '#071c3a');
  grad.addColorStop(0.88, '#0a2548');
  grad.addColorStop(1.0, '#e2f1fc');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#1b3b2b';
  [[130, 88, 36, 26], [158, 148, 22, 34], [268, 86, 42, 24], [285, 134, 24, 34], [356, 86, 54, 30], [412, 168, 22, 16]].forEach(([x, y, rx, ry]) => {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2); ctx.fill();
  });
  const tex = new THREE.CanvasTexture(cv);
  configureTexture(tex, true);
  return tex;
}

function loadWithFallback(primaryUrl, fallbackUrl, isSRGB, onSuccess) {
  const applyOfflineFallback = () => {
    if (typeof textureSources !== 'undefined' && primaryUrl === textureSources.day) {
      onSuccess(createProceduralEarthTexture());
    }
    onTextureSettled();
  };
  textureLoader.load(
    primaryUrl,
    (tex) => { configureTexture(tex, isSRGB); onSuccess(tex); onTextureSettled(); },
    undefined,
    () => {
      if (fallbackUrl) {
        textureLoader.load(fallbackUrl, (tex) => { configureTexture(tex, isSRGB); onSuccess(tex); onTextureSettled(); }, undefined, applyOfflineFallback);
      } else {
        applyOfflineFallback();
      }
    }
  );
}

// lil-gui debug panel
const gui = new lil.GUI({ title: 'Earth Jukebox Debug' });
gui.add(config.overlay, 'style', ['ice', 'nasa']).name('Overlay Style').onChange((v) => {
  overlayUniforms.uStyleMode.value = v === 'ice' ? 0.0 : 1.0;
  drawPolarStereographicInset(Math.floor(config.timeline.currentYear));
});
gui.add(config.overlay, 'heightExtrusion', 0.0, 0.05, 0.002).name('3D Ice Extrusion').onChange((v) => {
  overlayUniforms.uHeightExtrusion.value = v;
});
gui.add(config.overlay, 'edgeGlowStrength', 0.0, 1.5, 0.05).name('Ice Edge Glow').onChange((v) => { overlayUniforms.uEdgeGlowStrength.value = v; });
gui.add(config.overlay, 'cloudDim', 0.0, 1.0, 0.05).name('Cloud Dim').onChange(() => setOverlayCloudDimming(true));
gui.add(config.camera, 'polarLat', 65, 89, 1).name('Polar Lat');
gui.add(config.camera, 'polarDistance', 2.8, 8.0, 0.1).name('Polar Distance');
gui.add(config.a11y, 'reducedMotion').name('Reduced Motion');
gui.add(config.a11y, 'captions').name('Sound Captions').onChange(() => syncAudioControlsUI());
gui.add(config.quality, 'adaptive').name('Adaptive Quality');
gui.add(config.look, 'showFPS').name('Show FPS').onChange((v) => { if (fpsElement) fpsElement.style.display = v ? 'block' : 'none'; });

