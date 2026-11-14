// =============================================================
// 3. THREE.JS SCENE & RAY-STEPPED SUBSURFACE CRYOSPHERE SHADER
// =============================================================
function createSolidTexture(r, g, b, a) {
  const data = new Uint8Array([r, g, b, a]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

const initDayTex = (typeof createProceduralEarthTexture === 'function')
  ? createProceduralEarthTexture()
  : createSolidTexture(14, 42, 78, 255);
const initNormalTex = createSolidTexture(128, 128, 255, 255);
const initNightTex = createSolidTexture(0, 0, 0, 255);
const initCloudsTex = createSolidTexture(255, 255, 255, 0);
const initSpecTex = createSolidTexture(255, 255, 255, 255); // Default ocean mask open until texture loads
const emptyOverlayTex = createSolidTexture(0, 0, 0, 0);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040a);

const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const sunPosition = new THREE.Vector3(22.0, 16.0, 18.0);
const sunDirection = sunPosition.clone().normalize();

function createStarfield() {
  const starCount = 3000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const u = Math.random(), v = Math.random();
    const theta = u * 2.0 * Math.PI, phi = Math.acos(2.0 * v - 1.0);
    const radius = 320 + Math.random() * 120;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
    const lum = 0.35 + Math.pow(Math.random(), 2.2) * 0.65;
    colors[i * 3] = 0.86 * lum;
    colors[i * 3 + 1] = 0.93 * lum;
    colors[i * 3 + 2] = 1.0 * lum;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
}
const starfield = createStarfield();
scene.add(starfield);

const earthGroup = new THREE.Group();
earthGroup.rotation.z = THREE.MathUtils.degToRad(config.earth.tilt);
scene.add(earthGroup);

const earthRadius = 2.0;
const earthGeometry = new THREE.SphereGeometry(earthRadius, 128, 128);
const earthUniforms = {
  uDayTexture: { value: initDayTex },
  uNormalMap: { value: initNormalTex },
  uNightTexture: { value: initNightTex },
  uSpecularMap: { value: initSpecTex },
  uCloudsTexture: { value: initCloudsTex },
  uSunDirection: { value: sunDirection },
  uTerminatorSoftness: { value: config.earth.terminatorSoftness },
  uSunIntensity: { value: config.sun.intensity },
  uAmbientLight: { value: config.sun.ambient },
  uNightLightsIntensity: { value: config.earth.nightLightsIntensity },
  uBumpScale: { value: config.earth.bumpScale },
  uOceanShininess: { value: config.earth.oceanShininess },
  uCloudShadowStrength: { value: config.clouds.shadowStrength },
  uCloudMaskChannel: { value: 0.0 }
};
const earthMaterial = new THREE.ShaderMaterial({
  vertexShader: EJ_SHADERS.earthVert,
  fragmentShader: EJ_SHADERS.earthFrag,
  uniforms: earthUniforms
});
const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
earthGroup.add(earthMesh);

// =============================================================
// 3B. SUBSURFACE PARALLAX CRYOSPHERE ICE CAP SHADER
//     (Dual-layer parallax ice floes, deep ocean leads, crisp
//      coastal landmask clipping, and glacier blue scattering)
// =============================================================
const overlayGeometry = new THREE.SphereGeometry(earthRadius * 1.003, 192, 192);
const overlayUniforms = {
  uOverlayTexA: { value: emptyOverlayTex },
  uOverlayTexB: { value: emptyOverlayTex },
  uBaseline2003Tex: { value: emptyOverlayTex },
  uSpecularMap: { value: initSpecTex },
  uCrossfade: { value: 0.0 },
  uOverlayOpacity: { value: config.overlay.opacity },
  uRippleBoost: { value: 0.0 },
  uEdgeGlowStrength: { value: config.overlay.edgeGlowStrength },
  uHeightExtrusion: { value: config.overlay.heightExtrusion },
  uStyleMode: { value: 0.0 },
  uDomainMode: { value: 0.0 },
  uTime: { value: 0.0 },
  uSplitCurtainActive: { value: 0.0 },
  uSplitScreenX: { value: 0.5 },
  uResolution: { value: new THREE.Vector2(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio) },
  uSunDirection: { value: sunDirection }
};

const overlayMaterial = new THREE.ShaderMaterial({
  vertexShader: EJ_SHADERS.overlayVert,
  fragmentShader: EJ_SHADERS.overlayFrag,
  uniforms: overlayUniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending
});
const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
earthMesh.add(overlayMesh);

// 3D Golden 2003 Baseline Contour Ring
function create3DBaselineRing() {
  const pts = [];
  const baseIndex = 46.2;
  const r = earthRadius * 1.008;
  for (let deg = 0; deg <= 360; deg += 2) {
    const rad = THREE.MathUtils.degToRad(deg);
    const canadianLobe = Math.exp(-Math.pow(((((deg - -105) % 360) + 540) % 360 - 180) / 48.0, 2.0)) * 4.2;
    const barentsRetreat = -Math.exp(-Math.pow(((((deg - 38) % 360) + 540) % 360 - 180) / 42.0, 2.0)) * 3.8;
    const gyreHarmonic = Math.sin(rad * 2.0 + 0.7) * 1.9 + Math.cos(rad * 3.0 - 0.5) * 1.3;
    const edgeLat = 83.2 - (baseIndex / 100.0) * 23.5 - canadianLobe - barentsRetreat + gyreHarmonic;
    const latRad = THREE.MathUtils.degToRad(edgeLat);
    pts.push(new THREE.Vector3(
      r * Math.cos(latRad) * Math.cos(rad),
      r * Math.sin(latRad),
      -r * Math.cos(latRad) * Math.sin(rad)
    ));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 }));
}
const baseline3DRing = create3DBaselineRing();
earthMesh.add(baseline3DRing);

function createSouth3DBaselineRing() {
  const pts = [];
  const baseIndex = 48.4;
  const r = earthRadius * 1.008;
  for (let deg = 0; deg <= 360; deg += 2) {
    const rad = THREE.MathUtils.degToRad(deg);
    const weddellPush = Math.exp(-Math.pow(((((deg - -42) % 360) + 540) % 360 - 180) / 40.0, 2.0)) * 3.8;
    const rossPush = Math.exp(-Math.pow(((((deg - 175) % 360) + 540) % 360 - 180) / 42.0, 2.0)) * 2.9;
    const wave = Math.sin(rad * 2.0 + 0.4) * 1.6 + Math.cos(rad * 3.0) * 1.1;
    const edgeLat = -(73.0 - (baseIndex / 100.0) * 24.0 - weddellPush - rossPush + wave);
    const latRad = THREE.MathUtils.degToRad(edgeLat);
    pts.push(new THREE.Vector3(
      r * Math.cos(latRad) * Math.cos(rad),
      r * Math.sin(latRad),
      -r * Math.cos(latRad) * Math.sin(rad)
    ));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 }));
}
const baselineSouth3DRing = createSouth3DBaselineRing();
baselineSouth3DRing.visible = false;
earthMesh.add(baselineSouth3DRing);

// 3D Polar-Orbiting Satellite Track (Aqua AMSR-E / GCOM-W1 AMSR2)
const satOrbitGroup = new THREE.Group();
satOrbitGroup.rotation.z = THREE.MathUtils.degToRad(8.2);
earthGroup.add(satOrbitGroup);

function createSatelliteOrbitRig() {
  const orbitR = earthRadius * 1.085;
  const pts = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * orbitR, Math.sin(a) * orbitR, 0));
  }
  const orbitLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
  );
  satOrbitGroup.add(orbitLine);

  const satMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x34d399 })
  );
  satOrbitGroup.add(satMesh);

  const swathCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.17, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false })
  );
  satMesh.add(swathCone);
  return { satMesh, swathCone, orbitR };
}
const satRig = createSatelliteOrbitRig();

if (satOrbitToggleBtn) {
  satOrbitToggleBtn.addEventListener('click', () => {
    config.overlay.showSatOrbit = !config.overlay.showSatOrbit;
    satOrbitGroup.visible = config.overlay.showSatOrbit;
    satOrbitToggleBtn.setAttribute('aria-pressed', String(config.overlay.showSatOrbit));
  });
}

if (baseline3dToggleBtn) {
  baseline3dToggleBtn.addEventListener('click', () => {
    const domId = getActiveDomain().id;
    config.overlay.show3DBaseline = !config.overlay.show3DBaseline;
    baseline3DRing.visible = domId === 'ice' && config.overlay.show3DBaseline;
    baselineSouth3DRing.visible = domId === 'antarctica' && config.overlay.show3DBaseline;
    baseline3dToggleBtn.setAttribute('aria-pressed', String(config.overlay.show3DBaseline));
  });
}

// 3D Split-Screen Curtain
function updateSplitCurtainPosition(normX) {
  const clamped = THREE.MathUtils.clamp(normX, 0.12, 0.88);
  config.overlay.splitScreenX = clamped;
  overlayUniforms.uSplitScreenX.value = clamped;
  const pct = (clamped * 100).toFixed(1) + '%';
  if (splitCurtainLineEl) splitCurtainLineEl.style.left = pct;
  if (splitCurtainHandleEl) {
    splitCurtainHandleEl.style.left = pct;
    splitCurtainHandleEl.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
  }
  if (curtainRightLabelEl) curtainRightLabelEl.textContent = Math.floor(config.timeline.currentYear) + ' NOW ►';
}

if (curtain3dToggleBtn) {
  curtain3dToggleBtn.addEventListener('click', () => {
    config.overlay.splitCurtainActive = !config.overlay.splitCurtainActive;
    overlayUniforms.uSplitCurtainActive.value = config.overlay.splitCurtainActive ? 1.0 : 0.0;
    curtain3dToggleBtn.setAttribute('aria-pressed', String(config.overlay.splitCurtainActive));
    if (splitCurtainUiEl) splitCurtainUiEl.classList.toggle('active', config.overlay.splitCurtainActive);
    updateSplitCurtainPosition(config.overlay.splitScreenX);
  });
}

let isDraggingCurtain = false;
if (splitCurtainHandleEl) {
  splitCurtainHandleEl.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    isDraggingCurtain = true;
    splitCurtainHandleEl.setPointerCapture(e.pointerId);
  });
  splitCurtainHandleEl.addEventListener('pointermove', (e) => {
    if (!isDraggingCurtain) return;
    updateSplitCurtainPosition(e.clientX / Math.max(1, window.innerWidth));
  });
  splitCurtainHandleEl.addEventListener('pointerup', () => { isDraggingCurtain = false; });
  splitCurtainHandleEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') updateSplitCurtainPosition(config.overlay.splitScreenX - 0.04);
    if (e.key === 'ArrowRight') updateSplitCurtainPosition(config.overlay.splitScreenX + 0.04);
  });
}

// 12-Month Seasonal Heartbeat Cycle
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const seasonalMonthRowEl = document.getElementById('seasonal-month-row');
const seasonalMonthSliderEl = document.getElementById('seasonal-month-slider');
const seasonalMonthLabelEl = document.getElementById('seasonal-month-label');

function syncSeasonalMonthSliderUI() {
  const mInt = Math.max(1, Math.min(12, Math.floor(config.overlay.seasonalMonthFloat)));
  if (seasonalMonthRowEl) seasonalMonthRowEl.style.display = config.overlay.seasonalMode ? 'flex' : 'none';
  if (seasonalMonthSliderEl) seasonalMonthSliderEl.value = String(config.overlay.seasonalMonthFloat);
  if (seasonalMonthLabelEl) seasonalMonthLabelEl.textContent = MONTH_NAMES[mInt - 1];
}

if (seasonalMonthSliderEl) {
  seasonalMonthSliderEl.addEventListener('input', () => {
    config.overlay.seasonalMode = true;
    config.timeline.playing = false;
    config.overlay.seasonalMonthFloat = Number(seasonalMonthSliderEl.value);
    syncSeasonalMonthSliderUI();
    updateOverlayForCurrentYear(true);
    interpolateSoundForTimelineYear(config.timeline.currentYear, 0.15);
    syncPlaybackButtonUI();
  });
}

if (seasonalCycleToggleBtn) {
  seasonalCycleToggleBtn.addEventListener('click', async () => {
    await ensureAudioStartedForInteractivePanel();
    config.overlay.seasonalMode = !config.overlay.seasonalMode;
    seasonalCycleToggleBtn.setAttribute('aria-pressed', String(config.overlay.seasonalMode));
    if (config.overlay.seasonalMode) {
      config.overlay.seasonalMonthFloat = 1.0;
      playback.mode = 'timeline';
      config.timeline.playing = true;
      syncPlaybackButtonUI();
      showOverlayBannerNote('Seasonal Heartbeat: scrub or loop all 12 months (Jan–Dec)');
    } else {
      config.overlay.seasonalMonthFloat = 9.0;
      updateOverlayForCurrentYear(true);
      showOverlayBannerNote('Returned to 23-year September minimum series (2003–2025)');
    }
    syncSeasonalMonthSliderUI();
  });
}

// Interactive Acoustic Sonar Buoys
const activeBuoys = [];
let nextBuoyNumber = 1;
function updateBuoyButtonLabel() {
  if (!buoyModeToggleBtn) return;
  const dom = getActiveDomain();
  buoyModeToggleBtn.textContent = config.overlay.buoyPlacementMode
    ? `Click 3D Globe to Place (${activeBuoys.length}/3)`
    : `+ Deploy ${dom.buoyNoun} (${activeBuoys.length}/3)`;
}

function clearBuoysFromScene() {
  while (activeBuoys.length > 0) {
    const b = activeBuoys.pop();
    if (b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
    if (b.badgeEl && b.badgeEl.parentNode) b.badgeEl.parentNode.removeChild(b.badgeEl);
  }
  updateBuoyButtonLabel();
}

if (buoyModeToggleBtn) {
  buoyModeToggleBtn.addEventListener('click', async () => {
    await ensureAudioStartedForInteractivePanel();
    const dom = getActiveDomain();
    config.overlay.buoyPlacementMode = !config.overlay.buoyPlacementMode;
    buoyModeToggleBtn.setAttribute('aria-pressed', String(config.overlay.buoyPlacementMode));
    updateBuoyButtonLabel();
    if (config.overlay.buoyPlacementMode) {
      const scopeHint = dom.id === 'ice'
        ? 'on the 3D Arctic Ocean (>56°N)'
        : dom.id === 'antarctica'
          ? 'on the 3D Southern Ocean (<−50°S)'
          : 'anywhere on the 3D globe';
      showOverlayBannerNote(`Click ${scopeHint} to deploy a ${dom.buoyNoun}`);
    }
  });
}

function latLonToLocalSurfacePoint(latDeg, lonDeg) {
  const latRad = THREE.MathUtils.degToRad(latDeg);
  const lonRad = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(
    earthRadius * Math.cos(latRad) * Math.cos(lonRad),
    earthRadius * Math.sin(latRad),
    -earthRadius * Math.cos(latRad) * Math.sin(lonRad)
  );
}

function addBuoyToScene({ dbId = null, buoyNumber, latDeg, lonDeg, localPoint }) {
  while (activeBuoys.length >= 3) {
    const oldest = activeBuoys.shift();
    if (oldest.mesh && oldest.mesh.parent) oldest.mesh.parent.remove(oldest.mesh);
    if (oldest.badgeEl && oldest.badgeEl.parentNode) oldest.badgeEl.parentNode.removeChild(oldest.badgeEl);
  }
  const pt = localPoint || latLonToLocalSurfacePoint(latDeg, lonDeg);
  const buoyMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.09, 12),
    new THREE.MeshBasicMaterial({ color: 0x34d399 })
  );
  buoyMesh.position.copy(pt).multiplyScalar(1.012);
  buoyMesh.lookAt(pt.clone().multiplyScalar(2.0));
  earthMesh.add(buoyMesh);

  const badgeEl = document.createElement('div');
  badgeEl.className = 'buoy-3d-badge';
  badgeEl.title = 'Click to remove buoy';
  badgeEl.textContent = `BUOY #${buoyNumber} • --%`;

  const buoyRecord = { id: buoyNumber, dbId, lat: latDeg, lon: lonDeg, mesh: buoyMesh, badgeEl };
  badgeEl.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const idx = activeBuoys.indexOf(buoyRecord);
    if (idx !== -1) {
      if (buoyRecord.mesh && buoyRecord.mesh.parent) buoyRecord.mesh.parent.remove(buoyRecord.mesh);
      if (buoyRecord.badgeEl && buoyRecord.badgeEl.parentNode) buoyRecord.badgeEl.parentNode.removeChild(buoyRecord.badgeEl);
      activeBuoys.splice(idx, 1);
      updateBuoyButtonLabel();
      if (buoyRecord.dbId) {
        const sid = window.COLLAB_ROOM_ID || CLIENT_SESSION_ID;
        apiRequest(`/api/buoys/${buoyRecord.dbId}?sessionId=${encodeURIComponent(sid)}`, { method: 'DELETE' });
      }
    }
  });
  if (globeMarkersLayerEl) globeMarkersLayerEl.appendChild(badgeEl);

  activeBuoys.push(buoyRecord);
  updateBuoyButtonLabel();
  return buoyRecord;
}

async function deployAcousticBuoyAt(latDeg, lonDeg, localPoint) {
  const dom = getActiveDomain();
  const localNum = nextBuoyNumber++;
  const record = addBuoyToScene({ dbId: null, buoyNumber: localNum, latDeg, lonDeg, localPoint });
  const conc = getConcentrationAt(Math.floor(config.timeline.currentYear), latDeg, lonDeg, config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0);
  playStereoIceNote(Math.max(0.2, conc), lonDeg, '8n');
  const placeName = getArcticSeaName(latDeg, lonDeg);
  const latStr = `${Math.abs(latDeg).toFixed(1)}°${latDeg >= 0 ? 'N' : 'S'}`;
  showOverlayBannerNote(`Deployed ${dom.buoyNoun} #${localNum} in ${placeName} (${latStr})`);

  const sid = window.COLLAB_ROOM_ID || CLIENT_SESSION_ID;
  const saved = await apiRequest('/api/buoys', {
    method: 'POST',
    body: JSON.stringify({ sessionId: sid, domain: dom.id, lat: latDeg, lon: lonDeg, label: placeName })
  });
  if (saved && saved.buoy) {
    record.dbId = saved.buoy.id;
    record.id = saved.buoy.buoyNumber;
    nextBuoyNumber = Math.max(nextBuoyNumber, saved.buoy.buoyNumber + 1);
  }
}

// 3D Expanding Surface Ripple Ring
const touchRingGeom = new THREE.RingGeometry(0.025, 0.042, 32);
const touchRingMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.0, depthWrite: false });
const touchRingMesh = new THREE.Mesh(touchRingGeom, touchRingMat);
earthMesh.add(touchRingMesh);

function trigger3DGlobeSurfaceRipple(localPoint, localNormal) {
  touchRingMesh.position.copy(localPoint).multiplyScalar(1.012);
  touchRingMesh.lookAt(localPoint.clone().add(localNormal));
  touchRingMesh.scale.set(0.6, 0.6, 0.6);
  touchRingMat.opacity = 0.85;
  gsap.killTweensOf(touchRingMesh.scale);
  gsap.killTweensOf(touchRingMat);
  gsap.to(touchRingMesh.scale, { x: 2.5, y: 2.5, z: 2.5, duration: 0.65, ease: 'power2.out' });
  gsap.to(touchRingMat, { opacity: 0.0, duration: 0.65, ease: 'power2.out' });
}

function triggerOverlayNoteRipple() {
  gsap.killTweensOf(overlayUniforms.uRippleBoost);
  overlayUniforms.uRippleBoost.value = 0.12;
  gsap.to(overlayUniforms.uRippleBoost, { value: 0.0, duration: 0.75, ease: 'power2.out' });
}

// Cloud Sphere
const cloudsGeometry = new THREE.SphereGeometry(2.022, 128, 128);
const cloudsUniforms = {
  uCloudsTexture: { value: initCloudsTex },
  uSunDirection: { value: sunDirection },
  uSunIntensity: { value: config.sun.intensity },
  uCloudOpacity: { value: config.clouds.opacity * config.overlay.cloudDim },
  uCloudMaskChannel: { value: 0.0 }
};
const cloudsMaterial = new THREE.ShaderMaterial({
  vertexShader: EJ_SHADERS.cloudsVert,
  fragmentShader: EJ_SHADERS.cloudsFrag,
  uniforms: cloudsUniforms,
  transparent: true,
  depthWrite: false
});
const cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
earthGroup.add(cloudsMesh);

function setOverlayCloudDimming(dimmed) {
  const target = dimmed ? (config.clouds.opacity * config.overlay.cloudDim) : config.clouds.opacity;
  gsap.to(cloudsUniforms.uCloudOpacity, { value: target, duration: 1.2, ease: 'power2.inOut' });
}

// Atmosphere Sphere
const atmosphereGeometry = new THREE.SphereGeometry(2.065, 128, 128);
const atmosphereUniforms = {
  uAtmosphereColor: { value: new THREE.Color(config.atmosphere.color) },
  uAtmospherePower: { value: config.atmosphere.power },
  uAtmosphereStrength: { value: config.atmosphere.strength },
  uTwilightWarmth: { value: config.atmosphere.twilightWarmth },
  uSunDirection: { value: sunDirection }
};
const atmosphereMaterial = new THREE.ShaderMaterial({
  vertexShader: EJ_SHADERS.atmosphereVert,
  fragmentShader: EJ_SHADERS.atmosphereFrag,
  uniforms: atmosphereUniforms,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false
});
const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
earthGroup.add(atmosphereMesh);

const sunLight = new THREE.DirectionalLight(0xffffff, config.sun.intensity);
sunLight.position.copy(sunPosition);
scene.add(sunLight);

function setSunHemisphere(isSouth) {
  const targetY = isSouth ? -15.0 : 16.0;
  gsap.to(sunPosition, {
    y: targetY,
    duration: 1.4,
    ease: 'power2.inOut',
    onUpdate: () => {
      sunDirection.copy(sunPosition).normalize();
      sunLight.position.copy(sunPosition);
    }
  });
}

// Post-Processing
const postScene = new THREE.Scene();
const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeometry = new THREE.PlaneGeometry(2, 2);

function createRenderTarget(w, h) {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType
  });
}
let sceneRenderTarget = createRenderTarget(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio);
let brightRenderTarget = createRenderTarget((window.innerWidth * pixelRatio) / 2, (window.innerHeight * pixelRatio) / 2);
let blurRenderTarget = createRenderTarget((window.innerWidth * pixelRatio) / 2, (window.innerHeight * pixelRatio) / 2);

const brightMaterial = new THREE.ShaderMaterial({
  vertexShader: EJ_SHADERS.brightVert,
  fragmentShader: EJ_SHADERS.brightFrag,
  uniforms: { tDiffuse: { value: null }, threshold: { value: config.bloom.threshold } },
  depthTest: false, depthWrite: false
});

const blurMaterial = new THREE.ShaderMaterial({
  vertexShader: EJ_SHADERS.blurVert,
  fragmentShader: EJ_SHADERS.blurFrag,
  uniforms: { tDiffuse: { value: null }, direction: { value: new THREE.Vector2() } },
  depthTest: false, depthWrite: false
});

const compositeMaterial = new THREE.ShaderMaterial({
  vertexShader: EJ_SHADERS.compositeVert,
  fragmentShader: EJ_SHADERS.compositeFrag,
  uniforms: {
    tScene: { value: null }, tBloom: { value: null },
    bloomStrength: { value: config.bloom.strength },
    grainIntensity: { value: config.look.grainIntensity },
    sceneFade: { value: config.look.sceneFade },
    time: { value: 0.0 }
  },
  depthTest: false, depthWrite: false
});
const quadMesh = new THREE.Mesh(quadGeometry, brightMaterial);
postScene.add(quadMesh);

