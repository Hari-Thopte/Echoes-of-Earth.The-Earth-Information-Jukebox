// =============================================================
// 5. MULTI-DOMAIN FIELD GENERATOR + SATELLITE DECODER
// =============================================================
const domainMetricsCache = new Map();
const yearMetricsMap = new Map();
const overlayCache = new Map();
const realGibsLoadedYears = new Set();
let gibsStreamerToken = 0;
let activeOverlayYear = null;
let activeOverlayTween = null;
const overlayCrossfadeProxy = { t: 0.0 };
let activeLegendDecodeMethod = 'subsurface-parallax-cryosphere-shader';

const BASELINE_ARCTIC_INDEX = EARTH_DOMAINS.ice.baselineSeries;

function seedMetricsForDomain(domainId = getActiveDomain().id) {
  const dom = EARTH_DOMAINS[domainId] || EARTH_DOMAINS.ice;
  const cached = domainMetricsCache.get(dom.id);
  const seriesObj = cached || dom.baselineSeries;
  const vals = Object.values(seriesObj);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  yearMetricsMap.clear();
  for (const [yrStr, idxVal] of Object.entries(seriesObj)) {
    const yr = Number(yrStr);
    const norm = (idxVal - minV) / Math.max(1e-5, maxV - minV);
    yearMetricsMap.set(yr, {
      rawActivity: norm,
      rawRegionalActivity: norm,
      iceIndexPercent: idxVal,
      normActivity: norm,
      normRegionalActivity: norm
    });
  }
}
seedMetricsForDomain('ice');

window.soundDebug = function () {
  const rows = [];
  for (const [yr, m] of Array.from(yearMetricsMap.entries()).sort((a, b) => a[0] - b[0])) {
    rows.push({
      domain: getActiveDomain().id,
      year: yr,
      value: Number(m.iceIndexPercent.toFixed(3)),
      normActivity: Number(m.normActivity.toFixed(3)),
      hdSatelliteLoaded: realGibsLoadedYears.has(`${getActiveDomain().id}:${yr}`)
    });
  }
  console.table(rows);
  return rows;
};

function interpolateSoundForTimelineYear(yearFloat, durationSec = 0.2) {
  const y0 = Math.floor(yearFloat);
  const y1 = Math.min(config.story.endYear, y0 + 1);
  const frac = yearFloat - y0;
  const m0 = yearMetricsMap.get(y0), m1 = yearMetricsMap.get(y1);
  if (m0 && m1) {
    let target = THREE.MathUtils.lerp(m0.normActivity, m1.normActivity, frac);
    if (config.overlay.seasonalMode) {
      const domId = getActiveDomain().id;
      const phaseMonth = domId === 'ice' ? 3.0 : (domId === 'antarctica' ? 9.0 : 7.0);
      const seasonalBoost = (Math.cos(((config.overlay.seasonalMonthFloat - phaseMonth) / 12.0) * Math.PI * 2.0) + 1.0) * 0.16;
      target = THREE.MathUtils.clamp(target + seasonalBoost, 0.05, 0.98);
    }
    gsap.to(soundState, { currentActivity: target, currentRegionalActivity: target, duration: durationSec, overwrite: 'auto' });
  }
  applySoundStyleRouting();
}

const decodedGibsGrids = new Map();

function gaussianPlume(latDeg, lonDeg, cLat, cLon, rLat, rLon) {
  const dLat = (latDeg - cLat) / rLat;
  const dLon = shortestLongitudeDelta(lonDeg, cLon) / rLon;
  return Math.exp(-(dLat * dLat + dLon * dLon));
}

function getSyntheticConcentrationAt(yearInt, latDeg, lonDeg, monthFloat = 9.0, domainId = getActiveDomain().id) {
  const m = yearMetricsMap.get(yearInt) || yearMetricsMap.get(2003);
  const normTrend = m ? m.normActivity : 0.5;
  const yrPhase = yearInt * 0.42;

  if (domainId === 'air') {
    const seasonal = Math.sin(((monthFloat - 2.0) / 12.0) * Math.PI * 2.0) * 0.08;
    const sahara = gaussianPlume(latDeg, lonDeg, 19.5, 4.0, 12.0, 26.0) * 0.68;
    const arabia = gaussianPlume(latDeg, lonDeg, 23.0, 48.0, 11.0, 18.0) * 0.52;
    const indo = gaussianPlume(latDeg, lonDeg, 26.5, 81.0, 9.5, 16.0) * 0.72;
    const china = gaussianPlume(latDeg, lonDeg, 36.0, 115.0, 11.0, 15.0) * (0.64 - Math.max(0, yearInt - 2013) * 0.015);
    const amazonSmoke = gaussianPlume(latDeg, lonDeg, -9.0, -58.0, 10.0, 15.0) * (0.34 + (yearInt >= 2019 ? 0.18 : 0.0));
    const borealSmoke = gaussianPlume(latDeg, lonDeg, 58.0, -105.0, 10.0, 24.0) * (yearInt === 2023 ? 0.48 : 0.14);
    const windWave = Math.sin(THREE.MathUtils.degToRad(lonDeg * 3.0 + yrPhase)) * 0.05;
    const base = 0.08 + normTrend * 0.14 + seasonal + windWave;
    return THREE.MathUtils.clamp(base + sahara + arabia + indo + china + amazonSmoke + borealSmoke, 0.04, 0.98);
  }

  if (domainId === 'greenness') {
    const radLon = THREE.MathUtils.degToRad(lonDeg);
    const amazon = gaussianPlume(latDeg, lonDeg, -4.0, -61.0, 13.0, 18.0) * 0.72;
    const congo = gaussianPlume(latDeg, lonDeg, 1.0, 22.0, 11.0, 15.0) * 0.68;
    const maritime = gaussianPlume(latDeg, lonDeg, 1.0, 110.0, 12.0, 20.0) * 0.64;
    const borealBoost = Math.max(0, (Math.cos(((monthFloat - 7.5) / 12.0) * Math.PI * 2.0) + 1.0) * 0.5);
    const borealBelt = Math.exp(-Math.pow((latDeg - 57.0) / 14.0, 2.0)) * (0.28 + borealBoost * 0.36);
    const temperate = Math.exp(-Math.pow((latDeg - 42.0) / 12.0, 2.0)) * (0.25 + borealBoost * 0.25);
    const saharaDry = gaussianPlume(latDeg, lonDeg, 22.0, 14.0, 10.0, 32.0) * 0.52;
    const australiaDry = gaussianPlume(latDeg, lonDeg, -24.0, 133.0, 9.0, 15.0) * 0.38;
    const arabiaDry = gaussianPlume(latDeg, lonDeg, 23.0, 46.0, 8.0, 14.0) * 0.44;
    const latEnvelope = Math.cos(THREE.MathUtils.degToRad(THREE.MathUtils.clamp(latDeg, -65, 78))) * 0.28;
    const bioWave = Math.sin(radLon * 4.0 + latDeg * 0.09) * 0.06;
    const green = latEnvelope + amazon + congo + maritime + borealBelt + temperate + bioWave + normTrend * 0.09 - saharaDry - australiaDry - arabiaDry;
    return THREE.MathUtils.clamp(green, 0.06, 0.97);
  }

  if (domainId === 'temperature') {
    const seasonalNorth = Math.cos(((monthFloat - 7.5) / 12.0) * Math.PI * 2.0) * (latDeg / 90.0) * 0.10;
    const polarAmp = Math.pow(THREE.MathUtils.clamp((latDeg - 52.0) / 38.0, 0.0, 1.0), 1.35) * (0.24 + normTrend * 0.36);
    const siberia = gaussianPlume(latDeg, lonDeg, 64.0, 102.0, 14.0, 32.0) * (0.18 + normTrend * 0.20);
    const med = gaussianPlume(latDeg, lonDeg, 41.0, 15.0, 11.0, 20.0) * (0.18 + normTrend * 0.14);
    const swUsa = gaussianPlume(latDeg, lonDeg, 35.0, -112.0, 10.0, 16.0) * (0.16 + normTrend * 0.14);
    const elNinoBoost = (yearInt === 2016 || yearInt === 2023 || yearInt === 2024 || yearInt === 2010) ? 0.28 : 0.05;
    const pacElNino = gaussianPlume(latDeg, lonDeg, 0.0, -130.0, 10.0, 42.0) * elNinoBoost;
    const warm = 0.24 + normTrend * 0.32 + polarAmp + siberia + med + swUsa + pacElNino + seasonalNorth + Math.sin(THREE.MathUtils.degToRad(lonDeg * 2.0 + yrPhase)) * 0.04;
    return THREE.MathUtils.clamp(warm, 0.08, 0.98);
  }

  if (domainId === 'rainfall') {
    const itczLat = Math.sin(((monthFloat - 3.0) / 12.0) * Math.PI * 2.0) * 11.0 + 3.0;
    const itczBand = Math.exp(-Math.pow((latDeg - itczLat) / 11.0, 2.0)) * (0.44 + normTrend * 0.16);
    const indiaMonsoon = gaussianPlume(latDeg, lonDeg, 18.0, 78.0, 10.0, 16.0) * (monthFloat >= 6 && monthFloat <= 10 ? 0.45 : 0.14);
    const maritime = gaussianPlume(latDeg, lonDeg, -1.0, 118.0, 12.0, 25.0) * 0.42;
    const amazonRain = gaussianPlume(latDeg, lonDeg, -4.0, -64.0, 12.0, 18.0) * 0.36;
    const stormTracks = Math.exp(-Math.pow((Math.abs(latDeg) - 46.0) / 9.5, 2.0)) * (0.22 + 0.10 * Math.sin(THREE.MathUtils.degToRad(lonDeg * 3.0 + yrPhase)));
    const saharaShadow = gaussianPlume(latDeg, lonDeg, 22.0, 14.0, 10.0, 32.0) * 0.42;
    const rain = itczBand + indiaMonsoon + maritime + amazonRain + stormTracks - saharaShadow;
    return THREE.MathUtils.clamp(rain, 0.04, 0.98);
  }

  if (domainId === 'antarctica') {
    let idx = extentToRenderIndex(m ? m.iceIndexPercent : 18.35, 'antarctica');
    const southWave = (Math.cos(((monthFloat - 9.0) / 12.0) * Math.PI * 2.0) - 1.0) * 0.5;
    idx += southWave * 28.0;
    const rad = THREE.MathUtils.degToRad(lonDeg);
    const weddellPush = Math.exp(-Math.pow(shortestLongitudeDelta(lonDeg, -42) / 40.0, 2.0)) * 3.8;
    const rossPush = Math.exp(-Math.pow(shortestLongitudeDelta(lonDeg, 175) / 42.0, 2.0)) * 2.9;
    const wave = Math.sin(rad * 2.0 + 0.4) * 1.6 + Math.cos(rad * 3.0 + yearInt * 0.35) * 1.1;
    const outerEdgeLat = -(73.0 - (idx / 100.0) * 24.0 - weddellPush - rossPush + wave);
    if (latDeg > outerEdgeLat) return 0.0;
    const distInside = outerEdgeLat - latDeg;
    const rawConc = 0.16 + Math.pow(THREE.MathUtils.clamp(distInside / 14.0, 0.0, 1.0), 0.58) * 0.80;
    return THREE.MathUtils.clamp(rawConc, 0.15, 0.96);
  }

  // Default: Arctic Sea Ice (2003–2025 September minimum + 12-month freeze/melt cycle)
  let idx = extentToRenderIndex(m ? m.iceIndexPercent : 4.87, 'ice');
  const seasonalWave = (Math.cos(((monthFloat - 3.0) / 12.0) * Math.PI * 2.0) + 1.0) * 0.5;
  idx += seasonalWave * 26.0;

  const rad = THREE.MathUtils.degToRad(lonDeg);
  const canadianLobe = Math.exp(-Math.pow(shortestLongitudeDelta(lonDeg, -105) / 48.0, 2.0)) * 4.2;
  const barentsRetreat = -Math.exp(-Math.pow(shortestLongitudeDelta(lonDeg, 38) / 42.0, 2.0)) * 3.8;
  const gyreHarmonic = Math.sin(rad * 2.0 + 0.7) * 1.9 + Math.cos(rad * 3.0 - 0.5) * 1.3 + Math.sin(rad * 5.0 + yearInt * 0.4) * 0.75;

  const edgeLat = 83.2 - (idx / 100.0) * 23.5 - canadianLobe - barentsRetreat + gyreHarmonic;
  if (latDeg < edgeLat) return 0.0;

  const distFromEdge = latDeg - edgeLat;
  const spanToPole = Math.max(2.5, 90.0 - edgeLat);
  const rawConc = 0.15 + Math.pow(THREE.MathUtils.clamp(distFromEdge / spanToPole, 0.0, 1.0), 0.62) * 0.83;
  return THREE.MathUtils.clamp(rawConc, 0.15, 0.98);
}

function getConcentrationAt(yearInt, latDeg, lonDeg, monthFloat = 9.0, domainId = getActiveDomain().id) {
  const key = `${domainId}:${yearInt}`;
  if (Math.abs(monthFloat - 9.0) < 0.05 && decodedGibsGrids.has(key)) {
    const grid = decodedGibsGrids.get(key);
    const y = Math.floor(((90.0 - latDeg) / 180.0) * grid.height);
    const minRow = grid.minRow || 0;
    if (y >= minRow && y < grid.maxRow) {
      const normLon = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
      const x = Math.min(grid.width - 1, Math.max(0, Math.floor(((normLon + 180.0) / 360.0) * grid.width)));
      return grid.data[(y - minRow) * grid.width + x];
    }
  }
  return getSyntheticConcentrationAt(yearInt, latDeg, lonDeg, monthFloat, domainId);
}

function buildCleanConcentrationTexture(yearInt, monthFloat = 9.0, domainId = getActiveDomain().id) {
  const isCryo = domainId === 'ice' || domainId === 'antarctica';
  const w = isCryo ? 1024 : 512;
  const h = isCryo ? 512 : 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const minRow = domainId === 'antarctica' ? Math.floor(((90.0 - (-50.0)) / 180.0) * h) : 0;
  const maxRow = domainId === 'ice' ? Math.floor(((90.0 - 52.0) / 180.0) * h) : h;
  const threshold = isCryo ? 0.14 : 0.04;
  for (let y = minRow; y < maxRow; y++) {
    const lat = 90.0 - (y / h) * 180.0;
    for (let x = 0; x < w; x++) {
      const lon = (x / w) * 360.0 - 180.0;
      const conc = getConcentrationAt(yearInt, lat, lon, monthFloat, domainId);
      if (conc >= threshold) {
        const idx = (y * w + x) * 4;
        const cByte = Math.round(conc * 255);
        data[idx] = cByte;
        data[idx + 1] = cByte;
        data[idx + 2] = 255;
        data[idx + 3] = cByte;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function startProgressiveRealGibsStreamer(domainId = getActiveDomain().id) {
  const token = ++gibsStreamerToken;
  const dom = EARTH_DOMAINS[domainId] || EARTH_DOMAINS.ice;
  let currentYr = config.story.startYear;
  const decodeCanvas = document.createElement('canvas');
  decodeCanvas.width = 1024; decodeCanvas.height = 512;
  const decodeCtx = decodeCanvas.getContext('2d', { willReadFrequently: true });

  const loadNextYear = () => {
    if (token !== gibsStreamerToken || currentYr > config.story.endYear) return;
    const yr = currentYr++;
    const cacheKey = `${domainId}:${yr}`;
    if (realGibsLoadedYears.has(cacheKey)) {
      const domainLoadedCount = Array.from(realGibsLoadedYears).filter((k) => k.startsWith(domainId + ':')).length;
      if (gibsHdPillEl) gibsHdPillEl.textContent = `${dom.shortName} HD: ${domainLoadedCount}/23 yrs`;
      setTimeout(loadNextYear, 20);
      return;
    }

    const url = buildGibsWmsUrl(yr, 0, domainId);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (token !== gibsStreamerToken) return;
      try {
        let baseTex = overlayCache.get(cacheKey);
        if (!baseTex) {
          baseTex = buildCleanConcentrationTexture(yr, 9.0, domainId);
          overlayCache.set(cacheKey, baseTex);
        }
        if (baseTex && baseTex.image) {
          const w = baseTex.image.width, h = baseTex.image.height;
          decodeCtx.clearRect(0, 0, 1024, 512);
          decodeCtx.drawImage(img, 0, 0, w, h);
          const satData = decodeCtx.getImageData(0, 0, w, h).data;

          const outCtx = baseTex.image.getContext('2d');
          const outImg = outCtx.getImageData(0, 0, w, h);
          const outData = outImg.data;

          const isCryo = domainId === 'ice' || domainId === 'antarctica';
          const isArctic = domainId === 'ice';
          const isSouth = domainId === 'antarctica';
          const minRow = isSouth ? Math.floor(((90.0 - (-50.0)) / 180.0) * h) : 0;
          const maxRow = isArctic ? Math.floor(((90.0 - 52.0) / 180.0) * h) : h;
          const gridBuf = new Float32Array((maxRow - minRow) * w);
          let satHits = 0;
          let weightedIcePolar = 0;
          let weightedTotalPolar = 0;

          for (let y = minRow; y < maxRow; y++) {
            const lat = 90.0 - (y / h) * 180.0;
            const poleHoleBlend = isArctic ? THREE.MathUtils.smoothstep(lat, 81.5, 85.5) : 0.0;
            const inPolarBand = isArctic ? lat >= 60.0 : (isSouth ? lat <= -55.0 : false);
            const cosLat = inPolarBand ? Math.cos(THREE.MathUtils.degToRad(lat)) : 0;

            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              const satConc = decodeGibsRainbowPixel(satData[idx], satData[idx + 1], satData[idx + 2], satData[idx + 3]);
              if (satConc > 0.05) satHits++;
              const synthConc = outData[idx + 3] / 255.0;
              const mergedConc = isArctic
                ? (satConc > 0.05 ? THREE.MathUtils.lerp(satConc, synthConc, poleHoleBlend) : (lat > 82.5 ? synthConc : 0.0))
                : isSouth
                  ? (satConc > 0.05 ? satConc : 0.0)
                  : (satConc > 0.05 ? THREE.MathUtils.lerp(synthConc, satConc, 0.72) : synthConc);
              const cleanConc = mergedConc >= (isCryo ? 0.14 : 0.04) ? mergedConc : 0.0;
              gridBuf[(y - minRow) * w + x] = cleanConc;

              if (isCryo && inPolarBand) {
                weightedTotalPolar += cosLat;
                if (cleanConc >= 0.15) weightedIcePolar += cosLat;
              }

              const cByte = cleanConc > 0 ? Math.round(cleanConc * 255) : 0;
              outData[idx] = cByte;
              outData[idx + 1] = cByte;
              outData[idx + 2] = 255;
              outData[idx + 3] = cByte;
            }
          }
          decodedGibsGrids.set(cacheKey, { width: w, height: h, minRow, maxRow, data: gridBuf });
          outCtx.putImageData(outImg, 0, 0);
          baseTex.needsUpdate = true;

          // Record satellite-derived pack fraction for visual overlay without corrupting observational telemetry series
          if (isCryo && satHits > 500 && weightedTotalPolar > 0) {
            const satCoveragePct = Number(((weightedIcePolar / weightedTotalPolar) * 100.0).toFixed(1));
            const existing = yearMetricsMap.get(yr) || {};
            // Preserve the NSIDC M km² telemetry value if present; otherwise map coverage to extent
            const mappedExtent = (domainId === 'ice')
              ? Number((3.57 + (satCoveragePct / 100.0) * (6.12 - 3.57)).toFixed(2))
              : Number((16.89 + (satCoveragePct / 100.0) * (19.76 - 16.89)).toFixed(2));
            const preservedVal = (existing.iceIndexPercent !== undefined && existing.iceIndexPercent !== null)
              ? existing.iceIndexPercent
              : mappedExtent;

            yearMetricsMap.set(yr, {
              ...existing,
              satCoveragePercent: satCoveragePct,
              iceIndexPercent: preservedVal
            });

            updateChartUI();
            detectAndRenderDataMoments();
            if (Math.floor(config.timeline.currentYear) === yr) {
              drawPolarStereographicInset(yr);
              interpolateSoundForTimelineYear(yr, 0.2);
            }
          }
        }
        if (satPixelsCount > 0) {
          realGibsLoadedYears.add(cacheKey);
        }
        const domainLoadedCount = Array.from(realGibsLoadedYears).filter((k) => k.startsWith(domainId + ':')).length;
        if (gibsHdPillEl) {
          gibsHdPillEl.textContent = domainLoadedCount > 0
            ? `${dom.shortName} HD: ${domainLoadedCount}/23 yrs`
            : `${dom.shortName} (Low-Res / Fallback)`;
        }
      } catch (e) {}
      setTimeout(loadNextYear, 110);
    };
    img.onerror = () => {
      if (token === gibsStreamerToken) {
        const domainLoadedCount = Array.from(realGibsLoadedYears).filter((k) => k.startsWith(domainId + ':')).length;
        if (domainLoadedCount === 0 && gibsHdPillEl) {
          gibsHdPillEl.textContent = `${dom.shortName} (Synthetic Fallback)`;
        }
      }
      setTimeout(loadNextYear, 120);
    };
    img.src = url;
  };
  loadNextYear();
}

const customCsvSeries = new Map();
function parseAndApplyCustomCsv(csvText, fileName = 'custom.csv') {
  customCsvSeries.clear();
  const lines = String(csvText || '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    showOverlayBannerNote('CSV file is empty. Expected columns: year,value (2003–2025)');
    return;
  }
  let badRows = 0;
  for (const line of lines) {
    const parts = line.trim().split(/[,;\t]+/);
    if (parts.length < 2) { badRows++; continue; }
    const yr = Number(parts[0].trim());
    const val = Number(parts[1].trim());
    if (Number.isInteger(yr) && yr >= 2003 && yr <= 2025 && Number.isFinite(val)) {
      customCsvSeries.set(yr, val);
    } else if (!/year/i.test(parts[0])) {
      badRows++;
    }
  }
  updateChartUI();
  if (customCsvSeries.size >= 2) {
    const warn = badRows > 0 ? ` (${badRows} invalid rows skipped)` : '';
    showOverlayBannerNote(`Loaded ${customCsvSeries.size} years from ${fileName}${warn}`);
  } else {
    showOverlayBannerNote('Invalid CSV columns: need ≥2 rows of "year,value" (years 2003–2025)');
  }
}

async function loadLiveGibsSnapshot(domainId = getActiveDomain().id) {
  const dom = EARTH_DOMAINS[domainId] || EARTH_DOMAINS.ice;
  if (gibsHdPillEl) gibsHdPillEl.textContent = `Fetching Live ${dom.shortName}...`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`/api/gibs/live/${domainId}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (!ctype.includes('image/png')) throw new Error('Non-PNG response from GIBS');
    const liveDate = res.headers.get('X-GIBS-Date') || 'Latest UTC';
    const blob = await res.blob();
    if (blob.size < 4096) throw new Error('Empty or low-res placeholder GIBS tile');
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const tex = buildCleanConcentrationTexture(2025, 9.0, domainId);
        const w = tex.image.width, h = tex.image.height;
        const dc = document.createElement('canvas');
        dc.width = w; dc.height = h;
        const dctx = dc.getContext('2d');
        dctx.drawImage(img, 0, 0, w, h);
        const satData = dctx.getImageData(0, 0, w, h).data;
        const outCtx = tex.image.getContext('2d');
        const outImg = outCtx.getImageData(0, 0, w, h);
        const outData = outImg.data;
        for (let i = 0; i < outData.length; i += 4) {
          const satConc = decodeGibsRainbowPixel(satData[i], satData[i + 1], satData[i + 2], satData[i + 3]);
          if (satConc > 0.05) {
            const cByte = Math.round(satConc * 255);
            outData[i] = cByte; outData[i + 1] = cByte; outData[i + 2] = 255; outData[i + 3] = cByte;
          }
        }
        outCtx.putImageData(outImg, 0, 0);
        tex.needsUpdate = true;
        crossfadeToOverlayTexture(tex, 2025);
        if (gibsHdPillEl) gibsHdPillEl.textContent = `Live ${dom.shortName}: ${liveDate}`;
        showOverlayBannerNote(`Live NASA GIBS layer loaded (${liveDate})`);
      } finally {
        URL.revokeObjectURL(objUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      const btn = document.getElementById('live-gibs-toggle');
      if (btn) btn.setAttribute('aria-pressed', 'false');
      if (gibsHdPillEl) gibsHdPillEl.textContent = `${dom.shortName} (Low-Res / Fallback)`;
      updateOverlayForCurrentYear(true);
      showOverlayBannerNote('Live GIBS image could not decode — showing cached/procedural fallback');
    };
    img.src = objUrl;
  } catch (err) {
    clearTimeout(timeoutId);
    const btn = document.getElementById('live-gibs-toggle');
    if (btn) btn.setAttribute('aria-pressed', 'false');
    if (gibsHdPillEl) gibsHdPillEl.textContent = `${dom.shortName} (Low-Res / Fallback)`;
    updateOverlayForCurrentYear(true);
    const reason = err && err.name === 'AbortError' ? 'timed out' : (err && err.message ? err.message : 'unavailable');
    showOverlayBannerNote(`Live NASA GIBS ${reason} — showing cached/procedural fallback`);
  }
}

let selectedRegionKey = null;

function updateChartUI() {
  const dom = getActiveDomain();
  const startYr = config.story.startYear, endYr = config.story.endYear;
  const curYr = Math.floor(config.timeline.currentYear);
  if (bgYearNumeralEl) {
    bgYearNumeralEl.textContent = config.overlay.seasonalMode
      ? MONTH_NAMES[Math.floor(config.overlay.seasonalMonthFloat - 1) % 12].toUpperCase()
      : String(curYr);
  }
  if (curtainRightLabelEl) curtainRightLabelEl.textContent = curYr + ' NOW ►';

  const curMetric = yearMetricsMap.get(curYr);
  const baseMetric = yearMetricsMap.get(startYr);
  if (curMetric) {
    const diff = baseMetric ? (curMetric.iceIndexPercent - baseMetric.iceIndexPercent) : 0;
    const valStr = dom.formatValue(curMetric.iceIndexPercent);
    const diffStr = dom.formatDiff(diff);
    if (liveReadoutEl) {
      liveReadoutEl.textContent = `${curYr} | ${dom.name}: ${valStr} (${diffStr} vs ${startYr})`;
    }
    if (kpiYearValEl) kpiYearValEl.textContent = String(curYr);
    if (kpiIndexValEl) kpiIndexValEl.textContent = valStr;
    if (kpiAnomalyValEl) kpiAnomalyValEl.textContent = diffStr;
    if (kpiPackValEl) kpiPackValEl.textContent = dom.formatSecondary(curMetric.normActivity);
  }

  if (selectedRegionKey && dom.regions[selectedRegionKey]) {
    const info = dom.regions[selectedRegionKey];
    const c2003Raw = getConcentrationAt(2003, info.lat, info.lon, 9.0, dom.id);
    const cNowRaw = getConcentrationAt(curYr, info.lat, info.lon, config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0, dom.id);
    if (thickBar2003El) thickBar2003El.style.width = Math.round(c2003Raw * 100) + '%';
    if (thickVal2003El) thickVal2003El.textContent = dom.formatHoverConc(c2003Raw);
    if (thickLblNowEl) thickLblNowEl.textContent = String(curYr);
    if (thickBarNowEl) thickBarNowEl.style.width = Math.round(cNowRaw * 100) + '%';
    if (thickValNowEl) thickValNowEl.textContent = dom.formatHoverConc(cNowRaw);
  }

  const entries = [];
  let minP = Infinity, maxP = -Infinity;
  for (let y = startYr; y <= endYr; y++) {
    const m = yearMetricsMap.get(y);
    if (m && Number.isFinite(m.iceIndexPercent)) {
      entries.push({ year: y, val: m.iceIndexPercent });
      if (m.iceIndexPercent < minP) minP = m.iceIndexPercent;
      if (m.iceIndexPercent > maxP) maxP = m.iceIndexPercent;
    }
  }
  if (entries.length < 2) return;
  const span = Math.max(0.02, maxP - minP);
  const yMin = minP - span * 0.15;
  const yMax = maxP + span * 0.15;
  if (chartYMaxEl) chartYMaxEl.textContent = dom.formatValue(maxP);
  if (chartYMinEl) chartYMinEl.textContent = dom.formatValue(minP);

  const w = 500, h = 34;
  let dLine = '', dArea = '';
  entries.forEach((pt, idx) => {
    const x = ((pt.year - startYr) / Math.max(1, endYr - startYr)) * w;
    const y = h - ((pt.val - yMin) / Math.max(1e-5, yMax - yMin)) * (h - 8) - 4;
    dLine += (idx === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    if (idx === 0) dArea += 'M' + x.toFixed(1) + ',' + h + ' L' + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    else dArea += 'L' + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    if (idx === entries.length - 1) dArea += 'L' + x.toFixed(1) + ',' + h + ' Z';
  });
  if (chartLinePath) {
    chartLinePath.setAttribute('d', dLine);
    chartLinePath.setAttribute('stroke', dom.accentColor);
  }
  if (chartAreaPath) chartAreaPath.setAttribute('d', dArea);

  if (chartMarker && curMetric) {
    const cx = ((config.timeline.currentYear - startYr) / Math.max(1, endYr - startYr)) * w;
    const cy = h - ((curMetric.iceIndexPercent - yMin) / Math.max(1e-5, yMax - yMin)) * (h - 8) - 4;
    chartMarker.setAttribute('cx', cx.toFixed(1));
    chartMarker.setAttribute('cy', cy.toFixed(1));
    chartMarker.setAttribute('stroke', dom.accentColor);
  }

  const customPathEl = document.getElementById('chart-custom-path');
  if (customPathEl) {
    if (customCsvSeries.size >= 2) {
      const cVals = Array.from(customCsvSeries.values());
      const cMin = Math.min(...cVals), cMax = Math.max(...cVals);
      const cSpan = Math.max(1e-5, cMax - cMin);
      let dCustom = '';
      let first = true;
      for (let y = startYr; y <= endYr; y++) {
        if (!customCsvSeries.has(y)) continue;
        const x = ((y - startYr) / Math.max(1, endYr - startYr)) * w;
        const yPos = h - ((customCsvSeries.get(y) - cMin) / cSpan) * (h - 8) - 4;
        dCustom += (first ? 'M' : 'L') + x.toFixed(1) + ',' + yPos.toFixed(1) + ' ';
        first = false;
      }
      customPathEl.setAttribute('d', dCustom);
    } else {
      customPathEl.setAttribute('d', '');
    }
  }
}

// High-DPI North Polar Stereographic / Global Radar Inset
let sweepAngleRad = 0.0;
let lastSweepSector = -1;

function domainRadarColor(domainId, t) {
  if (config.overlay.style !== 'ice') {
    const hue = Math.round((1.0 - t) * 210);
    return `hsla(${hue},92%,58%,0.88)`;
  }
  if (domainId === 'air') {
    const r = Math.round(56 + t * 195), g = Math.round(189 - t * 90), b = Math.round(248 - t * 210);
    return `rgba(${r},${g},${b},${(0.45 + t * 0.5).toFixed(2)})`;
  }
  if (domainId === 'greenness') {
    const r = Math.round(160 - t * 145), g = Math.round(120 + t * 105), b = Math.round(40 + t * 70);
    return `rgba(${r},${g},${b},${(0.50 + t * 0.45).toFixed(2)})`;
  }
  if (domainId === 'temperature') {
    const r = Math.round(45 + t * 208), g = Math.round(115 + (1 - Math.abs(t - 0.5) * 2) * 80), b = Math.round(235 - t * 140);
    return `rgba(${r},${g},${b},${(0.55 + t * 0.42).toFixed(2)})`;
  }
  if (domainId === 'rainfall') {
    const r = Math.round(35 + t * 165), g = Math.round(85 + (1 - t * 0.35) * 115), b = Math.round(180 + t * 75);
    return `rgba(${r},${g},${b},${(0.45 + t * 0.5).toFixed(2)})`;
  }
  const red = Math.round(70 + t * 180);
  const grn = Math.round(165 + t * 88);
  return `rgba(${red},${grn},255,${(0.55 + t * 0.42).toFixed(2)})`;
}

function drawPolarStereographicInset(yearInt) {
  if (!polarInsetCtx || !polarInsetCanvas) return;
  try {
    const dom = getActiveDomain();
    const w = polarInsetCanvas.width, h = polarInsetCanvas.height;
    const cx = w / 2, cy = h / 2, maxR = w * 0.46;
    polarInsetCtx.clearRect(0, 0, w, h);

    const oceanGrad = polarInsetCtx.createRadialGradient(cx, cy, 4, cx, cy, maxR);
    oceanGrad.addColorStop(0, '#071936');
    oceanGrad.addColorStop(1, '#030b1a');
    polarInsetCtx.fillStyle = oceanGrad;
    polarInsetCtx.beginPath();
    polarInsetCtx.arc(cx, cy, maxR, 0, Math.PI * 2);
    polarInsetCtx.fill();

    const splitPct = thenNowSlider ? Number(thenNowSlider.value) / 100 : 0;
    const splitX = splitPct * w;
    const monthVal = config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0;

    if (dom.mapMode === 'global') {
      polarInsetCtx.save();
      polarInsetCtx.beginPath();
      polarInsetCtx.arc(cx, cy, maxR, 0, Math.PI * 2);
      polarInsetCtx.clip();

      for (let py = 6; py < h - 6; py += 3) {
        const lat = 85.0 - ((py - (cy - maxR)) / (maxR * 2)) * 170.0;
        if (lat > 86 || lat < -86) continue;
        for (let px = 6; px < w - 6; px += 3) {
          if (Math.hypot(px - cx, py - cy) > maxR) continue;
          const lon = ((px - (cx - maxR)) / (maxR * 2)) * 360.0 - 180.0;
          const useYear = px < splitX ? config.story.startYear : yearInt;
          const conc = getConcentrationAt(useYear, lat, lon, monthVal, dom.id);
          if (conc >= 0.08) {
            polarInsetCtx.fillStyle = domainRadarColor(dom.id, THREE.MathUtils.clamp(conc, 0, 1));
            polarInsetCtx.fillRect(px, py, 3, 3);
          }
        }
      }

      polarInsetCtx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      polarInsetCtx.lineWidth = 1;
      polarInsetCtx.beginPath();
      polarInsetCtx.moveTo(cx - maxR, cy); polarInsetCtx.lineTo(cx + maxR, cy);
      polarInsetCtx.moveTo(cx, cy - maxR); polarInsetCtx.lineTo(cx, cy + maxR);
      polarInsetCtx.stroke();
      polarInsetCtx.restore();
    } else if (dom.mapMode === 'south_polar') {
      for (let py = 4; py < h - 4; py += 2) {
        for (let px = 4; px < w - 4; px += 2) {
          const dx = px - cx, dy = py - cy;
          const r = Math.hypot(dx, dy);
          if (r > maxR) continue;
          const lat = -90.0 + (r / maxR) * 35.0;
          if (lat > -52.0 || lat < -76.0) continue;
          const lon = THREE.MathUtils.radToDeg(Math.atan2(dy, dx));
          const useYear = px < splitX ? config.story.startYear : yearInt;
          const conc = getConcentrationAt(useYear, lat, lon, monthVal, 'antarctica');
          if (conc >= 0.15) {
            const t = (conc - 0.15) / 0.85;
            polarInsetCtx.fillStyle = domainRadarColor('ice', t);
            polarInsetCtx.fillRect(px, py, 2, 2);
          }
        }
      }

      polarInsetCtx.save();
      polarInsetCtx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      polarInsetCtx.lineWidth = 1;
      [15, 25].forEach((degFromPole) => {
        polarInsetCtx.beginPath();
        polarInsetCtx.arc(cx, cy, (degFromPole / 35.0) * maxR, 0, Math.PI * 2);
        polarInsetCtx.stroke();
      });
      polarInsetCtx.beginPath();
      polarInsetCtx.moveTo(cx - maxR, cy); polarInsetCtx.lineTo(cx + maxR, cy);
      polarInsetCtx.moveTo(cx, cy - maxR); polarInsetCtx.lineTo(cx, cy + maxR);
      polarInsetCtx.stroke();
      polarInsetCtx.restore();

      polarInsetCtx.save();
      polarInsetCtx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
      polarInsetCtx.lineWidth = 1.5;
      polarInsetCtx.setLineDash([4, 3]);
      polarInsetCtx.beginPath();
      const rawBase = (yearMetricsMap.get(config.story.startYear) || { iceIndexPercent: 18.35 }).iceIndexPercent;
      const baseIdx = extentToRenderIndex(rawBase, 'antarctica');
      for (let deg = 0; deg <= 360; deg += 3) {
        const rad = THREE.MathUtils.degToRad(deg);
        const weddellPush = Math.exp(-Math.pow(shortestLongitudeDelta(deg, -42) / 40.0, 2.0)) * 3.8;
        const rossPush = Math.exp(-Math.pow(shortestLongitudeDelta(deg, 175) / 42.0, 2.0)) * 2.9;
        const wave = Math.sin(rad * 2.0 + 0.4) * 1.6 + Math.cos(rad * 3.0) * 1.1;
        const edgeLat = -(73.0 - (baseIdx / 100.0) * 24.0 - weddellPush - rossPush + wave);
        const r = ((90.0 + edgeLat) / 35.0) * maxR;
        const x = cx + Math.cos(rad) * r, y = cy + Math.sin(rad) * r;
        if (deg === 0) polarInsetCtx.moveTo(x, y);
        else polarInsetCtx.lineTo(x, y);
      }
      polarInsetCtx.stroke();
      polarInsetCtx.restore();
    } else {
      for (let py = 4; py < h - 4; py += 2) {
        for (let px = 4; px < w - 4; px += 2) {
          const dx = px - cx, dy = py - cy;
          const r = Math.hypot(dx, dy);
          if (r > maxR) continue;
          const lat = 90.0 - (r / maxR) * 30.0;
          const lon = THREE.MathUtils.radToDeg(Math.atan2(dy, dx));
          const useYear = px < splitX ? config.story.startYear : yearInt;
          const conc = getConcentrationAt(useYear, lat, lon, monthVal, 'ice');
          if (conc >= 0.15) {
            const t = (conc - 0.15) / 0.85;
            polarInsetCtx.fillStyle = domainRadarColor('ice', t);
            polarInsetCtx.fillRect(px, py, 2, 2);
          }
        }
      }

      polarInsetCtx.save();
      polarInsetCtx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      polarInsetCtx.lineWidth = 1;
      [10, 20].forEach((degFromPole) => {
        polarInsetCtx.beginPath();
        polarInsetCtx.arc(cx, cy, (degFromPole / 30.0) * maxR, 0, Math.PI * 2);
        polarInsetCtx.stroke();
      });
      polarInsetCtx.beginPath();
      polarInsetCtx.moveTo(cx - maxR, cy); polarInsetCtx.lineTo(cx + maxR, cy);
      polarInsetCtx.moveTo(cx, cy - maxR); polarInsetCtx.lineTo(cx, cy + maxR);
      polarInsetCtx.stroke();
      polarInsetCtx.restore();

      polarInsetCtx.save();
      polarInsetCtx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
      polarInsetCtx.lineWidth = 1.5;
      polarInsetCtx.setLineDash([4, 3]);
      polarInsetCtx.beginPath();
      const rawBase = (yearMetricsMap.get(config.story.startYear) || { iceIndexPercent: 6.12 }).iceIndexPercent;
      const baseIdx = extentToRenderIndex(rawBase, 'ice');
      for (let deg = 0; deg <= 360; deg += 3) {
        const rad = THREE.MathUtils.degToRad(deg);
        const canadianLobe = Math.exp(-Math.pow(shortestLongitudeDelta(deg, -105) / 48.0, 2.0)) * 4.2;
        const barentsRetreat = -Math.exp(-Math.pow(shortestLongitudeDelta(deg, 38) / 42.0, 2.0)) * 3.8;
        const gyreHarmonic = Math.sin(rad * 2.0 + 0.7) * 1.9 + Math.cos(rad * 3.0 - 0.5) * 1.3;
        const edgeLat = 83.2 - (baseIdx / 100.0) * 23.5 - canadianLobe - barentsRetreat + gyreHarmonic;
        const r = ((90.0 - edgeLat) / 30.0) * maxR;
        const x = cx + Math.cos(rad) * r, y = cy + Math.sin(rad) * r;
        if (deg === 0) polarInsetCtx.moveTo(x, y);
        else polarInsetCtx.lineTo(x, y);
      }
      polarInsetCtx.stroke();
      polarInsetCtx.restore();
    }

    if (splitPct > 0.01) {
      polarInsetCtx.strokeStyle = dom.accentColor;
      polarInsetCtx.lineWidth = 1.6;
      polarInsetCtx.beginPath();
      polarInsetCtx.moveTo(splitX, cy - maxR);
      polarInsetCtx.lineTo(splitX, cy + maxR);
      polarInsetCtx.stroke();
    }

    if (playback.mode === 'sweep') {
      polarInsetCtx.save();
      polarInsetCtx.strokeStyle = dom.accentColor;
      polarInsetCtx.lineWidth = 2.2;
      polarInsetCtx.beginPath();
      polarInsetCtx.moveTo(cx, cy);
      polarInsetCtx.lineTo(cx + Math.cos(sweepAngleRad) * maxR, cy + Math.sin(sweepAngleRad) * maxR);
      polarInsetCtx.stroke();
      polarInsetCtx.restore();
    }

    if (polarInsetLabelEl) {
      polarInsetLabelEl.textContent = `${dom.radarTitlePrefix}, ${yearInt}`;
    }
  } catch (err) {
    console.warn('drawPolarStereographicInset warning:', err);
  }
}

if (thenNowSlider) {
  thenNowSlider.addEventListener('input', () => {
    drawPolarStereographicInset(Math.floor(config.timeline.currentYear));
  });
}

let lastTouchIceNoteMs = 0;
if (polarInsetCanvas) {
  polarInsetCanvas.addEventListener('pointermove', async (e) => {
    const dom = getActiveDomain();
    const rect = polarInsetCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * polarInsetCanvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * polarInsetCanvas.height;
    const cx = polarInsetCanvas.width / 2, cy = polarInsetCanvas.height / 2, maxR = polarInsetCanvas.width * 0.46;
    const r = Math.hypot(x - cx, y - cy);
    if (r > maxR) {
      if (polarTooltipEl) polarTooltipEl.style.display = 'none';
      return;
    }
    const lat = dom.mapMode === 'global'
      ? Math.round(85.0 - ((y - (cy - maxR)) / (maxR * 2)) * 170.0)
      : dom.mapMode === 'south_polar'
        ? Math.round(-90.0 + (r / maxR) * 35.0)
        : Math.round(90.0 - (r / maxR) * 30.0);
    const lon = dom.mapMode === 'global'
      ? ((x - (cx - maxR)) / (maxR * 2)) * 360.0 - 180.0
      : THREE.MathUtils.radToDeg(Math.atan2(y - cy, x - cx));

    const conc = getConcentrationAt(Math.floor(config.timeline.currentYear), lat, lon, config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0, dom.id);
    const seaName = getArcticSeaName(lat, lon);
    const latStr = `${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}`;
    if (polarTooltipEl) {
      polarTooltipEl.style.display = 'block';
      polarTooltipEl.textContent = `${latStr} • ${seaName} • ${dom.formatHoverConc(conc)}`;
    }
    const now = performance.now();
    const isCryoDom = dom.id === 'ice' || dom.id === 'antarctica';
    if (now - lastTouchIceNoteMs > 130 && conc >= (isCryoDom ? 0.15 : 0.05)) {
      lastTouchIceNoteMs = now;
      playStereoIceNote(conc, lon, '16n');
    }
  });
  polarInsetCanvas.addEventListener('pointerleave', () => {
    if (polarTooltipEl) polarTooltipEl.style.display = 'none';
  });
}

// Radar Sweep Mode
function startRadarSweep() {
  const dom = getActiveDomain();
  playback.mode = 'sweep';
  sweepAngleRad = 0.0;
  lastSweepSector = -1;
  if (sweepNavBtn) sweepNavBtn.setAttribute('aria-pressed', 'true');
  showOverlayBannerNote(`Radar Sweep active: scanning ${dom.name} across longitudes...`);
}

function stopRadarSweep() {
  if (playback.mode === 'sweep') playback.mode = 'idle';
  if (sweepNavBtn) sweepNavBtn.setAttribute('aria-pressed', 'false');
  if (overlayDataNoteEl) overlayDataNoteEl.style.display = 'none';
  drawPolarStereographicInset(Math.floor(config.timeline.currentYear));
}

function tickRadarSweep(deltaSeconds) {
  if (playback.mode !== 'sweep') return;
  const dom = getActiveDomain();
  const rate = (Math.PI * 2) / Math.max(4, config.sweep.seconds);
  sweepAngleRad = (sweepAngleRad + deltaSeconds * rate) % (Math.PI * 2);
  const deg = Math.floor(THREE.MathUtils.radToDeg(sweepAngleRad));
  const sector = Math.floor(deg / 15);
  const yr = Math.floor(config.timeline.currentYear);
  if (sector !== lastSweepSector) {
    lastSweepSector = sector;
    const sweepLon = deg - 180;
    const sweepLat = dom.mapMode === 'polar' ? 76 : (dom.mapMode === 'south_polar' ? -65 : dom.framing.lat);
    const conc = getConcentrationAt(yr, sweepLat, sweepLon, config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0, dom.id);
    const placeName = getArcticSeaName(sweepLat, sweepLon);
    showOverlayBannerNote(`Sweeping ${placeName} (${sweepLon}°): ${dom.hoverPrefix} ${dom.formatHoverConc(conc)}`);
    playStereoIceNote(Math.max(0.18, conc), sweepLon, '8n');
  }
  drawPolarStereographicInset(yr);
}

if (sweepNavBtn) {
  sweepNavBtn.addEventListener('click', async () => {
    await ensureAudioStartedForInteractivePanel();
    if (playback.mode === 'sweep') stopRadarSweep();
    else startRadarSweep();
  });
}

let bannerTimeout = null;
function showOverlayBannerNote(text) {
  if (overlayDataNoteEl) {
    overlayDataNoteEl.textContent = text;
    overlayDataNoteEl.style.display = 'block';
    if (bannerTimeout) clearTimeout(bannerTimeout);
    bannerTimeout = setTimeout(() => {
      overlayDataNoteEl.style.display = 'none';
    }, 4200);
  }
}

function crossfadeToOverlayTexture(newTex, yearInt) {
  interpolateSoundForTimelineYear(yearInt, config.overlay.crossfadeDuration);
  if (overlayCrossfadeProxy.t > 0.5 && overlayUniforms.uOverlayTexB.value) {
    overlayUniforms.uOverlayTexA.value = overlayUniforms.uOverlayTexB.value;
  }
  overlayUniforms.uOverlayTexB.value = newTex;
  overlayCrossfadeProxy.t = 0.0;
  if (activeOverlayTween) activeOverlayTween.kill();
  activeOverlayTween = gsap.to(overlayCrossfadeProxy, {
    t: 1.0,
    duration: config.overlay.crossfadeDuration,
    ease: 'power2.inOut',
    onUpdate: () => { overlayUniforms.uCrossfade.value = overlayCrossfadeProxy.t; },
    onComplete: () => { overlayUniforms.uOverlayTexA.value = newTex; overlayUniforms.uCrossfade.value = 1.0; }
  });
}

function updateOverlayForCurrentYear(forceReload = false) {
  const dom = getActiveDomain();
  const yearInt = Math.floor(config.timeline.currentYear);
  const monthKey = config.overlay.seasonalMode ? ('_m' + Math.round(config.overlay.seasonalMonthFloat)) : '';
  const cacheKey = `${dom.id}:${yearInt}${monthKey}`;
  const baseKey = `${dom.id}:2003`;

  if (!overlayCache.has(baseKey)) {
    overlayCache.set(baseKey, buildCleanConcentrationTexture(2003, 9.0, dom.id));
  }
  overlayUniforms.uBaseline2003Tex.value = overlayCache.get(baseKey);

  if (!forceReload && cacheKey === activeOverlayYear) return;
  activeOverlayYear = cacheKey;

  if (!overlayCache.has(cacheKey)) {
    overlayCache.set(cacheKey, buildCleanConcentrationTexture(yearInt, config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0, dom.id));
  }
  crossfadeToOverlayTexture(overlayCache.get(cacheKey), yearInt);
  updateChartUI();
  drawPolarStereographicInset(yearInt);

  if (srLiveRegionEl) {
    const m = yearMetricsMap.get(yearInt);
    if (m) srLiveRegionEl.textContent = `${yearInt}: ${dom.name} ${dom.formatValue(m.iceIndexPercent)}`;
  }
}

function startBackgroundMetricsPreload() {
  updateChartUI();
  drawPolarStereographicInset(Math.floor(config.timeline.currentYear));
  detectAndRenderDataMoments();
  startProgressiveRealGibsStreamer(getActiveDomain().id);
}

// Data-Detected Moments & 20s Highlights Tour
const momentLowBtn = document.getElementById('moment-low-btn');
const momentDropBtn = document.getElementById('moment-drop-btn');
const momentReboundBtn = document.getElementById('moment-rebound-btn');
const momentTourBtn = document.getElementById('moment-tour-btn');
let highlightsTourTimer = null;

function detectAndRenderDataMoments() {
  const dom = getActiveDomain();
  const series = [];
  for (const [yr, m] of yearMetricsMap.entries()) {
    if (m && Number.isFinite(m.iceIndexPercent)) series.push({ year: Number(yr), val: m.iceIndexPercent });
  }
  const stats = detectMoments(series);
  if (!stats || stats.minYear === null) return;

  let maxYear = series[0].year, maxVal = series[0].val;
  for (const s of series) { if (s.val > maxVal) { maxVal = s.val; maxYear = s.year; } }

  if (momentLowBtn) {
    const isExtremesPeak = dom.id === 'air' || dom.id === 'temperature' || dom.id === 'rainfall';
    const targetYr = isExtremesPeak ? maxYear : stats.minYear;
    const targetVal = isExtremesPeak ? maxVal : stats.minVal;
    momentLowBtn.textContent = (isExtremesPeak ? 'Peak high: ' : 'Record low: ') + targetYr;
    momentLowBtn.onclick = () => {
      masterTimeline.pause();
      masterTimeline.scrub(targetYr);
      showOverlayBannerNote(`${targetYr}: Series extreme (${dom.formatValue(targetVal)})`);
    };
  }
  if (momentDropBtn && stats.maxDropYear) {
    momentDropBtn.textContent = 'Steepest drop: ' + stats.maxDropYear;
    momentDropBtn.onclick = () => {
      masterTimeline.pause();
      masterTimeline.scrub(stats.maxDropYear);
      showOverlayBannerNote(`${stats.maxDropYear}: Largest 1-yr drop (${dom.formatDiff(stats.maxDrop)} vs ${stats.maxDropYear - 1})`);
    };
  }
  if (momentReboundBtn && stats.maxReboundYear) {
    momentReboundBtn.textContent = 'Sharpest rise: ' + stats.maxReboundYear;
    momentReboundBtn.onclick = () => {
      masterTimeline.pause();
      masterTimeline.scrub(stats.maxReboundYear);
      showOverlayBannerNote(`${stats.maxReboundYear}: Largest 1-yr surge (${dom.formatDiff(stats.maxRebound)} vs ${stats.maxReboundYear - 1})`);
    };
  }
  if (momentTourBtn) {
    momentTourBtn.onclick = async () => {
      await ensureAudioStartedForInteractivePanel();
      if (highlightsTourTimer) clearInterval(highlightsTourTimer);
      const stops = [
        { y: config.story.startYear, msg: `${config.story.startYear}: Starting baseline` },
        { y: stats.maxDropYear || 2007, msg: `${stats.maxDropYear || 2007}: Steepest 1-year shift` },
        { y: stats.minYear || 2012, msg: `${stats.minYear || 2012}: Series turning point` },
        { y: config.story.endYear, msg: `${config.story.endYear}: Latest observation` }
      ];
      let idx = 0;
      playback.mode = 'preview';
      const runStep = () => {
        if (idx >= stops.length) {
          clearInterval(highlightsTourTimer);
          playback.mode = 'idle';
          return;
        }
        masterTimeline.scrub(stops[idx].y);
        showOverlayBannerNote(stops[idx].msg);
        idx++;
      };
      runStep();
      highlightsTourTimer = setInterval(runStep, 4500);
    };
  }
}

