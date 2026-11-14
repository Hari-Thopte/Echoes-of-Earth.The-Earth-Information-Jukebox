// =============================================================
// 1. CONFIGURATION & STATE
// =============================================================
const textureSources = {
  day: 'vendor/textures/earth-blue-marble.jpg',
  dayFallback: 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
  night: 'vendor/textures/earth-night.jpg',
  normal: 'vendor/textures/earth-normal.jpg',
  specular: 'vendor/textures/earth-specular.jpg',
  clouds: 'vendor/textures/earth-clouds.png'
};

const config = {
  story: {
    name: 'Arctic Sea Ice',
    startYear: 2003,
    endYear: 2025,
    sampleMonth: 9,
    sampleDay: 1,
    fillDays: 1,
    layersByYear: [
      { from: 2003, to: 2011, id: 'AMSRE_Sea_Ice_Concentration_12km' },
      { from: 2012, to: 2025, id: 'AMSRU2_Sea_Ice_Concentration_12km' }
    ],
    regionLat: 80.0,
    regionLon: 0.0,
    closingCaption: 'ARCTIC SEA ICE, 1 SEPTEMBER, 2003–2025',
    legendText: '15% Marginal → 100% Multi-Year Pack',
    beatsEnabled: true
  },
  overlay: {
    opacity: 0.98,
    crossfadeDuration: 0.35,
    style: 'ice',
    cloudDim: 0.14,
    edgeGlowStrength: 0.95,
    heightExtrusion: 0.026,
    show3DBaseline: true,
    showSatOrbit: true,
    buoyPlacementMode: false,
    splitCurtainActive: false,
    splitScreenX: 0.5,
    seasonalMode: false,
    seasonalMonthFloat: 9.0
  },
  film: { timelinePlaySeconds: 26.0, beatPauseSeconds: 2.0 },
  sweep: { seconds: 24.0 },
  audio: {
    style: 'Calm ambient',
    volume: 0.52,
    muted: false,
    alphaThreshold: 12,
    reverbWet: 0.38,
    droneLevel: -20,
    droneFilterFreq: 720,
    droneSwellFreq: 980,
    droneLfoRate: 0.06,
    pulseLevel: -12,
    pulseBrightness: 1400,
    minNotesPerSec: 0.45,
    maxNotesPerSec: 2.5,
    restProbability: 0.3,
    dropThresholdPercent: 3.5,
    soundKeyText: 'Higher pitch and warmer chords represent thicker Arctic sea ice'
  },
  sun: { intensity: 1.22, ambient: 0.035 },
  atmosphere: { strength: 1.25, color: '#38bdf8', power: 4.4, twilightWarmth: 0.15 },
  bloom: { strength: 0.11, radius: 0.52, threshold: 0.8 },
  clouds: { speedMultiplier: 1.25, opacity: 0.8, shadowStrength: 0.38, maskChannel: 'alpha' },
  earth: { bumpScale: 0.08, nightLightsIntensity: 2.1, rotationSpeed: 0.015, savedRotationSpeed: 0.015, tilt: 23.44, oceanShininess: 40.0, terminatorSoftness: 0.18 },
  camera: { lonDeg: 10.0, latDeg: 80.0, distance: 4.6, polarLat: 82.0, polarLon: 0.0, polarDistance: 4.6, driftSpeed: 0.3, damping: 0.07, flyDuration: 2.2, arcBoost: 1.0 },
  mode: { current: 'explore', filmDuration: 35.0 },
  timeline: { startYear: 2003, endYear: 2025, currentYear: 2003, cycleDuration: 48.0, playing: false },
  look: { grainIntensity: 0.01, sceneFade: 1.0, showFPS: false },
  a11y: { reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, captions: false },
  quality: { adaptive: true }
};

const playback = window.playback = { mode: 'idle' };

// DOM Elements
const container = document.getElementById('webgl-container');
const loadingScreen = document.getElementById('loading-screen');
const loaderBar = document.getElementById('loader-bar');
const loaderLabel = document.getElementById('loader-label');
const bgYearNumeralEl = document.getElementById('bg-year-numeral');
const liveReadoutEl = document.getElementById('live-readout');
const kpiYearValEl = document.getElementById('kpi-year-val');
const kpiIndexValEl = document.getElementById('kpi-index-val');
const kpiAnomalyValEl = document.getElementById('kpi-anomaly-val');
const kpiPackValEl = document.getElementById('kpi-pack-val');
const chartYMaxEl = document.getElementById('chart-y-max');
const chartYMinEl = document.getElementById('chart-y-min');
const chartLinePath = document.getElementById('chart-line-path');
const chartAreaPath = document.getElementById('chart-area-path');
const chartMarker = document.getElementById('chart-marker');
const iceChartSvg = document.getElementById('ice-chart-svg');
const polarInsetPanelEl = document.getElementById('polar-inset-panel');
const polarCollapseBtn = document.getElementById('polar-collapse-btn');
const polarInsetLabelEl = document.getElementById('polar-inset-label');
const polarInsetCanvas = document.getElementById('polar-inset-canvas');
const polarInsetCtx = polarInsetCanvas ? polarInsetCanvas.getContext('2d') : null;
const polarTooltipEl = document.getElementById('polar-tooltip');
const thenNowSlider = document.getElementById('then-now-slider');
const overlayDataNoteEl = document.getElementById('overlay-data-note');
const soundCaptionStripEl = document.getElementById('sound-caption-strip');
const srLiveRegionEl = document.getElementById('sr-live-region');
const tlPlayBtn = document.getElementById('tl-play-btn');
const tlScrubber = document.getElementById('tl-scrubber');
const tlYearLabel = document.getElementById('tl-year-label');
const tlMuteBtn = document.getElementById('tl-mute-btn');
const tlVolumeSlider = document.getElementById('tl-volume-slider');
const tlStyleSelect = document.getElementById('tl-style-select');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const topNavBtns = document.getElementById('top-nav-btns');
const captionsToggleBtn = document.getElementById('captions-toggle-btn');
const iceColorsBtn = document.getElementById('ice-colors-btn');
const sweepNavBtn = document.getElementById('sweep-nav-btn');
const compareSelectA = document.getElementById('compare-select-a');
const compareSelectB = document.getElementById('compare-select-b');
const compareReadoutEl = document.getElementById('compare-readout');
const fpsElement = document.getElementById('fps-counter');
const titleCardEl = document.getElementById('title-card');
const titleHeadingEl = document.getElementById('title-card-heading');
const titleCaptionEl = document.getElementById('title-card-caption');
const skipFilmBtn = document.getElementById('skip-film-btn');
const gibsHdPillEl = document.getElementById('gibs-hd-pill');
const baseline3dToggleBtn = document.getElementById('baseline-3d-toggle');
const curtain3dToggleBtn = document.getElementById('curtain-3d-toggle');
const seasonalCycleToggleBtn = document.getElementById('seasonal-cycle-toggle');
const satOrbitToggleBtn = document.getElementById('sat-orbit-toggle');
const buoyModeToggleBtn = document.getElementById('buoy-mode-toggle');
const splitCurtainUiEl = document.getElementById('split-curtain-ui');
const splitCurtainLineEl = document.getElementById('split-curtain-line');
const splitCurtainHandleEl = document.getElementById('split-curtain-handle');
const curtainRightLabelEl = document.getElementById('curtain-right-label');
const globeMarkersLayerEl = document.getElementById('globe-markers-layer');
const globeHoverPillEl = document.getElementById('globe-hover-pill');
const audioVizCanvas = document.getElementById('audio-viz-canvas');
const audioVizCtx = audioVizCanvas ? audioVizCanvas.getContext('2d') : null;
const regionStoryCardEl = document.getElementById('region-story-card');
const regionCardTitleEl = document.getElementById('region-card-title');
const regionCardDescEl = document.getElementById('region-card-desc');
const regionCardCloseBtn = document.getElementById('region-card-close');
const thickBar2003El = document.getElementById('thick-bar-2003');
const thickVal2003El = document.getElementById('thick-val-2003');
const thickLblNowEl = document.getElementById('thick-lbl-now');
const thickBarNowEl = document.getElementById('thick-bar-now');
const thickValNowEl = document.getElementById('thick-val-now');

