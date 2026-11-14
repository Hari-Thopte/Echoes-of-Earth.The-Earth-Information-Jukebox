const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 5)) {
  console.error(`Error: Earth Jukebox requires Node.js >= 22.5.0 for built-in node:sqlite support. Currently running Node ${process.version}.`);
  if (require.main === module) {
    process.exit(1);
  }
}

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { createDatabase, getLayerIdForYear, VALID_DOMAINS } = require('./db/database');

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const DEFAULT_PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_CACHE_DIR = path.join(__dirname, 'db', 'cache', 'gibs');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function buildGibsWmsUrl(yearInt, domain = 'ice', monthInt = 9, dayInt = 1, liveMode = false) {
  let layerId = getLayerIdForYear(yearInt, domain);
  if (liveMode) {
    if (domain === 'air') layerId = 'MODIS_Terra_AOD_Deep_Blue_Combined';
    else if (domain === 'greenness') layerId = 'VIIRS_SNPP_NDVI_8Day';
    else if (domain === 'temperature') layerId = 'MODIS_Terra_Land_Surface_Temp_Day';
  }
  const layer = encodeURIComponent(layerId);
  const mm = String(Math.min(12, Math.max(1, monthInt))).padStart(2, '0');
  const dd = String(Math.min(28, Math.max(1, dayInt))).padStart(2, '0');
  return (
    'https://gibs.earthdata.nasa.gov/wms/epsg4326/all/wms.cgi?CRS=EPSG:4326&FORMAT=image/png&LAYERS=' +
    layer +
    '&REQUEST=GetMap&SERVICE=WMS&STYLES=default&VERSION=1.3.0&TRANSPARENT=true&WIDTH=1024&HEIGHT=512&BBOX=-90,-180,90,180&TIME=' +
    `${yearInt}-${mm}-${dd}`
  );
}

async function defaultGibsFetcher(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    throw new Error(`NASA GIBS returned HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('image/png')) {
    throw new Error(`Unexpected GIBS content-type: ${contentType}`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON payload'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sanitizeSessionId(raw) {
  if (typeof raw !== 'string') return 'default';
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'default';
}

function hasValidAdminKey(req, expectedKey) {
  if (!expectedKey) return false;
  const headerKey = typeof req.headers['x-admin-key'] === 'string' ? req.headers['x-admin-key'] : '';
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const provided = headerKey || bearerKey;
  if (!provided || provided.length !== expectedKey.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expectedKey));
}

function createApp({
  db,
  publicDir = DEFAULT_PUBLIC_DIR,
  cacheDir = DEFAULT_CACHE_DIR,
  gibsFetcher = defaultGibsFetcher,
  adminApiKey = process.env.ADMIN_API_KEY || ''
} = {}) {
  const ownsDb = !db;
  const database = db || createDatabase();
  fs.mkdirSync(cacheDir, { recursive: true });
  const resolvedPublicDir = path.resolve(publicDir);

  async function handleApi(req, res, urlObj) {
    const { pathname, searchParams } = urlObj;
    const method = req.method || 'GET';

    // GET /api/health
    if (method === 'GET' && pathname === '/api/health') {
      const cacheStatus = database.getGibsCacheStatus();
      return sendJson(res, 200, {
        ok: true,
        database: 'sqlite',
        metricsCount: database.listMetrics().length,
        cachedGibsYears: cacheStatus.cachedCount,
        uptimeSec: Math.round(process.uptime())
      });
    }

    // GET /api/metrics?domain=...
    if (method === 'GET' && pathname === '/api/metrics') {
      const reqDomain = searchParams.get('domain') || 'ice';
      if (!VALID_DOMAINS.has(reqDomain)) {
        return sendJson(res, 400, { error: 'Unknown domain' });
      }
      const provenanceByDomain = {
        ice: { metricsType: 'nsidc_sea_ice_index_v4', note: 'NSIDC Sea Ice Index v4 September monthly mean Arctic sea ice extent (million km², 2003–2025).' },
        antarctica: { metricsType: 'nsidc_sea_ice_index_v4', note: 'NSIDC Sea Ice Index v4 September monthly mean Antarctic sea ice extent (million km², 2003–2025).' },
        temperature: { metricsType: 'nasa_gistemp_v4', note: 'NASA GISS GISTEMP v4 annual global land-ocean temperature anomaly (°C vs 1951–1980 baseline).' },
        air: { metricsType: 'nasa_modis_terra_aod_v61', note: 'NASA MODIS Terra Collection 6.1 (MOD08_M3) global annual mean Aerosol Optical Depth at 550nm (2003–2025), area-weighted across all 12 monthly grids per year.' },
        greenness: { metricsType: 'nasa_modis_terra_ndvi_v61', note: 'NASA MODIS Terra Collection 6.1 (MOD13C2) global terrestrial vegetated land annual mean NDVI (2003–2025), area-weighted across all 12 monthly grids per year.' },
        rainfall: { metricsType: 'noaa_nasa_gpcp_v23', note: 'NOAA / NASA GPCP Version 2.3 global annual mean precipitation rate (mm/day, 2003–2025) calculated from monthly NetCDF records via scripts/fetch-reference-data.py.' }
      };
      const prov = provenanceByDomain[reqDomain] || {
        metricsType: 'observational_satellite_series',
        note: 'Observational satellite telemetry and time-series derived from NASA GIBS, NSIDC, and GISS datasets.'
      };
      return sendJson(res, 200, {
        domain: reqDomain,
        dataProvenance: {
          ...prov,
          imagerySource: 'NASA GIBS WMS (Real Satellite Imagery)'
        },
        metrics: database.listMetrics(reqDomain)
      });
    }

    // PUT /api/metrics/:year?domain=...
    const metricMatch = pathname.match(/^\/api\/metrics\/(\d{4})$/);
    if (method === 'PUT' && metricMatch) {
      if (!adminApiKey) {
        return sendJson(res, 403, { error: 'Metrics writes are disabled (ADMIN_API_KEY not configured)' });
      }
      if (!hasValidAdminKey(req, adminApiKey)) {
        return sendJson(res, 401, { error: 'Unauthorized: valid X-Admin-Key required' });
      }
      const year = Number(metricMatch[1]);
      const reqDomain = searchParams.get('domain') || 'ice';
      if (!VALID_DOMAINS.has(reqDomain)) {
        return sendJson(res, 400, { error: 'Unknown domain' });
      }
      if (year < 2003 || year > 2025) {
        return sendJson(res, 400, { error: 'Year must be between 2003 and 2025' });
      }
      const body = await readJsonBody(req);
      const val = body.value !== undefined ? Number(body.value) : Number(body.iceIndexPercent);
      const minBound = reqDomain === 'temperature' ? -20 : 0;
      if (!Number.isFinite(val) || val < minBound || val > 100) {
        return sendJson(res, 400, { error: `value must be a finite number between ${minBound} and 100` });
      }
      const multiYearPackPercent = body.multiYearPackPercent !== undefined ? Number(body.multiYearPackPercent) : undefined;
      const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim().slice(0, 32) : 'nasa_gibs';
      const updated = database.updateMetric(year, { value: val, iceIndexPercent: val, multiYearPackPercent, source, domain: reqDomain });
      return sendJson(res, 200, { metric: updated });
    }

    // GET /api/regions
    if (method === 'GET' && pathname === '/api/regions') {
      return sendJson(res, 200, { regions: database.listRegions() });
    }

    // GET /api/geocode?lat=...&lon=... (reverse geocode city, state, country with in-memory cache)
    if (method === 'GET' && pathname === '/api/geocode') {
      const lat = Number(searchParams.get('lat'));
      const lon = Number(searchParams.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return sendJson(res, 400, { error: 'Valid lat (-90..90) and lon (-180..180) required' });
      }
      const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
      if (!createApp._geoCache) createApp._geoCache = new Map();
      if (createApp._geoCache.has(key)) {
        return sendJson(res, 200, { place: createApp._geoCache.get(key), cached: true });
      }
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 2000);
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&zoom=10&addressdetails=1`,
          { headers: { 'User-Agent': 'EarthJukebox/1.0', 'Accept-Language': 'en' }, signal: controller.signal }
        );
        clearTimeout(tid);
        let place = null;
        if (geoRes.ok) {
          const data = await geoRes.json();
          const addr = data && data.address;
          if (addr) {
            const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.city_district || addr.county || addr.state_district || '';
            const state = addr.state || addr.region || '';
            const country = addr.country || '';
            const parts = [city, state, country].filter((p, i, arr) => p && arr.indexOf(p) === i);
            if (parts.length > 0) place = parts.join(', ');
          }
        }
        if (!place) {
          // Robust internal gazetteer fallback
          const SERVER_CITIES = [
            { name: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.076, lon: 72.877, maxDistKm: 250 },
            { name: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.520, lon: 73.856, maxDistKm: 180 },
            { name: 'Nagpur', state: 'Maharashtra', country: 'India', lat: 21.145, lon: 79.088, maxDistKm: 200 },
            { name: 'New Delhi', state: 'Delhi', country: 'India', lat: 28.613, lon: 77.209, maxDistKm: 220 },
            { name: 'Bengaluru', state: 'Karnataka', country: 'India', lat: 12.971, lon: 77.594, maxDistKm: 220 },
            { name: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.082, lon: 80.270, maxDistKm: 200 },
            { name: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.572, lon: 88.363, maxDistKm: 220 },
            { name: 'Ahmedabad', state: 'Gujarat', country: 'India', lat: 23.022, lon: 72.571, maxDistKm: 200 },
            { name: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.385, lon: 78.486, maxDistKm: 220 },
            { name: 'New York', state: 'NY', country: 'United States', lat: 40.712, lon: -74.006, maxDistKm: 250 },
            { name: 'London', state: 'England', country: 'United Kingdom', lat: 51.507, lon: -0.127, maxDistKm: 250 },
            { name: 'Tokyo', state: 'Kanto', country: 'Japan', lat: 35.676, lon: 139.650, maxDistKm: 250 }
          ];
          for (const c of SERVER_CITIES) {
            const dLat = (c.lat - lat) * Math.PI / 180;
            const dLon = (c.lon - lon) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(c.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
            const dKm = 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            if (dKm <= c.maxDistKm) {
              place = `${c.name}, ${c.state}, ${c.country}`;
              break;
            }
          }
        }
        if (createApp._geoCache.size > 500) createApp._geoCache.clear();
        createApp._geoCache.set(key, place);
        return sendJson(res, 200, { place });
      } catch {
        return sendJson(res, 200, { place: null });
      }
    }

    // GET /api/buoys?sessionId=...&domain=...
    if (method === 'GET' && pathname === '/api/buoys') {
      const sessionId = sanitizeSessionId(searchParams.get('sessionId'));
      const domain = VALID_DOMAINS.has(searchParams.get('domain')) ? searchParams.get('domain') : 'ice';
      return sendJson(res, 200, { sessionId, domain, buoys: database.listBuoys(sessionId, domain) });
    }

    // POST /api/buoys
    if (method === 'POST' && pathname === '/api/buoys') {
      const body = await readJsonBody(req);
      const sessionId = sanitizeSessionId(body.sessionId);
      const domain = VALID_DOMAINS.has(body.domain) ? body.domain : 'ice';
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      if (domain === 'ice') {
        if (!Number.isFinite(lat) || lat < 56 || lat > 90) {
          return sendJson(res, 400, { error: 'lat must be between 56 and 90 degrees for ice domain' });
        }
      } else if (domain === 'antarctica') {
        if (!Number.isFinite(lat) || lat < -90 || lat > -50) {
          return sendJson(res, 400, { error: 'lat must be between -90 and -50 degrees for antarctica domain' });
        }
      } else if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return sendJson(res, 400, { error: 'lat must be between -90 and 90 degrees' });
      }
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        return sendJson(res, 400, { error: 'lon must be between -180 and 180 degrees' });
      }
      const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 64) : undefined;
      const { buoy, evictedIds } = database.addBuoy({ sessionId, domain, lat, lon, label, maxBuoys: 3 });
      const buoys = database.listBuoys(sessionId, domain);
      return sendJson(res, 201, { buoy, evictedIds, buoys });
    }

    // DELETE /api/buoys/:id
    const buoyMatch = pathname.match(/^\/api\/buoys\/(\d+)$/);
    if (method === 'DELETE' && buoyMatch) {
      const id = Number(buoyMatch[1]);
      const sessionId = sanitizeSessionId(searchParams.get('sessionId'));
      const deleted = database.removeBuoy(id, sessionId);
      if (!deleted) {
        return sendJson(res, 404, { error: 'Buoy not found for session' });
      }
      return sendJson(res, 200, { deleted: true, buoys: database.listBuoys(sessionId) });
    }

    // POST /api/snapshots
    if (method === 'POST' && pathname === '/api/snapshots') {
      const body = await readJsonBody(req);
      const domain = VALID_DOMAINS.has(body.domain) ? body.domain : 'ice';
      const year = Math.min(2025, Math.max(2003, Math.floor(Number(body.year) || 2003)));
      const snapshot = database.createSnapshot({
        domain,
        year,
        mode: typeof body.mode === 'string' ? body.mode.slice(0, 20) : 'explore',
        audioStyle: typeof body.audioStyle === 'string' ? body.audioStyle.slice(0, 32) : 'Calm ambient',
        regionKey: typeof body.regionKey === 'string' ? body.regionKey.slice(0, 32) : null,
        splitCurtainActive: Boolean(body.splitCurtainActive),
        splitScreenX: Number.isFinite(Number(body.splitScreenX)) ? Math.min(0.88, Math.max(0.12, Number(body.splitScreenX))) : 0.5,
        seasonalMode: Boolean(body.seasonalMode),
        seasonalMonth: Number.isFinite(Number(body.seasonalMonth)) ? Math.min(12.99, Math.max(1, Number(body.seasonalMonth))) : 9.0,
        note: typeof body.note === 'string' ? body.note.slice(0, 240) : null
      });
      return sendJson(res, 201, { snapshot, sharePath: `/?snap=${snapshot.id}#d=${snapshot.domain}&y=${snapshot.year}` });
    }

    // GET /api/snapshots/:id
    const snapMatch = pathname.match(/^\/api\/snapshots\/([a-zA-Z0-9_-]{4,32})$/);
    if (method === 'GET' && snapMatch) {
      const snapshot = database.getSnapshot(snapMatch[1]);
      if (!snapshot) {
        return sendJson(res, 404, { error: 'Snapshot not found' });
      }
      return sendJson(res, 200, { snapshot });
    }

    // GET /api/gibs/status
    if (method === 'GET' && pathname === '/api/gibs/status') {
      return sendJson(res, 200, database.getGibsCacheStatus());
    }

    // GET /api/gibs/live/:domain (near-real-time latest available day: UTC now - 3 days)
    const gibsLiveMatch = pathname.match(/^\/api\/gibs\/live\/(ice|antarctica|air|greenness|temperature|rainfall)$/);
    if (method === 'GET' && gibsLiveMatch) {
      const domain = gibsLiveMatch[1];
      const dt = new Date(Date.now() - 3 * 86400 * 1000);
      const yr = dt.getUTCFullYear();
      const mo = dt.getUTCMonth() + 1;
      const dy = Math.min(28, dt.getUTCDate());
      const dateStr = `${yr}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
      try {
        const wmsUrl = buildGibsWmsUrl(yr, domain, mo, dy, true);
        const pngBuffer = await gibsFetcher(wmsUrl, yr, domain);
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': pngBuffer.length,
          'X-GIBS-Date': dateStr,
          'Cache-Control': 'public, max-age=3600'
        });
        res.end(pngBuffer);
      } catch (err) {
        return sendJson(res, 502, { error: 'Failed to fetch live NASA GIBS imagery', detail: err.message });
      }
      return;
    }

    // GET /api/gibs/:domain/:year/:month (monthly GIBS proxy for seasonal loop)
    const gibsMonthMatch = pathname.match(/^\/api\/gibs\/(ice|antarctica|air|greenness|temperature|rainfall)\/(\d{4})\/(\d{1,2})$/);
    if (method === 'GET' && gibsMonthMatch) {
      const domain = gibsMonthMatch[1];
      const storageDomain = domain === 'antarctica' ? 'ice' : domain;
      const year = Number(gibsMonthMatch[2]);
      const month = Number(gibsMonthMatch[3]);
      if (year < 2003 || year > 2025 || month < 1 || month > 12) {
        return sendJson(res, 400, { error: 'Invalid year or month' });
      }
      const mm = String(month).padStart(2, '0');
      const sampleDate = `${year}-${mm}-01`;
      const cacheKey = `${storageDomain}:${sampleDate}`;
      const existing = database.getGibsCacheEntry(cacheKey);
      if (existing && fs.existsSync(existing.file_path)) {
        const buf = fs.readFileSync(existing.file_path);
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': buf.length, 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=86400' });
        res.end(buf);
        return;
      }
      try {
        const wmsUrl = buildGibsWmsUrl(year, domain, month, 1, false);
        const pngBuffer = await gibsFetcher(wmsUrl, year, domain);
        const filePath = path.join(cacheDir, `${storageDomain}_${year}_${mm}.png`);
        fs.writeFileSync(filePath, pngBuffer);
        database.saveGibsCacheEntry({ cacheKey, year, layerId: getLayerIdForYear(year, domain), sampleDate, filePath, byteSize: pngBuffer.length });
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': pngBuffer.length, 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=86400' });
        res.end(pngBuffer);
      } catch (err) {
        return sendJson(res, 502, { error: 'Failed to fetch monthly NASA GIBS imagery', detail: err.message });
      }
      return;
    }

    // GET /api/gibs/:year or GET /api/gibs/:domain/:year
    const gibsDomainMatch = pathname.match(/^\/api\/gibs\/(ice|antarctica|air|greenness|temperature|rainfall)\/(\d{4})$/);
    const gibsMatch = pathname.match(/^\/api\/gibs\/(\d{4})$/);
    if (method === 'GET' && (gibsDomainMatch || gibsMatch)) {
      const domain = gibsDomainMatch ? gibsDomainMatch[1] : 'ice';
      const storageDomain = domain === 'antarctica' ? 'ice' : domain;
      const year = Number(gibsDomainMatch ? gibsDomainMatch[2] : gibsMatch[1]);
      if (year < 2003 || year > 2025) {
        return sendJson(res, 400, { error: 'Year must be between 2003 and 2025' });
      }
      const sampleDate = `${year}-09-01`;
      const cacheKey = storageDomain === 'ice' ? sampleDate : `${storageDomain}:${sampleDate}`;
      const existing = database.getGibsCacheEntry(cacheKey);
      if (existing && fs.existsSync(existing.file_path)) {
        const buf = fs.readFileSync(existing.file_path);
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': buf.length,
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(buf);
        return;
      }

      try {
        const wmsUrl = buildGibsWmsUrl(year, domain);
        const pngBuffer = await gibsFetcher(wmsUrl, year, domain);
        const filePath = path.join(cacheDir, storageDomain === 'ice' ? `${year}.png` : `${storageDomain}_${year}.png`);
        fs.writeFileSync(filePath, pngBuffer);
        database.saveGibsCacheEntry({
          cacheKey,
          year,
          layerId: getLayerIdForYear(year, domain),
          sampleDate,
          filePath,
          byteSize: pngBuffer.length
        });
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': pngBuffer.length,
          'X-Cache': 'MISS',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(pngBuffer);
      } catch (err) {
        return sendJson(res, 502, {
          error: 'Failed to fetch NASA GIBS imagery',
          detail: err.message
        });
      }
      return;
    }

    return sendJson(res, 404, { error: 'API route not found' });
  }

  function serveStatic(req, res, urlObj) {
    let relPath;
    try {
      relPath = decodeURIComponent(urlObj.pathname);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Bad Request: Malformed URI encoding' }));
      return;
    }
    if (relPath === '/') {
      relPath = urlObj.searchParams.has('snap') ? '/jukebox.html' : '/index.html';
    } else if (relPath === '/jukebox') {
      relPath = '/jukebox.html';
    }
    const targetPath = path.resolve(resolvedPublicDir, '.' + relPath);

    // Prevent directory traversal outside publicDir
    if (!targetPath.startsWith(resolvedPublicDir + path.sep) && targetPath !== resolvedPublicDir) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isCode = ext === '.html' || ext === '.js' || ext === '.css';
    const stat = fs.statSync(targetPath);
    const totalSize = stat.size;

    const rangeHeader = req.headers && req.headers.range;
    if (rangeHeader && (ext === '.mp4' || ext === '.webm')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(targetPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      fileStream.pipe(res);
      return;
    }

    const data = fs.readFileSync(targetPath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': isCode ? 'no-cache, must-revalidate' : 'public, max-age=3600'
    });
    res.end(data);
  }

  const server = http.createServer(async (req, res) => {
    try {
      let urlObj;
      try {
        urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Bad Request: Malformed URL' }));
        return;
      }
      if (urlObj.pathname.startsWith('/api/')) {
        await handleApi(req, res, urlObj);
      } else {
        serveStatic(req, res, urlObj);
      }
    } catch (err) {
      const isUriError = err instanceof URIError;
      const status = isUriError ? 400 : (err.statusCode || 500);
      if (!res.headersSent) {
        sendJson(res, status, { error: isUriError ? 'Bad Request: Malformed URI sequence' : (err.message || 'Internal Server Error') });
      } else {
        res.end();
      }
    }
  });

  server.on('close', () => {
    if (ownsDb) database.close();
  });

  return { server, database };
}

if (require.main === module) {
  const { server } = createApp();
  server.listen(DEFAULT_PORT, () => {
    console.log(`Earth Jukebox server running at http://localhost:${DEFAULT_PORT}`);
  });
}

module.exports = { createApp, buildGibsWmsUrl };

