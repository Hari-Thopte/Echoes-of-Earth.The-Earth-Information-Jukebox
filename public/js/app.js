// =============================================================
// 8. STARTUP, CONTROLS, SHORTCUTS & RENDER LOOP
// =============================================================
async function resumeAndInitAudioFromGesture() {
  try {
    if (typeof ensureAudioStartedForInteractivePanel === 'function') {
      await ensureAudioStartedForInteractivePanel();
    }
    if (typeof window.Tone !== 'undefined' && typeof window.Tone.start === 'function') {
      await window.Tone.start();
    }
    if (typeof initAudioEngine === 'function') {
      initAudioEngine();
    }
  } catch (err) {
    console.warn('Audio gesture initialization warning:', err);
    if (typeof showOverlayBannerNote === 'function') {
      showOverlayBannerNote('AudioContext blocked by browser — click Play or Unmute to enable sound');
    }
  }
}

function closeToolsMenu() {
  if (topNavBtns) topNavBtns.classList.remove('mobile-open');
  if (mobileMenuBtn) {
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    mobileMenuBtn.textContent = 'Tools ▾';
  }
}

if (mobileMenuBtn && topNavBtns) {
  mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = topNavBtns.classList.toggle('mobile-open');
    mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
    mobileMenuBtn.textContent = isOpen ? 'Tools ▴' : 'Tools ▾';
  });
  document.addEventListener('click', (e) => {
    if (topNavBtns.classList.contains('mobile-open') && !topNavBtns.contains(e.target) && e.target !== mobileMenuBtn) {
      closeToolsMenu();
    }
  });
  topNavBtns.querySelectorAll('.nav-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => closeToolsMenu());
  });
}

if (polarCollapseBtn && polarInsetPanelEl) {
  polarCollapseBtn.addEventListener('click', () => {
    const collapsed = polarInsetPanelEl.classList.toggle('collapsed');
    polarCollapseBtn.setAttribute('aria-expanded', String(!collapsed));
    polarCollapseBtn.textContent = collapsed ? '+' : '−';
  });
}

if (window.innerWidth < 800 && polarInsetPanelEl && polarCollapseBtn) {
  polarInsetPanelEl.classList.add('collapsed');
  polarCollapseBtn.setAttribute('aria-expanded', 'false');
  polarCollapseBtn.textContent = '+';
}

const skipLinkEl = document.getElementById('skip-to-timeline');
if (skipLinkEl && tlPlayBtn) {
  skipLinkEl.addEventListener('click', (e) => {
    e.preventDefault();
    tlPlayBtn.focus();
  });
}

function syncAudioControlsUI() {
  if (tlMuteBtn) {
    const isInit = soundState && soundState.initialized;
    if (!isInit && config.audio.muted) {
      tlMuteBtn.textContent = 'Sound off';
    } else {
      tlMuteBtn.textContent = config.audio.muted ? 'Unmute' : 'Mute';
    }
    tlMuteBtn.setAttribute('aria-pressed', String(Boolean(config.audio.muted)));
  }
  if (tlVolumeSlider) tlVolumeSlider.value = String(config.audio.volume);
  if (tlStyleSelect && config.audio.style) tlStyleSelect.value = config.audio.style;
  if (captionsToggleBtn && config.a11y) captionsToggleBtn.setAttribute('aria-pressed', String(Boolean(config.a11y.captions)));
  if (soundCaptionStripEl && config.a11y) soundCaptionStripEl.classList.toggle('visible', Boolean(config.a11y.captions));
}

if (tlMuteBtn) {
  tlMuteBtn.addEventListener('click', async () => {
    if (!soundState.initialized) {
      await resumeAndInitAudioFromGesture();
      config.audio.muted = false;
    } else {
      config.audio.muted = !config.audio.muted;
    }
    syncAudioControlsUI();
    updateMasterVolume();
  });
}

if (tlVolumeSlider) {
  tlVolumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (Number.isFinite(val)) {
      config.audio.volume = val;
      if (config.audio.volume > 0 && config.audio.muted) config.audio.muted = false;
      syncAudioControlsUI();
      updateMasterVolume();
    }
  });
}

if (tlStyleSelect) {
  tlStyleSelect.addEventListener('change', (e) => {
    config.audio.style = e.target.value;
    applySoundStyleRouting();
    syncUrlHashState();
  });
}

let hashSyncTimer = null;
function syncUrlHashState() {
  if (hashSyncTimer) clearTimeout(hashSyncTimer);
  hashSyncTimer = setTimeout(() => {
    try {
      const dom = getActiveDomain();
      const yr = Math.floor(config.timeline.currentYear);
      const modeKey = config.mode.current === 'film' ? 'film' : 'explore';
      const styleMap = { 'Calm ambient': 'calm', 'Minimal': 'minimal', 'Original': 'original' };
      const sKey = styleMap[config.audio.style] || 'calm';
      if (window.location.hash !== '#debug') {
        history.replaceState(null, '', `#d=${dom.id}&y=${yr}&m=${modeKey}&s=${sKey}`);
      }
    } catch (err) { }
  }, 250);
}

function parseInitialUrlHash() {
  try {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    if (raw === 'debug' || raw.includes('debug=1')) {
      if (gui && gui.domElement) gui.domElement.style.display = '';
    }
    const params = new URLSearchParams(raw);
    const dParam = (params.get('d') || '').toLowerCase();
    if (dParam && EARTH_DOMAINS[dParam]) {
      window.ACTIVE_DOMAIN_ID = dParam;
    }
    const yParam = parseInt(params.get('y'), 10);
    if (Number.isFinite(yParam) && yParam >= config.story.startYear && yParam <= config.story.endYear) {
      config.timeline.currentYear = yParam;
    }
    const sParam = (params.get('s') || '').toLowerCase();
    if (sParam === 'minimal') config.audio.style = 'Minimal';
    else if (sParam === 'original') config.audio.style = 'Original';
    else if (sParam === 'calm') config.audio.style = 'Calm ambient';
  } catch (err) { }
}

async function loadBuoysForDomain(domainId) {
  if (!BACKEND_ENABLED) return;
  const sid = window.COLLAB_ROOM_ID || CLIENT_SESSION_ID;
  const buoysRes = await apiRequest(`/api/buoys?sessionId=${encodeURIComponent(sid)}&domain=${encodeURIComponent(domainId)}`);
  if (getActiveDomain().id !== domainId) return;
  if (buoysRes && Array.isArray(buoysRes.buoys)) {
    nextBuoyNumber = 1;
    for (const b of buoysRes.buoys) {
      addBuoyToScene({ dbId: b.id, buoyNumber: b.buoyNumber, latDeg: b.lat, lonDeg: b.lon });
      nextBuoyNumber = Math.max(nextBuoyNumber, b.buoyNumber + 1);
    }
  }
}

async function fetchDomainMetricsFromBackend(domainId) {
  if (!BACKEND_ENABLED) return;
  const metricsRes = await apiRequest(`/api/metrics?domain=${encodeURIComponent(domainId)}`);
  if (!metricsRes || !Array.isArray(metricsRes.metrics) || metricsRes.metrics.length === 0) return;

  const seriesObj = {};
  for (const m of metricsRes.metrics) {
    const val = m.value !== undefined ? m.value : m.iceIndexPercent;
    if (Number.isFinite(val)) seriesObj[m.year] = val;
  }
  domainMetricsCache.set(domainId, seriesObj);
  if (getActiveDomain().id === domainId) {
    seedMetricsForDomain(domainId);
    updateChartUI();
    detectAndRenderDataMoments();
    interpolateSoundForTimelineYear(config.timeline.currentYear, 0.25);
  }
}

async function switchEarthDomain(domainId, { flyCamera = true, forceReload = true } = {}) {
  const dom = EARTH_DOMAINS[domainId];
  if (!dom) return;

  window.ACTIVE_DOMAIN_ID = dom.id;
  try { localStorage.setItem('earthJukeboxLastDomain', dom.id); } catch (_) { }
  overlayUniforms.uDomainMode.value = dom.modeIndex;
  config.story.name = dom.name;
  config.story.closingCaption = dom.closingCaption;
  config.story.legendText = dom.legendText;
  config.story.soundKeyText = dom.soundKeyText;
  config.camera.polarLat = dom.framing.lat;
  config.camera.polarLon = dom.framing.lon;
  config.camera.polarDistance = dom.framing.distance;

  if (typeof setSunHemisphere === 'function') {
    setSunHemisphere(dom.id === 'antarctica');
  }
  const isPolarDom = dom.id === 'ice' || dom.id === 'antarctica';
  if (baseline3DRing) {
    baseline3DRing.visible = dom.id === 'ice' && config.overlay.show3DBaseline;
  }
  if (typeof baselineSouth3DRing !== 'undefined' && baselineSouth3DRing) {
    baselineSouth3DRing.visible = dom.id === 'antarctica' && config.overlay.show3DBaseline;
  }
  if (baseline3dToggleBtn) {
    baseline3dToggleBtn.style.display = isPolarDom ? '' : 'none';
  }
  const chartGradStops = document.querySelectorAll('#iceChartGrad stop');
  if (chartGradStops && chartGradStops.length > 0) {
    chartGradStops[0].setAttribute('stop-color', dom.accentColor);
    if (chartGradStops[1]) chartGradStops[1].setAttribute('stop-color', dom.accentColor);
  }

  document.querySelectorAll('.domain-pill-btn, .start-domain-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-domain') === dom.id);
  });

  // Update start screen preview labels if present
  const startBadge = document.getElementById('start-badge-el');
  const startTitle = document.getElementById('start-hero-title');
  const startSub = document.getElementById('start-hero-sub');
  if (startBadge) startBadge.textContent = dom.heroBadge;
  if (startTitle) startTitle.textContent = dom.heroTitle;
  if (startSub) startSub.textContent = dom.heroSubtitle;

  // Update HUD labels & palette
  const inspTitle = document.getElementById('inspector-title-lbl');
  const inspSeries = document.getElementById('inspector-series-lbl');
  const kpiMain = document.getElementById('kpi-main-lbl');
  const kpiSec = document.getElementById('kpi-sec-lbl');
  const drawerLbl = document.getElementById('drawer-metric-lbl');
  const legendTxt = document.getElementById('story-legend-text');
  const legendBar = document.getElementById('legend-ramp-bar');
  const soundKeyEl = document.getElementById('story-sound-key');
  if (inspTitle) inspTitle.textContent = dom.telemetryTitle;
  if (inspSeries) inspSeries.textContent = dom.seriesTag;
  if (kpiMain) kpiMain.textContent = dom.kpiLabelMain;
  if (kpiSec) kpiSec.textContent = dom.kpiLabelSecondary;
  if (drawerLbl) drawerLbl.textContent = dom.drawerMetricTitle;
  if (legendTxt) legendTxt.textContent = dom.legendText;
  if (legendBar) legendBar.style.background = dom.legendGradient;
  if (soundKeyEl) soundKeyEl.textContent = dom.soundKeyText;

  if (gibsHdPillEl) {
    const loadedCount = Array.from(realGibsLoadedYears).filter((k) => k.startsWith(dom.id + ':')).length;
    gibsHdPillEl.textContent = loadedCount > 0 ? `${dom.shortName} HD: ${loadedCount}/23 yrs` : dom.badgeDefault;
  }

  selectedRegionKey = null;
  if (regionStoryCardEl) regionStoryCardEl.classList.remove('visible');
  init3DGlobeFloatingMarkers();

  seedMetricsForDomain(dom.id);
  detectAndRenderDataMoments();
  updateOverlayForCurrentYear(forceReload);
  interpolateSoundForTimelineYear(config.timeline.currentYear, 0.25);

  if (flyCamera && !loadingScreen?.parentNode) {
    flyToRegion(dom.framing.lat, dom.framing.lon, dom.framing.distance, 1.6, true);
  }

  clearBuoysFromScene();
  loadBuoysForDomain(dom.id);
  fetchDomainMetricsFromBackend(dom.id);
  startProgressiveRealGibsStreamer(dom.id);
  syncUrlHashState();
}

document.querySelectorAll('.domain-pill-btn, .start-domain-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const domId = btn.getAttribute('data-domain');
    if (!domId) return;
    const isStartBtn = btn.classList.contains('start-domain-btn');
    if (!isStartBtn) await ensureAudioStartedForInteractivePanel();
    switchEarthDomain(domId, { flyCamera: !isStartBtn });
  });
});

function populateCompareSelects() {
  if (!compareSelectA || !compareSelectB) return;
  compareSelectA.innerHTML = '';
  compareSelectB.innerHTML = '';
  for (let y = config.story.startYear; y <= config.story.endYear; y++) {
    const optA = document.createElement('option');
    optA.value = String(y); optA.textContent = String(y);
    if (y === config.story.startYear) optA.selected = true;
    compareSelectA.appendChild(optA);

    const optB = document.createElement('option');
    optB.value = String(y); optB.textContent = String(y);
    if (y === config.story.endYear) optB.selected = true;
    compareSelectB.appendChild(optB);
  }
}

const watchStoryStartBtn = document.getElementById('watch-story-start-btn');
const exploreOwnStartBtn = document.getElementById('explore-own-start-btn');
const startMutedLinkBtn = document.getElementById('start-without-sound-btn');
const watchStoryNavBtn = document.getElementById('watch-story-nav-btn');
const closingExploreBtn = document.getElementById('closing-explore-btn');
const closingReplayBtn = document.getElementById('closing-replay-btn');
const coachMarksEl = document.getElementById('coach-marks');
const coachStepTextEl = document.getElementById('coach-step-text');
const coachNextBtn = document.getElementById('coach-next-btn');
const coachDismissBtn = document.getElementById('coach-dismiss-btn');

const COACH_STEPS = [
  '1/3 • Hover directly on the 3D Arctic pack ice to inspect concentration and trigger stereo harmonic notes.',
  '2/3 • Toggle "3D Split Curtain" in the right inspector to drag a live 2003 vs Now divider across the Earth.',
  '3/3 • Click any Arctic region tab in the top bar (Beaufort Gyre, Fram Strait) for localized cross-section data.'
];
let coachStepIndex = 0;

function maybeShowCoachMarks() {
  try { if (localStorage.getItem('ej_arctic_coach_seen') === '1') return; } catch (e) { }
  if (!coachMarksEl || !coachStepTextEl) return;
  coachStepIndex = 0;
  coachStepTextEl.textContent = COACH_STEPS[0];
  coachMarksEl.classList.add('visible');
}

function dismissCoachMarks() {
  if (coachMarksEl) coachMarksEl.classList.remove('visible');
  try { localStorage.setItem('ej_arctic_coach_seen', '1'); } catch (e) { }
}

if (coachNextBtn) {
  coachNextBtn.addEventListener('click', () => {
    coachStepIndex++;
    if (coachStepIndex >= COACH_STEPS.length) dismissCoachMarks();
    else if (coachStepTextEl) coachStepTextEl.textContent = COACH_STEPS[coachStepIndex];
  });
}
if (coachDismissBtn) coachDismissBtn.addEventListener('click', dismissCoachMarks);

const startBgVideoEl = document.getElementById('start-bg-video');
if (startBgVideoEl) {
  startBgVideoEl.play().catch(() => { });
}

function dismissLoadingScreen() {
  if (startBgVideoEl) {
    try { startBgVideoEl.pause(); } catch (_) { }
  }
  if (loadingScreen && !loadingScreen.classList.contains('fade-out')) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      if (loadingScreen.parentNode) loadingScreen.parentNode.removeChild(loadingScreen);
    }, 800);
  }
}

function launchExploreOnMyOwn(startWithSound = true) {
  dismissLoadingScreen();
  if (!startWithSound) {
    config.audio.muted = true;
    config.a11y.captions = true;
  } else {
    config.audio.muted = false;
  }
  syncAudioControlsUI();
  updateMasterVolume();
  applySoundStyleRouting();
  switchToExploreMode(true);
  playback.mode = 'idle';
  config.timeline.playing = false;
  masterTimeline.scrub(config.story.startYear);
  syncPlaybackButtonUI();
  flyToPolarFraming(config.a11y.reducedMotion ? 0.4 : 2.0);
  maybeShowCoachMarks();
}

if (watchStoryStartBtn) {
  watchStoryStartBtn.addEventListener('click', async () => {
    dismissLoadingScreen();
    await resumeAndInitAudioFromGesture();
    config.audio.muted = false;
    syncAudioControlsUI();
    updateMasterVolume();
    applySoundStyleRouting();
    startFilmMode();
  });
}
if (exploreOwnStartBtn) {
  exploreOwnStartBtn.addEventListener('click', async () => {
    await resumeAndInitAudioFromGesture();
    launchExploreOnMyOwn(true);
  });
}
if (startMutedLinkBtn) {
  startMutedLinkBtn.addEventListener('click', (e) => {
    e.preventDefault();
    launchExploreOnMyOwn(false);
  });
}
if (watchStoryNavBtn) {
  watchStoryNavBtn.addEventListener('click', async () => {
    if (!config.audio.muted) await resumeAndInitAudioFromGesture();
    startFilmMode();
  });
}
if (closingExploreBtn) {
  closingExploreBtn.addEventListener('click', () => {
    switchToExploreMode(true);
    maybeShowCoachMarks();
  });
}
if (closingReplayBtn) {
  closingReplayBtn.addEventListener('click', () => {
    masterTimeline.scrub(config.story.startYear);
    startFilmMode();
  });
}

// Load Earth Textures
loadWithFallback(textureSources.day, textureSources.dayFallback, true, (tex) => { earthUniforms.uDayTexture.value = tex; earthMaterial.needsUpdate = true; });
loadWithFallback(textureSources.night, null, true, (tex) => { earthUniforms.uNightTexture.value = tex; earthMaterial.needsUpdate = true; });
loadWithFallback(textureSources.normal, null, false, (tex) => { earthUniforms.uNormalMap.value = tex; earthMaterial.needsUpdate = true; });
loadWithFallback(textureSources.specular, null, false, (tex) => {
  earthUniforms.uSpecularMap.value = tex;
  overlayUniforms.uSpecularMap.value = tex;
  earthMaterial.needsUpdate = true;
  overlayMaterial.needsUpdate = true;
});
loadWithFallback(textureSources.clouds, null, false, (tex) => {
  cloudsUniforms.uCloudsTexture.value = tex;
  earthUniforms.uCloudsTexture.value = tex;
  cloudsMaterial.needsUpdate = true;
  earthMaterial.needsUpdate = true;
});

if (gui && gui.domElement && !window.location.hash.includes('debug')) {
  gui.domElement.style.display = 'none';
}

async function hydrateFromBackend() {
  if (!BACKEND_ENABLED) return;

  const activeDomId = getActiveDomain().id;
  await fetchDomainMetricsFromBackend(activeDomId);

  const regionsRes = await apiRequest('/api/regions');
  if (regionsRes && Array.isArray(regionsRes.regions)) {
    for (const r of regionsRes.regions) {
      EARTH_DOMAINS.ice.regions[r.key] = {
        label: r.label,
        title: r.title,
        lat: r.lat,
        lon: r.lon,
        dist: r.dist,
        desc: r.desc
      };
    }
    if (getActiveDomain().id === 'ice') init3DGlobeFloatingMarkers();
  }

  await loadBuoysForDomain(activeDomId);

  const snapId = new URLSearchParams(window.location.search).get('snap');
  if (snapId) {
    const snapRes = await apiRequest(`/api/snapshots/${encodeURIComponent(snapId)}`);
    if (snapRes && snapRes.snapshot) {
      const s = snapRes.snapshot;
      if (s.domain && EARTH_DOMAINS[s.domain] && s.domain !== getActiveDomain().id) {
        await switchEarthDomain(s.domain, { flyCamera: false });
      }
      if (s.audioStyle) config.audio.style = s.audioStyle;
      if (s.seasonalMode) {
        config.overlay.seasonalMode = true;
        config.overlay.seasonalMonthFloat = s.seasonalMonth || 9.0;
        if (seasonalCycleToggleBtn) seasonalCycleToggleBtn.setAttribute('aria-pressed', 'true');
      }
      if (s.splitCurtainActive) {
        config.overlay.splitCurtainActive = true;
        overlayUniforms.uSplitCurtainActive.value = 1.0;
        if (curtain3dToggleBtn) curtain3dToggleBtn.setAttribute('aria-pressed', 'true');
        if (splitCurtainUiEl) splitCurtainUiEl.classList.add('active');
        updateSplitCurtainPosition(s.splitScreenX || 0.5);
      }
      masterTimeline.scrub(s.year);
      syncAudioControlsUI();
      applySoundStyleRouting();
      const activeDom = getActiveDomain();
      if (s.regionKey && activeDom.regions[s.regionKey]) {
        selectArcticLandmark(s.regionKey);
      }
    }
  }
}

parseInitialUrlHash();
populateCompareSelects();
masterTimeline.syncBounds();
syncAudioControlsUI();
if (getActiveDomain().id !== 'ice') {
  switchEarthDomain(getActiveDomain().id, { flyCamera: false, forceReload: true });
} else {
  updateOverlayForCurrentYear(true);
  startBackgroundMetricsPreload();
}
hydrateFromBackend();
window.EJ = window.EJ || {};
window.EJ.switchDomain = switchEarthDomain;

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const key = e.key;
  if (key === ' ') {
    e.preventDefault();
    if (tlPlayBtn) tlPlayBtn.click();
  } else if (key === 'ArrowLeft') {
    if (config.mode.current === 'film') return;
    e.preventDefault();
    masterTimeline.pause();
    masterTimeline.scrub(Math.max(config.story.startYear, Math.floor(config.timeline.currentYear) - 1));
  } else if (key === 'ArrowRight') {
    if (config.mode.current === 'film') return;
    e.preventDefault();
    masterTimeline.pause();
    masterTimeline.scrub(Math.min(config.story.endYear, Math.floor(config.timeline.currentYear) + 1));
  } else if (key === 'm' || key === 'M') {
    e.preventDefault();
    if (tlMuteBtn) tlMuteBtn.click();
  } else if (key === 'w' || key === 'W') {
    e.preventDefault();
    if (watchStoryNavBtn) watchStoryNavBtn.click();
  } else if (key === 'c' || key === 'C') {
    e.preventDefault();
    if (compareNavBtn) compareNavBtn.click();
  } else if (key === 'h' || key === 'H') {
    e.preventDefault();
    if (listenNavBtn) listenNavBtn.click();
  } else if (key === 'a' || key === 'A' || key === '?') {
    e.preventDefault();
    if (aboutNavBtn) aboutNavBtn.click();
  } else if (key === 'r' || key === 'R') {
    e.preventDefault();
    if (sweepNavBtn) sweepNavBtn.click();
  } else if (key === 'i' || key === 'I') {
    e.preventDefault();
    if (polarCollapseBtn) polarCollapseBtn.click();
  } else if (key === 's' || key === 'S') {
    e.preventDefault();
    const styles = ['Calm ambient', 'Minimal', 'Original'];
    config.audio.style = styles[(styles.indexOf(config.audio.style) + 1) % styles.length];
    syncAudioControlsUI();
    applySoundStyleRouting();
    syncUrlHashState();
  } else if (key === 'g' || key === 'G') {
    e.preventDefault();
    if (gui && gui.domElement) {
      gui.domElement.style.display = gui.domElement.style.display === 'none' ? '' : 'none';
    }
    const dbgPanel = document.getElementById('debug-selftest-panel');
    if (dbgPanel) {
      dbgPanel.style.display = dbgPanel.style.display === 'block' ? 'none' : 'block';
      if (dbgPanel.style.display === 'block' && window.EJ && window.EJ.selfTest) window.EJ.selfTest();
    }
  } else if (key === 'Escape') {
    if (config.mode.current === 'film') {
      switchToExploreMode(true);
    } else if (typeof playback !== 'undefined' && playback && playback.mode === 'sweep') {
      stopRadarSweep();
    } else {
      closeAllModals();
    }
    dismissCoachMarks();
  }
});

// Post-processing Render & Main Loop
const halfWidthVec = new THREE.Vector2(), halfHeightVec = new THREE.Vector2();
let currentFps = 60, frameCount = 0, lastFpsTime = performance.now(), prevElapsedTime = 0.0;
let lowFpsAccumSeconds = 0.0, adaptiveQualityStep = 0, isTabHidden = false;

function renderCompleteFrame(elapsedTime) {
  overlayUniforms.uTime.value = elapsedTime;
  compositeMaterial.uniforms.time.value = elapsedTime;
  renderer.setRenderTarget(sceneRenderTarget);
  renderer.clear();
  renderer.render(scene, camera);

  const reducedMotionOn = Boolean(config.a11y && config.a11y.reducedMotion);
  if (config.bloom.strength > 0.001 && !reducedMotionOn) {
    quadMesh.material = brightMaterial;
    brightMaterial.uniforms.tDiffuse.value = sceneRenderTarget.texture;
    renderer.setRenderTarget(brightRenderTarget);
    renderer.render(postScene, postCamera);

    quadMesh.material = blurMaterial;
    const bRad = config.bloom.radius;
    halfWidthVec.set(bRad / Math.max(1, brightRenderTarget.width * 0.5), 0.0);
    halfHeightVec.set(0.0, bRad / Math.max(1, brightRenderTarget.height * 0.5));

    blurMaterial.uniforms.tDiffuse.value = brightRenderTarget.texture;
    blurMaterial.uniforms.direction.value = halfWidthVec;
    renderer.setRenderTarget(blurRenderTarget);
    renderer.render(postScene, postCamera);

    blurMaterial.uniforms.tDiffuse.value = blurRenderTarget.texture;
    blurMaterial.uniforms.direction.value = halfHeightVec;
    renderer.setRenderTarget(brightRenderTarget);
    renderer.render(postScene, postCamera);

    compositeMaterial.uniforms.tBloom.value = brightRenderTarget.texture;
    compositeMaterial.uniforms.bloomStrength.value = config.bloom.strength;
  } else {
    compositeMaterial.uniforms.tBloom.value = emptyOverlayTex;
    compositeMaterial.uniforms.bloomStrength.value = 0.0;
  }

  quadMesh.material = compositeMaterial;
  compositeMaterial.uniforms.tScene.value = sceneRenderTarget.texture;
  compositeMaterial.uniforms.grainIntensity.value = reducedMotionOn ? 0.0 : config.look.grainIntensity;
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCamera);
}

function handleViewportResize() {
  const w = (container && container.clientWidth) || window.innerWidth;
  const h = (container && container.clientHeight) || window.innerHeight;
  if (w <= 0 || h <= 0) return;
  const maxPr = (config.quality && config.quality.lite) ? 1.0 : (adaptiveQualityStep >= 1 ? 1.25 : 2.0);
  const pr = Math.min(window.devicePixelRatio || 1, maxPr);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(pr);
  const targetW = Math.max(1, Math.floor(w * pr)), targetH = Math.max(1, Math.floor(h * pr));
  overlayUniforms.uResolution.value.set(targetW, targetH);
  sceneRenderTarget.setSize(targetW, targetH);
  brightRenderTarget.setSize(Math.max(1, Math.floor(targetW / 2)), Math.max(1, Math.floor(targetH / 2)));
  blurRenderTarget.setSize(Math.max(1, Math.floor(targetW / 2)), Math.max(1, Math.floor(targetH / 2)));
}

if (typeof ResizeObserver !== 'undefined' && container) {
  new ResizeObserver(() => handleViewportResize()).observe(container);
} else {
  window.addEventListener('resize', handleViewportResize);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    isTabHidden = true;
    if (soundState && soundState.initialized && masterGain) {
      try { masterGain.gain.rampTo(0.0, 0.1); } catch (e) { }
    }
  } else {
    isTabHidden = false;
    prevElapsedTime = clock.getElapsedTime();
    lastFpsTime = performance.now();
    frameCount = 0;
    syncAudioControlsUI();
    updateMasterVolume();
  }
});

function animate() {
  requestAnimationFrame(animate);
  if (isTabHidden) return;

  const now = performance.now();
  frameCount++;
  if (now - lastFpsTime >= 500) {
    currentFps = (frameCount * 1000) / Math.max(1, now - lastFpsTime);
    frameCount = 0;
    lastFpsTime = now;
    if (fpsElement && config.look.showFPS) fpsElement.textContent = `${Math.round(currentFps)} FPS`;
    if (config.quality.adaptive && !config.quality.lite && currentFps < 28) {
      lowFpsAccumSeconds += 0.5;
      if (lowFpsAccumSeconds >= 2.0 && adaptiveQualityStep < 2) {
        adaptiveQualityStep++;
        if (adaptiveQualityStep === 1) handleViewportResize();
        if (adaptiveQualityStep === 2) config.bloom.strength = 0.0;
        lowFpsAccumSeconds = 0.0;
      }
    } else {
      lowFpsAccumSeconds = 0.0;
    }
  }

  const elapsedTime = clock.getElapsedTime();
  const dt = Math.min(0.1, Math.max(0.0, elapsedTime - prevElapsedTime));
  prevElapsedTime = elapsedTime;

  const reducedMotionOn = Boolean(config.a11y && config.a11y.reducedMotion);
  const rotSpeed = reducedMotionOn ? 0.0 : config.earth.rotationSpeed;
  if (earthMesh) earthMesh.rotation.y += rotSpeed * dt;
  if (cloudsMesh) cloudsMesh.rotation.y += rotSpeed * config.clouds.speedMultiplier * dt;
  if (satRig && satRig.satMesh && satOrbitGroup && satOrbitGroup.visible) {
    const a = elapsedTime * 0.42;
    satRig.satMesh.position.set(Math.cos(a) * satRig.orbitR, Math.sin(a) * satRig.orbitR, 0);
    satRig.satMesh.lookAt(0, 0, 0);
  }

  // Update cameraRig spherical orbit & drift
  if (!cameraRig.isAnimating && !frozenAfterFilm && !reducedMotionOn) {
    cameraRig.targetLonDeg += config.camera.driftSpeed * cameraRig.driftMix * dt;
  }
  const damp = 1.0 - Math.exp(-Math.max(1.0, config.camera.damping * 140.0) * dt);
  cameraRig.lonDeg += shortestLongitudeDelta(cameraRig.lonDeg, cameraRig.targetLonDeg) * damp;
  cameraRig.latDeg += (cameraRig.targetLatDeg - cameraRig.latDeg) * damp;
  cameraRig.distance += (cameraRig.targetDistance - cameraRig.distance) * damp;

  const camLatRad = THREE.MathUtils.degToRad(cameraRig.latDeg);
  const camLonRad = THREE.MathUtils.degToRad(cameraRig.lonDeg);
  camera.position.set(
    cameraRig.distance * Math.cos(camLatRad) * Math.cos(camLonRad),
    cameraRig.distance * Math.sin(camLatRad),
    -cameraRig.distance * Math.cos(camLatRad) * Math.sin(camLonRad)
  );
  camera.lookAt(0, 0, 0);

  if (typeof tickRadarSweep === 'function') tickRadarSweep(dt);
  if (typeof tickAudioEngine === 'function') tickAudioEngine(elapsedTime);
  if (typeof update3DGlobeFloatingMarkers === 'function') update3DGlobeFloatingMarkers();
  renderCompleteFrame(elapsedTime);
}

handleViewportResize();
animate();
