// =============================================================
// 6. CAMERA RIG, 3D FLOATING GLOBE PINS, BUOYS & RAYCASTING
// =============================================================
const minDistance = 2.65, maxDistance = 16.0;
const cameraRig = {
  lonDeg: config.camera.lonDeg,
  latDeg: config.camera.latDeg,
  distance: config.camera.distance,
  targetLonDeg: config.camera.lonDeg,
  targetLatDeg: config.camera.latDeg,
  targetDistance: config.camera.distance,
  driftMix: 1.0,
  isAnimating: false
};
let frozenAfterFilm = false;
let activeFlyTween = null, activeRotationTween = null, filmTimeline = null;
const tempLocalSurfaceVec = new THREE.Vector3(), tempWorldSurfaceVec = new THREE.Vector3();

function shortestLongitudeDelta(fromLon, toLon) {
  return ((((toLon - fromLon) % 360) + 540) % 360) - 180;
}

function computeWorldSphericalForSurfaceLatLon(lat, lon) {
  earthGroup.updateMatrixWorld(true);
  earthMesh.updateMatrixWorld(true);
  const latRad = THREE.MathUtils.degToRad(lat), lonRad = THREE.MathUtils.degToRad(lon);
  tempLocalSurfaceVec.set(
    earthRadius * Math.cos(latRad) * Math.cos(lonRad),
    earthRadius * Math.sin(latRad),
    -earthRadius * Math.cos(latRad) * Math.sin(lonRad)
  );
  tempWorldSurfaceVec.copy(tempLocalSurfaceVec);
  earthMesh.localToWorld(tempWorldSurfaceVec).normalize();
  return {
    latDeg: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(tempWorldSurfaceVec.y, -1, 1))),
    lonDeg: THREE.MathUtils.radToDeg(Math.atan2(-tempWorldSurfaceVec.z, tempWorldSurfaceVec.x))
  };
}

function flyToRegion(lat = config.camera.polarLat, lon = 0, distance = config.camera.polarDistance, duration = 2.2, keepFrozenAfter = true) {
  if (activeFlyTween) activeFlyTween.kill();
  if (activeRotationTween) activeRotationTween.kill();
  activeRotationTween = gsap.to(config.earth, { rotationSpeed: 0.0, duration: 0.4, ease: 'power2.out' });

  const worldTarget = computeWorldSphericalForSurfaceLatLon(lat, lon);
  const startLon = cameraRig.lonDeg, startLat = cameraRig.latDeg, startDist = cameraRig.distance;
  const deltaLon = shortestLongitudeDelta(startLon, worldTarget.lonDeg);
  const deltaLat = worldTarget.latDeg - startLat;
  const proxy = { t: 0.0 };
  cameraRig.isAnimating = true;

  activeFlyTween = gsap.to(proxy, {
    t: 1.0,
    duration: (config.a11y && config.a11y.reducedMotion) ? 0.4 : duration,
    ease: 'power2.inOut',
    onUpdate: () => {
      const p = proxy.t;
      cameraRig.lonDeg = startLon + deltaLon * p;
      cameraRig.latDeg = THREE.MathUtils.clamp(startLat + deltaLat * p, -86, 86);
      cameraRig.distance = THREE.MathUtils.lerp(startDist, distance, p) + Math.sin(p * Math.PI) * 0.3;
      cameraRig.targetLonDeg = cameraRig.lonDeg;
      cameraRig.targetLatDeg = cameraRig.latDeg;
      cameraRig.targetDistance = cameraRig.distance;
    },
    onComplete: () => {
      cameraRig.isAnimating = false;
      if (!keepFrozenAfter) {
        gsap.to(config.earth, { rotationSpeed: config.earth.savedRotationSpeed, duration: 1.2 });
      }
    }
  });
}

function flyToPolarFraming(duration = 2.0) {
  setOverlayCloudDimming(true);
  flyToRegion(config.camera.polarLat, config.camera.polarLon, config.camera.polarDistance, duration, true);
}

const ARCTIC_REGIONS = EARTH_DOMAINS.ice.regions;

const globePinElements = [];
const pinProjVec = new THREE.Vector3();
const pinWorldNormal = new THREE.Vector3();
const pinCamDir = new THREE.Vector3();

function init3DGlobeFloatingMarkers() {
  const dom = getActiveDomain();
  globePinElements.length = 0;

  if (globeMarkersLayerEl) {
    globeMarkersLayerEl.innerHTML = '';
    const regionEntries = Object.entries(dom.regions);
    regionEntries.forEach(([key, info], idx) => {
      if (idx === 0) return; // First region is broad overview camera
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'globe-3d-pin';
      el.innerHTML = `<span class="globe-3d-pin-dot"></span><span>${info.label}</span>`;
      el.addEventListener('click', () => selectArcticLandmark(key));
      globeMarkersLayerEl.appendChild(el);
      globePinElements.push({ key, info, el });
    });
    // Re-attach active buoy badges
    for (const b of activeBuoys) {
      if (b.badgeEl) globeMarkersLayerEl.appendChild(b.badgeEl);
    }
  }

  const regionsNavEl = document.getElementById('arctic-regions-bar');
  if (regionsNavEl) {
    regionsNavEl.innerHTML = '';
    for (const [key, info] of Object.entries(dom.regions)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'region-pin-btn' + (selectedRegionKey === key ? ' active' : '');
      btn.setAttribute('data-region', key);
      btn.textContent = info.label;
      btn.addEventListener('click', () => selectArcticLandmark(key));
      regionsNavEl.appendChild(btn);
    }
  }
}

function update3DGlobeFloatingMarkers() {
  const dom = getActiveDomain();
  const w = window.innerWidth, h = window.innerHeight;
  const curYr = Math.floor(config.timeline.currentYear);

  for (const item of globePinElements) {
    const latRad = THREE.MathUtils.degToRad(item.info.lat);
    const lonRad = THREE.MathUtils.degToRad(item.info.lon);
    const r = earthRadius * 1.022;
    pinProjVec.set(
      r * Math.cos(latRad) * Math.cos(lonRad),
      r * Math.sin(latRad),
      -r * Math.cos(latRad) * Math.sin(lonRad)
    );
    earthMesh.localToWorld(pinProjVec);
    pinWorldNormal.copy(pinProjVec).normalize();
    pinCamDir.copy(camera.position).sub(pinProjVec).normalize();

    if (pinWorldNormal.dot(pinCamDir) < 0.25) {
      item.el.style.display = 'none';
      continue;
    }
    pinProjVec.project(camera);
    const sx = (pinProjVec.x * 0.5 + 0.5) * w;
    const sy = (-pinProjVec.y * 0.5 + 0.5) * h;
    item.el.style.display = 'flex';
    item.el.style.left = `${sx.toFixed(1)}px`;
    item.el.style.top = `${sy.toFixed(1)}px`;
  }

  for (const b of activeBuoys) {
    const latRad = THREE.MathUtils.degToRad(b.lat);
    const lonRad = THREE.MathUtils.degToRad(b.lon);
    const r = earthRadius * 1.026;
    pinProjVec.set(
      r * Math.cos(latRad) * Math.cos(lonRad),
      r * Math.sin(latRad),
      -r * Math.cos(latRad) * Math.sin(lonRad)
    );
    earthMesh.localToWorld(pinProjVec);
    pinWorldNormal.copy(pinProjVec).normalize();
    pinCamDir.copy(camera.position).sub(pinProjVec).normalize();

    if (pinWorldNormal.dot(pinCamDir) < 0.18) {
      b.badgeEl.style.display = 'none';
      continue;
    }
    pinProjVec.project(camera);
    const sx = (pinProjVec.x * 0.5 + 0.5) * w;
    const sy = (-pinProjVec.y * 0.5 + 0.5) * h;
    const conc = getConcentrationAt(curYr, b.lat, b.lon, config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0, dom.id);
    b.badgeEl.style.display = 'block';
    b.badgeEl.style.left = `${sx.toFixed(1)}px`;
    b.badgeEl.style.top = `${sy.toFixed(1)}px`;
    b.badgeEl.textContent = `${dom.buoyShort} #${b.id} • ${dom.formatHoverConc(conc)}`;
  }
}

async function selectArcticLandmark(key) {
  await ensureAudioStartedForInteractivePanel();
  const dom = getActiveDomain();
  selectedRegionKey = key;
  document.querySelectorAll('.region-pin-btn').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-region') === key);
  });
  const info = dom.regions[key];
  if (!info) return;
  flyToRegion(info.lat, info.lon, info.dist, 2.0, true);
  const firstKey = Object.keys(dom.regions)[0];
  if (key === firstKey) {
    if (regionStoryCardEl) regionStoryCardEl.classList.remove('visible');
  } else {
    if (regionCardTitleEl) regionCardTitleEl.textContent = info.title;
    if (regionCardDescEl) regionCardDescEl.textContent = info.desc;
    if (regionStoryCardEl) regionStoryCardEl.classList.add('visible');
  }
  updateChartUI();
  const conc = getConcentrationAt(Math.floor(config.timeline.currentYear), info.lat, info.lon, config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0, dom.id);
  playStereoIceNote(Math.max(0.25, conc), info.lon, '8n');
}

if (regionCardCloseBtn) {
  regionCardCloseBtn.addEventListener('click', () => {
    selectedRegionKey = null;
    if (regionStoryCardEl) regionStoryCardEl.classList.remove('visible');
    document.querySelectorAll('.region-pin-btn').forEach((b) => b.classList.remove('active'));
  });
}

init3DGlobeFloatingMarkers();

// 3D Globe Raycasting
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const invEarthMatrix = new THREE.Matrix4();
const localHitVec = new THREE.Vector3();
const localNormalVec = new THREE.Vector3();
let last3DGlobeNoteMs = 0;

function get3DGlobeArcticHit(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObject(earthMesh, false);
  if (!hits || hits.length === 0) return null;

  invEarthMatrix.copy(earthMesh.matrixWorld).invert();
  localHitVec.copy(hits[0].point).applyMatrix4(invEarthMatrix);
  localNormalVec.copy(localHitVec).normalize();

  const latDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(localNormalVec.y, -1, 1)));
  const lonDeg = THREE.MathUtils.radToDeg(Math.atan2(-localNormalVec.z, localNormalVec.x));
  return { latDeg, lonDeg, localPoint: localHitVec.clone(), localNormal: localNormalVec.clone() };
}

const hoverPlaceCache = new Map();
let hoverGeoTimer = null;
let lastReqKey = '';
let currentHoverLat = 0;
let currentHoverLon = 0;

function requestHoverPlaceName(latDeg, lonDeg, defaultPlace, yr, latLabel, lonLabel, statusText) {
  const gridKey = `${latDeg.toFixed(1)},${lonDeg.toFixed(1)}`;
  if (hoverPlaceCache.has(gridKey)) {
    const cached = hoverPlaceCache.get(gridKey);
    return cached || defaultPlace;
  }
  currentHoverLat = latDeg;
  currentHoverLon = lonDeg;

  if (gridKey !== lastReqKey) {
    lastReqKey = gridKey;
    if (hoverGeoTimer) clearTimeout(hoverGeoTimer);
    hoverGeoTimer = setTimeout(async () => {
      try {
        const res = await apiRequest(`/api/geocode?lat=${latDeg.toFixed(3)}&lon=${lonDeg.toFixed(3)}`);
        const place = res && res.place ? res.place : null;
        if (place) {
          hoverPlaceCache.set(gridKey, place);
          if (globeHoverPillEl && globeHoverPillEl.style.display === 'block') {
            const dLat = Math.abs(currentHoverLat - latDeg);
            const dLon = Math.abs(currentHoverLon - lonDeg);
            if (dLat < 3.0 && dLon < 3.0) {
              const curYr = (config.overlay.splitCurtainActive && (parseFloat(globeHoverPillEl.style.left) / window.innerWidth) < config.overlay.splitScreenX)
                ? 2003
                : Math.floor(config.timeline.currentYear);
              globeHoverPillEl.textContent = `${latLabel}, ${lonLabel} • ${place} (${curYr}) • ${statusText}`;
            }
          }
        }
      } catch (_) {}
    }, 150);
  }
  return defaultPlace;
}

function handle3DGlobeRaycasting(e) {
  if (config.mode.current === 'film' || activePointers.size > 0 || isDraggingCurtain) {
    if (globeHoverPillEl) globeHoverPillEl.style.display = 'none';
    return;
  }
  const dom = getActiveDomain();
  const hit = get3DGlobeArcticHit(e);
  if (!hit || hit.latDeg < dom.minHoverLat || (dom.maxHoverLat !== undefined && hit.latDeg > dom.maxHoverLat)) {
    if (globeHoverPillEl) globeHoverPillEl.style.display = 'none';
    return;
  }

  const yr = (config.overlay.splitCurtainActive && (e.clientX / window.innerWidth) < config.overlay.splitScreenX)
    ? 2003
    : Math.floor(config.timeline.currentYear);
  const conc = getConcentrationAt(yr, hit.latDeg, hit.lonDeg, config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0, dom.id);
  const seaName = getDetailedGeographicalPlace(hit.latDeg, hit.lonDeg);
  const latLabel = hit.latDeg >= 0 ? `${hit.latDeg.toFixed(1)}°N` : `${(-hit.latDeg).toFixed(1)}°S`;
  const lonLabel = hit.lonDeg >= 0 ? `${Math.round(hit.lonDeg)}°E` : `${Math.round(-hit.lonDeg)}°W`;

  const isCryoDom = dom.id === 'ice' || dom.id === 'antarctica';
  let statusText;
  if (isCryoDom) {
    const estThickMeters = conc >= 0.15 ? (0.4 + Math.pow(conc, 1.6) * 3.1).toFixed(1) + 'm pack' : 'Open ocean';
    statusText = conc >= 0.15 ? (`${dom.hoverPrefix} ${Math.round(conc * 100)}% • ${estThickMeters}`) : 'Open water';
  } else {
    statusText = `${dom.hoverPrefix} ${dom.formatHoverConc(conc)}`;
  }

  if (globeHoverPillEl) {
    const placeLabel = requestHoverPlaceName(hit.latDeg, hit.lonDeg, seaName, yr, latLabel, lonLabel, statusText);
    globeHoverPillEl.style.display = 'block';
    globeHoverPillEl.style.left = `${e.clientX}px`;
    globeHoverPillEl.style.top = `${e.clientY}px`;
    globeHoverPillEl.textContent = `${latLabel}, ${lonLabel} • ${placeLabel} (${yr}) • ${statusText}`;
  }

  const now = performance.now();
  const noteThreshold = isCryoDom ? 0.15 : 0.05;
  if (now - last3DGlobeNoteMs > 155 && conc >= noteThreshold) {
    last3DGlobeNoteMs = now;
    playStereoIceNote(conc, hit.lonDeg, '16n');
    if (!(config.a11y && config.a11y.reducedMotion)) {
      trigger3DGlobeSurfaceRipple(hit.localPoint, hit.localNormal);
    }
  }
}

function showTitleCard(heading, caption) {
  if (titleHeadingEl) titleHeadingEl.textContent = heading;
  if (titleCaptionEl) titleCaptionEl.textContent = caption;
}

function setStoryDotActive(index) {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('story-dot-' + i);
    if (el) el.classList.toggle('active', i <= index);
  }
}

function startFilmMode() {
  try {
    if (activeFlyTween) activeFlyTween.kill();
    if (filmTimeline) filmTimeline.kill();

    const dom = getActiveDomain();
    config.mode.current = 'film';
    playback.mode = 'film';
    config.timeline.playing = false;
    syncPlaybackButtonUI();

    document.body.classList.add('film-active');
    if (skipFilmBtn) skipFilmBtn.classList.add('visible');
    const cardActions = document.getElementById('title-card-actions');
    if (cardActions) cardActions.classList.remove('visible');

    const m2003 = yearMetricsMap.get(2003);
    const m2025 = yearMetricsMap.get(2025);
    const s2003 = m2003 ? dom.formatValue(m2003.iceIndexPercent) : '--';
    const s2025 = m2025 ? dom.formatValue(m2025.iceIndexPercent) : '--';
    const diffPts = (m2003 && m2025) ? dom.formatDiff(m2025.iceIndexPercent - m2003.iceIndexPercent) : '--';

    const beats = dom.storyBeats || EARTH_DOMAINS.ice.storyBeats;
    const b0 = beats[0] || { year: 2003, msg: '2003 baseline.' };
    const b1 = beats[1] || { year: 2007, msg: 'Midpoint transition.' };
    const b2 = beats[2] || { year: 2012, msg: 'Series milestone.' };
    const b3 = beats[3] || { year: 2025, msg: '2025 observation.' };

    const fmtYrVal = (yr) => {
      const m = yearMetricsMap.get(yr);
      return m ? dom.formatValue(m.iceIndexPercent) : '--';
    };

    const polarTarget = computeWorldSphericalForSurfaceLatLon(dom.framing.lat, dom.framing.lon);
    cameraRig.isAnimating = true;
    masterTimeline.scrub(b0.year);

    filmTimeline = gsap.timeline({
      onComplete: () => {
        cameraRig.isAnimating = false;
        if (cardActions) cardActions.classList.add('visible');
      }
    });

    // Beat 0: Opening baseline
    setStoryDotActive(0);
    showTitleCard(`${dom.name.toUpperCase()} (${b0.year}–${b3.year})`, `${b0.msg} (${fmtYrVal(b0.year)})`);
    filmTimeline.to(titleCardEl, { opacity: 1.0, duration: 1.3, ease: 'power2.inOut' }, 0.2);
    filmTimeline.to(titleCardEl, { opacity: 0.0, duration: 1.0, ease: 'power2.inOut' }, 4.2);

    filmTimeline.to(cameraRig, {
      lonDeg: polarTarget.lonDeg,
      latDeg: polarTarget.latDeg,
      distance: dom.framing.distance,
      duration: 5.0,
      ease: 'power2.inOut',
      onUpdate: () => {
        cameraRig.targetLonDeg = cameraRig.lonDeg;
        cameraRig.targetLatDeg = cameraRig.latDeg;
        cameraRig.targetDistance = cameraRig.distance;
      }
    }, 0.2);

    // Beat 1: Scrub to second key year and display clear title card
    const yrProxy = { y: b0.year };
    filmTimeline.to(yrProxy, {
      y: b1.year,
      duration: 4.5,
      ease: 'none',
      onUpdate: () => masterTimeline.scrub(yrProxy.y)
    }, 5.4);

    filmTimeline.call(() => {
      setStoryDotActive(1);
      showTitleCard(`${b1.year} TURNING POINT`, `${b1.msg} (${fmtYrVal(b1.year)})`);
    }, null, 6.4);
    filmTimeline.to(titleCardEl, { opacity: 1.0, duration: 0.9 }, 6.4);
    filmTimeline.to(titleCardEl, { opacity: 0.0, duration: 0.9 }, 9.8);

    // Beat 2: Scrub to milestone year (e.g., 2012 Arctic low / 2023 Antarctica crash)
    filmTimeline.to(yrProxy, {
      y: b2.year,
      duration: 5.0,
      ease: 'none',
      onUpdate: () => masterTimeline.scrub(yrProxy.y)
    }, 11.0);

    filmTimeline.call(() => {
      setStoryDotActive(2);
      showTitleCard(`MILESTONE: ${b2.year}`, `${b2.msg} (${fmtYrVal(b2.year)})`);
    }, null, 13.0);
    filmTimeline.to(titleCardEl, { opacity: 1.0, duration: 1.0 }, 13.0);
    filmTimeline.to(titleCardEl, { opacity: 0.0, duration: 1.0 }, 16.8);

    // Beat 3: Scrub to 2025 final observation
    filmTimeline.to(yrProxy, {
      y: b3.year,
      duration: 4.2,
      ease: 'none',
      onUpdate: () => masterTimeline.scrub(yrProxy.y)
    }, 18.0);

    filmTimeline.call(() => {
      setStoryDotActive(3);
      showTitleCard(`${b3.year} OBSERVATION`, `${b3.msg} (${s2025}, ${diffPts} since 2003)`);
    }, null, 22.4);
    filmTimeline.to(titleCardEl, { opacity: 1.0, duration: 1.4 }, 22.4);
  } catch (err) {
    cameraRig.isAnimating = false;
    console.warn('startFilmMode error:', err);
  }
}

function switchToExploreMode(keepRotationFrozen = true) {
  if (filmTimeline) {
    filmTimeline.kill();
    filmTimeline = null;
  }
  config.mode.current = 'explore';
  if (playback.mode === 'film') playback.mode = 'idle';
  document.body.classList.remove('film-active');
  if (skipFilmBtn) skipFilmBtn.classList.remove('visible');
  const cardActions = document.getElementById('title-card-actions');
  if (cardActions) cardActions.classList.remove('visible');
  gsap.to(titleCardEl, { opacity: 0.0, duration: 0.4 });
  cameraRig.isAnimating = false;
  frozenAfterFilm = keepRotationFrozen;
  if (keepRotationFrozen) config.earth.rotationSpeed = 0.0;
  syncPlaybackButtonUI();
}

if (skipFilmBtn) {
  skipFilmBtn.addEventListener('click', () => switchToExploreMode(true));
}

// Pointer Events Input on Globe
const activePointers = new Map();
let prevPinchDistance = 0;
let pointerDownPos = { x: 0, y: 0 };

function getPinchDistance() {
  const pts = Array.from(activePointers.values());
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

container.addEventListener('pointerdown', (e) => {
  if (config.mode.current === 'film') return;
  if (activeFlyTween) { activeFlyTween.kill(); cameraRig.isAnimating = false; }
  pointerDownPos = { x: e.clientX, y: e.clientY };
  container.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 2) prevPinchDistance = getPinchDistance();
});

container.addEventListener('pointermove', (e) => {
  if (!activePointers.has(e.pointerId)) {
    handle3DGlobeRaycasting(e);
    return;
  }
  if (config.mode.current === 'film') return;
  const prev = activePointers.get(e.pointerId);
  const curr = { x: e.clientX, y: e.clientY };
  activePointers.set(e.pointerId, curr);
  if (activePointers.size === 1) {
    cameraRig.targetLonDeg -= (curr.x - prev.x) * 0.28;
    cameraRig.targetLatDeg = THREE.MathUtils.clamp(cameraRig.targetLatDeg + (curr.y - prev.y) * 0.28, -85, 85);
  } else if (activePointers.size === 2) {
    const dist = getPinchDistance();
    if (prevPinchDistance > 0) {
      cameraRig.targetDistance = THREE.MathUtils.clamp(cameraRig.targetDistance + (prevPinchDistance - dist) * 0.015, minDistance, maxDistance);
    }
    prevPinchDistance = dist;
  }
});

async function onPointerUp(e) {
  const dom = getActiveDomain();
  const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (moveDist < 6 && config.mode.current !== 'film') {
    const hit = get3DGlobeArcticHit(e);
    if (hit && hit.latDeg >= dom.minHoverLat && (dom.maxHoverLat === undefined || hit.latDeg <= dom.maxHoverLat)) {
      if (config.overlay.buoyPlacementMode) {
        deployAcousticBuoyAt(hit.latDeg, hit.lonDeg, hit.localPoint);
      } else {
        await ensureAudioStartedForInteractivePanel();
        const yr = Math.floor(config.timeline.currentYear);
        const month = config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0;
        const conc = getConcentrationAt(yr, hit.latDeg, hit.lonDeg, month, dom.id);
        const place = getArcticSeaName(hit.latDeg, hit.lonDeg);
        const latStr = hit.latDeg >= 0 ? `${hit.latDeg.toFixed(1)}°N` : `${(-hit.latDeg).toFixed(1)}°S`;
        const lonStr = hit.lonDeg >= 0 ? `${Math.round(hit.lonDeg)}°E` : `${Math.round(-hit.lonDeg)}°W`;
        const valText = dom.formatHoverConc(conc);
        if (typeof playLocalizedProbeSequence === 'function') {
          playLocalizedProbeSequence(Math.max(0.15, conc), hit.lonDeg);
        } else {
          playStereoIceNote(Math.max(0.15, conc), hit.lonDeg, '8n');
        }
        if (!(config.a11y && config.a11y.reducedMotion)) {
          trigger3DGlobeSurfaceRipple(hit.localPoint, hit.localNormal);
        }
        const msg = `Probe: ${place} (${latStr}, ${lonStr}) • ${dom.hoverPrefix} ${valText}`;
        showOverlayBannerNote(msg);
        if (typeof speakAccessibilityDescription === 'function') {
          speakAccessibilityDescription(`${place}, ${dom.hoverPrefix} ${valText}`);
        }
      }
    }
  }
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) prevPinchDistance = 0;
}
container.addEventListener('pointerup', onPointerUp);
container.addEventListener('pointercancel', onPointerUp);
container.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (config.mode.current === 'film') return;
  cameraRig.targetDistance = THREE.MathUtils.clamp(cameraRig.targetDistance + e.deltaY * 0.003, minDistance, maxDistance);
}, { passive: false });

