const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_DB_PATH = path.join(__dirname, 'earth_jukebox.db');

// Annual observational datasets:
// - ice: NSIDC Sea Ice Index v4, September monthly mean Arctic sea ice extent (million km²)
// - temperature: NASA GISS GISTEMP v4 annual global land-ocean temperature anomaly (°C vs 1951–1980)
// - antarctica: NSIDC Sea Ice Index v4, September monthly mean Antarctic sea ice extent (million km²)
// - air: NASA MODIS Terra Collection 6.1 (MOD08_M3) global annual mean Aerosol Optical Depth at 550nm
// - greenness: NASA MODIS Terra Collection 6.1 (MOD13C2) global terrestrial vegetated land annual mean NDVI
// - rainfall: NOAA / NASA GPCP Version 2.3 global annual mean precipitation rate (mm/day)
// Real spatial satellite overlays are proxied/cached separately from NASA GIBS WMS.
const SEED_METRICS = [
  { year: 2003, iceIndexPercent: 6.12 },
  { year: 2004, iceIndexPercent: 5.98 },
  { year: 2005, iceIndexPercent: 5.50 },
  { year: 2006, iceIndexPercent: 5.86 },
  { year: 2007, iceIndexPercent: 4.27 },
  { year: 2008, iceIndexPercent: 4.69 },
  { year: 2009, iceIndexPercent: 5.26 },
  { year: 2010, iceIndexPercent: 4.87 },
  { year: 2011, iceIndexPercent: 4.56 },
  { year: 2012, iceIndexPercent: 3.57 },
  { year: 2013, iceIndexPercent: 5.21 },
  { year: 2014, iceIndexPercent: 5.22 },
  { year: 2015, iceIndexPercent: 4.62 },
  { year: 2016, iceIndexPercent: 4.53 },
  { year: 2017, iceIndexPercent: 4.82 },
  { year: 2018, iceIndexPercent: 4.79 },
  { year: 2019, iceIndexPercent: 4.36 },
  { year: 2020, iceIndexPercent: 4.00 },
  { year: 2021, iceIndexPercent: 4.95 },
  { year: 2022, iceIndexPercent: 4.90 },
  { year: 2023, iceIndexPercent: 4.38 },
  { year: 2024, iceIndexPercent: 4.35 },
  { year: 2025, iceIndexPercent: 4.75 }
];

const SEED_REGIONS = [
  {
    key: 'pole',
    label: '90°N Basin',
    title: 'Central Arctic Basin (85°N)',
    lat: 85.0,
    lon: 0.0,
    dist: 3.95,
    description: 'Top-down orbital framing of the entire Arctic Ocean comparing the active year against the 2003 golden baseline contour.',
    sortOrder: 0
  },
  {
    key: 'beaufort',
    label: 'Beaufort Gyre',
    title: 'Beaufort Sea (74°N, 140°W)',
    lat: 74.0,
    lon: -140.0,
    dist: 3.3,
    description: 'Historically the primary reservoir for thick multi-year pack ice, the Beaufort Gyre now experiences major late-summer melt and lower harmonic voicings.',
    sortOrder: 1
  },
  {
    key: 'nwpassage',
    label: 'NW Passage',
    title: 'Northwest Passage (74°N, 98°W)',
    lat: 74.0,
    lon: -98.0,
    dist: 3.3,
    description: 'Threading through the Canadian Arctic Archipelago, seasonal shipping channels here have increasingly cleared of 15%+ pack ice compared to 2003.',
    sortOrder: 2
  },
  {
    key: 'fram',
    label: 'Fram Strait',
    title: 'Fram Strait & Svalbard (79°N, 2°E)',
    lat: 79.0,
    lon: 2.0,
    dist: 3.3,
    description: 'Situated between Greenland and Svalbard, Fram Strait is the primary deep-water gateway where Arctic pack ice exports south into the Atlantic.',
    sortOrder: 3
  },
  {
    key: 'laptev',
    label: 'Laptev Nursery',
    title: 'Laptev Sea (76°N, 125°E)',
    lat: 76.0,
    lon: 125.0,
    dist: 3.3,
    description: 'Known as the Arctic "ice factory," the Laptev Sea forms new seasonal ice each autumn—but warmer summer waters have pushed the September edge far north.',
    sortOrder: 4
  }
];

const SEED_DOMAIN_METRICS = {
  ice: [
    { year: 2003, value: 6.12 }, { year: 2004, value: 5.98 }, { year: 2005, value: 5.50 },
    { year: 2006, value: 5.86 }, { year: 2007, value: 4.27 }, { year: 2008, value: 4.69 },
    { year: 2009, value: 5.26 }, { year: 2010, value: 4.87 }, { year: 2011, value: 4.56 },
    { year: 2012, value: 3.57 }, { year: 2013, value: 5.21 }, { year: 2014, value: 5.22 },
    { year: 2015, value: 4.62 }, { year: 2016, value: 4.53 }, { year: 2017, value: 4.82 },
    { year: 2018, value: 4.79 }, { year: 2019, value: 4.36 }, { year: 2020, value: 4.00 },
    { year: 2021, value: 4.95 }, { year: 2022, value: 4.90 }, { year: 2023, value: 4.38 },
    { year: 2024, value: 4.35 }, { year: 2025, value: 4.75 }
  ],
  antarctica: [
    { year: 2003, value: 18.30 }, { year: 2004, value: 18.92 }, { year: 2005, value: 18.80 },
    { year: 2006, value: 19.09 }, { year: 2007, value: 18.86 }, { year: 2008, value: 18.15 },
    { year: 2009, value: 18.96 }, { year: 2010, value: 18.80 }, { year: 2011, value: 18.74 },
    { year: 2012, value: 19.21 }, { year: 2013, value: 19.39 }, { year: 2014, value: 19.76 },
    { year: 2015, value: 18.44 }, { year: 2016, value: 18.15 }, { year: 2017, value: 17.91 },
    { year: 2018, value: 17.96 }, { year: 2019, value: 18.33 }, { year: 2020, value: 18.84 },
    { year: 2021, value: 18.51 }, { year: 2022, value: 18.06 }, { year: 2023, value: 16.89 },
    { year: 2024, value: 17.15 }, { year: 2025, value: 17.64 }
  ],
  air: [
    { year: 2003, value: 0.176 }, { year: 2004, value: 0.172 }, { year: 2005, value: 0.175 },
    { year: 2006, value: 0.175 }, { year: 2007, value: 0.181 }, { year: 2008, value: 0.180 },
    { year: 2009, value: 0.180 }, { year: 2010, value: 0.180 }, { year: 2011, value: 0.187 },
    { year: 2012, value: 0.184 }, { year: 2013, value: 0.176 }, { year: 2014, value: 0.177 },
    { year: 2015, value: 0.190 }, { year: 2016, value: 0.177 }, { year: 2017, value: 0.173 },
    { year: 2018, value: 0.177 }, { year: 2019, value: 0.180 }, { year: 2020, value: 0.182 },
    { year: 2021, value: 0.175 }, { year: 2022, value: 0.180 }, { year: 2023, value: 0.182 },
    { year: 2024, value: 0.179 }, { year: 2025, value: 0.163 }
  ],
  greenness: [
    { year: 2003, value: 0.419 }, { year: 2004, value: 0.422 }, { year: 2005, value: 0.422 },
    { year: 2006, value: 0.423 }, { year: 2007, value: 0.424 }, { year: 2008, value: 0.419 },
    { year: 2009, value: 0.420 }, { year: 2010, value: 0.425 }, { year: 2011, value: 0.429 },
    { year: 2012, value: 0.426 }, { year: 2013, value: 0.427 }, { year: 2014, value: 0.429 },
    { year: 2015, value: 0.430 }, { year: 2016, value: 0.432 }, { year: 2017, value: 0.432 },
    { year: 2018, value: 0.428 }, { year: 2019, value: 0.429 }, { year: 2020, value: 0.435 },
    { year: 2021, value: 0.433 }, { year: 2022, value: 0.432 }, { year: 2023, value: 0.436 },
    { year: 2024, value: 0.440 }, { year: 2025, value: 0.442 }
  ],
  temperature: [
    { year: 2003, value: 0.62 }, { year: 2004, value: 0.54 }, { year: 2005, value: 0.68 },
    { year: 2006, value: 0.64 }, { year: 2007, value: 0.66 }, { year: 2008, value: 0.54 },
    { year: 2009, value: 0.65 }, { year: 2010, value: 0.72 }, { year: 2011, value: 0.61 },
    { year: 2012, value: 0.65 }, { year: 2013, value: 0.68 }, { year: 2014, value: 0.75 },
    { year: 2015, value: 0.90 }, { year: 2016, value: 1.02 }, { year: 2017, value: 0.93 },
    { year: 2018, value: 0.85 }, { year: 2019, value: 0.98 }, { year: 2020, value: 1.02 },
    { year: 2021, value: 0.85 }, { year: 2022, value: 0.89 }, { year: 2023, value: 1.17 },
    { year: 2024, value: 1.29 }, { year: 2025, value: 1.19 }
  ],
  rainfall: [
    { year: 2003, value: 2.711 }, { year: 2004, value: 2.704 }, { year: 2005, value: 2.723 },
    { year: 2006, value: 2.724 }, { year: 2007, value: 2.708 }, { year: 2008, value: 2.675 },
    { year: 2009, value: 2.698 }, { year: 2010, value: 2.732 }, { year: 2011, value: 2.677 },
    { year: 2012, value: 2.673 }, { year: 2013, value: 2.700 }, { year: 2014, value: 2.670 },
    { year: 2015, value: 2.724 }, { year: 2016, value: 2.729 }, { year: 2017, value: 2.700 },
    { year: 2018, value: 2.664 }, { year: 2019, value: 2.682 }, { year: 2020, value: 2.679 },
    { year: 2021, value: 2.645 }, { year: 2022, value: 2.654 }, { year: 2023, value: 2.679 },
    { year: 2024, value: 2.726 }, { year: 2025, value: 2.655 }
  ]
};

const VALID_DOMAINS = new Set(['ice', 'antarctica', 'air', 'greenness', 'temperature', 'rainfall']);

function getLayerIdForYear(year, domain = 'ice') {
  if (domain === 'air') return 'MERRA2_Aerosol_Optical_Depth_Analysis_Monthly';
  if (domain === 'greenness') return 'MODIS_Terra_L3_NDVI_Monthly';
  if (domain === 'temperature') return 'MERRA2_2m_Air_Temperature_Monthly';
  if (domain === 'rainfall') return 'IMERG_Precipitation_Rate';
  return year <= 2011 ? 'AMSRE_Sea_Ice_Concentration_12km' : 'AMSRU2_Sea_Ice_Concentration_12km';
}

function getArcticSeaName(lat, lon) {
  if (lat >= 85.5) return 'Central Arctic Pack';
  const normLon = ((((lon + 180) % 360) + 360) % 360) - 180;
  if (normLon >= -165 && normLon < -120) return 'Beaufort Sea';
  if (normLon >= -120 && normLon < -75) return 'Northwest Passage';
  if (normLon >= -75 && normLon < -40) return 'Lincoln & Baffin Sea';
  if (normLon >= -40 && normLon < 15) return 'Fram Strait';
  if (normLon >= 15 && normLon < 65) return 'Barents Sea';
  if (normLon >= 65 && normLon < 105) return 'Kara Sea';
  if (normLon >= 105 && normLon < 145) return 'Laptev Sea';
  return 'Chukchi & E. Siberian Sea';
}

/**
 * Create and initialize the SQLite database with schema, seed data, and query helpers.
 */
function createDatabase(dbPath = DEFAULT_DB_PATH) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS arctic_metrics (
      year INTEGER PRIMARY KEY,
      ice_index_percent REAL NOT NULL,
      multi_year_pack_percent REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'baseline',
      gibs_layer_id TEXT NOT NULL,
      sample_date TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS arctic_regions (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      title TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      dist REAL NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS acoustic_buoys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      buoy_number INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      sea_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_buoys_session ON acoustic_buoys(session_id, id);

    CREATE TABLE IF NOT EXISTS shared_snapshots (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      mode TEXT NOT NULL,
      audio_style TEXT NOT NULL,
      region_key TEXT,
      split_curtain_active INTEGER NOT NULL DEFAULT 0,
      split_screen_x REAL NOT NULL DEFAULT 0.5,
      seasonal_mode INTEGER NOT NULL DEFAULT 0,
      seasonal_month REAL NOT NULL DEFAULT 9.0,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gibs_cache (
      cache_key TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      layer_id TEXT NOT NULL,
      sample_date TEXT NOT NULL,
      file_path TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS domain_metrics (
      domain TEXT NOT NULL,
      year INTEGER NOT NULL,
      value REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'baseline',
      gibs_layer_id TEXT NOT NULL,
      sample_date TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (domain, year)
    );
  `);

  // Safe schema migrations for existing database files
  try { db.exec("ALTER TABLE acoustic_buoys ADD COLUMN domain TEXT NOT NULL DEFAULT 'ice';"); } catch (_) {}
  try { db.exec("ALTER TABLE shared_snapshots ADD COLUMN domain TEXT NOT NULL DEFAULT 'ice';"); } catch (_) {}
  try {
    db.exec("DELETE FROM arctic_metrics WHERE source IN ('nasa_gibs', 'illustrative');");
    db.exec("DELETE FROM domain_metrics WHERE source IN ('nasa_gibs', 'illustrative');");
    db.exec("UPDATE arctic_metrics SET source = 'nsidc_v4' WHERE source IN ('baseline', 'nsidc_v3');");
    db.exec("UPDATE domain_metrics SET source = 'nsidc_v4' WHERE domain IN ('ice', 'antarctica');");
    db.exec("UPDATE domain_metrics SET source = 'nasa_gistemp_v4' WHERE domain = 'temperature';");
    db.exec("UPDATE domain_metrics SET source = 'nasa_modis_terra_aod_v61' WHERE domain = 'air';");
    db.exec("UPDATE domain_metrics SET source = 'nasa_modis_terra_ndvi_v61' WHERE domain = 'greenness';");
    db.exec("UPDATE domain_metrics SET source = 'noaa_nasa_gpcp_v23' WHERE domain = 'rainfall';");
  } catch (_) {}

  // Idempotent seed for arctic_metrics
  const vals = SEED_METRICS.map((m) => m.iceIndexPercent);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const nowIso = new Date().toISOString();

  const insertMetricStmt = db.prepare(`
    INSERT INTO arctic_metrics
      (year, ice_index_percent, multi_year_pack_percent, source, gibs_layer_id, sample_date, updated_at)
    VALUES (?, ?, ?, 'nsidc_v4', ?, ?, ?)
    ON CONFLICT(year) DO UPDATE SET
      ice_index_percent = excluded.ice_index_percent,
      multi_year_pack_percent = excluded.multi_year_pack_percent,
      source = excluded.source,
      updated_at = excluded.updated_at
  `);

  const insertDomainMetricStmt = db.prepare(`
    INSERT INTO domain_metrics
      (domain, year, value, source, gibs_layer_id, sample_date, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(domain, year) DO UPDATE SET
      value = excluded.value,
      source = excluded.source,
      updated_at = excluded.updated_at
  `);

  const insertRegionStmt = db.prepare(`
    INSERT OR IGNORE INTO arctic_regions
      (key, label, title, lat, lon, dist, description, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN;');
  try {
    for (const m of SEED_METRICS) {
      const norm = (m.iceIndexPercent - minV) / Math.max(1e-5, maxV - minV);
      const multiYearPack = Math.round(28 + norm * 38);
      insertMetricStmt.run(
        m.year,
        m.iceIndexPercent,
        multiYearPack,
        getLayerIdForYear(m.year, 'ice'),
        `${m.year}-09-01`,
        nowIso
      );
    }

    for (const [domain, rows] of Object.entries(SEED_DOMAIN_METRICS)) {
      const domSource = domain === 'temperature' ? 'nasa_gistemp_v4'
        : (domain === 'antarctica' || domain === 'ice' ? 'nsidc_v4'
        : (domain === 'rainfall' ? 'noaa_nasa_gpcp_v23'
        : (domain === 'air' ? 'nasa_modis_terra_aod_v61'
        : 'nasa_modis_terra_ndvi_v61')));
      for (const m of rows) {
        insertDomainMetricStmt.run(
          domain,
          m.year,
          m.value,
          domSource,
          getLayerIdForYear(m.year, domain),
          `${m.year}-09-01`,
          nowIso
        );
      }
    }

    for (const r of SEED_REGIONS) {
      insertRegionStmt.run(r.key, r.label, r.title, r.lat, r.lon, r.dist, r.description, r.sortOrder);
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  // Prepared statements for API operations
  const stmts = {
    getAllMetrics: db.prepare('SELECT * FROM arctic_metrics ORDER BY year ASC'),
    getMetricByYear: db.prepare('SELECT * FROM arctic_metrics WHERE year = ?'),
    upsertMetric: db.prepare(`
      INSERT INTO arctic_metrics (year, ice_index_percent, multi_year_pack_percent, source, gibs_layer_id, sample_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(year) DO UPDATE SET
        ice_index_percent = excluded.ice_index_percent,
        multi_year_pack_percent = excluded.multi_year_pack_percent,
        source = excluded.source,
        updated_at = excluded.updated_at
    `),
    getDomainMetrics: db.prepare('SELECT * FROM domain_metrics WHERE domain = ? ORDER BY year ASC'),
    getDomainMetricByYear: db.prepare('SELECT * FROM domain_metrics WHERE domain = ? AND year = ?'),
    upsertDomainMetric: db.prepare(`
      INSERT INTO domain_metrics (domain, year, value, source, gibs_layer_id, sample_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(domain, year) DO UPDATE SET
        value = excluded.value,
        source = excluded.source,
        updated_at = excluded.updated_at
    `),
    getAllRegions: db.prepare('SELECT * FROM arctic_regions ORDER BY sort_order ASC'),
    getBuoysBySession: db.prepare('SELECT * FROM acoustic_buoys WHERE session_id = ? AND domain = ? ORDER BY id ASC'),
    getMaxBuoyNumber: db.prepare('SELECT COALESCE(MAX(buoy_number), 0) AS maxNum FROM acoustic_buoys WHERE session_id = ? AND domain = ?'),
    insertBuoy: db.prepare(`
      INSERT INTO acoustic_buoys (session_id, domain, buoy_number, lat, lon, sea_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    getBuoyById: db.prepare('SELECT * FROM acoustic_buoys WHERE id = ?'),
    deleteBuoyByIdAndSession: db.prepare('DELETE FROM acoustic_buoys WHERE id = ? AND session_id = ?'),
    deleteBuoyById: db.prepare('DELETE FROM acoustic_buoys WHERE id = ?'),
    insertSnapshot: db.prepare(`
      INSERT INTO shared_snapshots
        (id, domain, year, mode, audio_style, region_key, split_curtain_active, split_screen_x, seasonal_mode, seasonal_month, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getSnapshotById: db.prepare('SELECT * FROM shared_snapshots WHERE id = ?'),
    getGibsCache: db.prepare('SELECT * FROM gibs_cache WHERE cache_key = ?'),
    upsertGibsCache: db.prepare(`
      INSERT INTO gibs_cache (cache_key, year, layer_id, sample_date, file_path, byte_size, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        file_path = excluded.file_path,
        byte_size = excluded.byte_size,
        fetched_at = excluded.fetched_at
    `),
    countGibsCache: db.prepare('SELECT COUNT(*) AS count FROM gibs_cache'),
    listGibsCacheYears: db.prepare('SELECT year, layer_id, sample_date, byte_size, fetched_at FROM gibs_cache ORDER BY year ASC')
  };

  function formatMetric(row) {
    return {
      domain: 'ice',
      year: row.year,
      value: row.ice_index_percent,
      iceIndexPercent: row.ice_index_percent,
      multiYearPackPercent: row.multi_year_pack_percent,
      source: row.source,
      gibsLayerId: row.gibs_layer_id,
      sampleDate: row.sample_date,
      updatedAt: row.updated_at
    };
  }

  function formatDomainMetric(row) {
    return {
      domain: row.domain,
      year: row.year,
      value: row.value,
      source: row.source,
      gibsLayerId: row.gibs_layer_id,
      sampleDate: row.sample_date,
      updatedAt: row.updated_at
    };
  }

  function formatBuoy(row) {
    return {
      id: row.id,
      sessionId: row.session_id,
      domain: row.domain || 'ice',
      buoyNumber: row.buoy_number,
      lat: row.lat,
      lon: row.lon,
      seaName: row.sea_name,
      createdAt: row.created_at
    };
  }

  function formatSnapshot(row) {
    return {
      id: row.id,
      domain: row.domain || 'ice',
      year: row.year,
      mode: row.mode,
      audioStyle: row.audio_style,
      regionKey: row.region_key,
      splitCurtainActive: Boolean(row.split_curtain_active),
      splitScreenX: row.split_screen_x,
      seasonalMode: Boolean(row.seasonal_mode),
      seasonalMonth: row.seasonal_month,
      note: row.note,
      createdAt: row.created_at
    };
  }

  return {
    raw: db,

    listMetrics(domain = 'ice') {
      if (domain === 'ice') return stmts.getAllMetrics.all().map(formatMetric);
      return stmts.getDomainMetrics.all(domain).map(formatDomainMetric);
    },

    getMetric(year, domain = 'ice') {
      if (domain === 'ice') {
        const row = stmts.getMetricByYear.get(year);
        return row ? formatMetric(row) : null;
      }
      const row = stmts.getDomainMetricByYear.get(domain, year);
      return row ? formatDomainMetric(row) : null;
    },

    updateMetric(year, { value, iceIndexPercent, multiYearPackPercent, source = 'nasa_gibs', domain = 'ice' }) {
      const numericVal = Number.isFinite(Number(value)) ? Number(value) : Number(iceIndexPercent);
      const now = new Date().toISOString();
      if (domain !== 'ice') {
        stmts.upsertDomainMetric.run(
          domain,
          year,
          Number(numericVal.toFixed(3)),
          source,
          getLayerIdForYear(year, domain),
          `${year}-09-01`,
          now
        );
        return this.getMetric(year, domain);
      }
      const existing = stmts.getMetricByYear.get(year);
      const pack = Number.isFinite(multiYearPackPercent)
        ? multiYearPackPercent
        : existing
          ? existing.multi_year_pack_percent
          : Math.round(28 + ((numericVal - 25) / 22) * 38);
      stmts.upsertMetric.run(
        year,
        Number(numericVal.toFixed(2)),
        Number(pack.toFixed(1)),
        source,
        getLayerIdForYear(year, 'ice'),
        `${year}-09-01`,
        now
      );
      return this.getMetric(year, 'ice');
    },

    listRegions() {
      return stmts.getAllRegions.all().map((r) => ({
        key: r.key,
        label: r.label,
        title: r.title,
        lat: r.lat,
        lon: r.lon,
        dist: r.dist,
        desc: r.description
      }));
    },

    listBuoys(sessionId = 'default', domain = 'ice') {
      return stmts.getBuoysBySession.all(sessionId, domain).map(formatBuoy);
    },

    addBuoy({ sessionId = 'default', domain = 'ice', lat, lon, label, maxBuoys = 3 }) {
      const existing = stmts.getBuoysBySession.all(sessionId, domain);
      const evictedIds = [];
      while (existing.length >= maxBuoys) {
        const oldest = existing.shift();
        stmts.deleteBuoyById.run(oldest.id);
        evictedIds.push(oldest.id);
      }

      const maxRow = stmts.getMaxBuoyNumber.get(sessionId, domain);
      const buoyNumber = (maxRow ? maxRow.maxNum : 0) + 1;
      const seaName = label || (domain === 'ice' ? getArcticSeaName(lat, lon) : `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`);
      const createdAt = new Date().toISOString();

      const info = stmts.insertBuoy.run(sessionId, domain, buoyNumber, lat, lon, seaName, createdAt);
      const created = formatBuoy(stmts.getBuoyById.get(Number(info.lastInsertRowid)));
      return { buoy: created, evictedIds };
    },

    removeBuoy(id, sessionId = 'default') {
      const result = stmts.deleteBuoyByIdAndSession.run(id, sessionId);
      return result.changes > 0;
    },

    createSnapshot(payload) {
      const id = crypto.randomBytes(5).toString('base64url');
      const createdAt = new Date().toISOString();
      const domain = VALID_DOMAINS.has(payload.domain) ? payload.domain : 'ice';
      stmts.insertSnapshot.run(
        id,
        domain,
        payload.year,
        payload.mode || 'explore',
        payload.audioStyle || 'Calm ambient',
        payload.regionKey || null,
        payload.splitCurtainActive ? 1 : 0,
        Number.isFinite(payload.splitScreenX) ? payload.splitScreenX : 0.5,
        payload.seasonalMode ? 1 : 0,
        Number.isFinite(payload.seasonalMonth) ? payload.seasonalMonth : 9.0,
        payload.note || null,
        createdAt
      );
      return formatSnapshot(stmts.getSnapshotById.get(id));
    },

    getSnapshot(id) {
      const row = stmts.getSnapshotById.get(id);
      return row ? formatSnapshot(row) : null;
    },

    getGibsCacheEntry(cacheKey) {
      return stmts.getGibsCache.get(cacheKey) || null;
    },

    saveGibsCacheEntry({ cacheKey, year, layerId, sampleDate, filePath, byteSize }) {
      stmts.upsertGibsCache.run(cacheKey, year, layerId, sampleDate, filePath, byteSize, new Date().toISOString());
      return stmts.getGibsCache.get(cacheKey);
    },

    getGibsCacheStatus() {
      const row = stmts.countGibsCache.get();
      const entries = stmts.listGibsCacheYears.all();
      return {
        cachedCount: row ? row.count : 0,
        totalYears: SEED_METRICS.length,
        years: entries
      };
    },

    close() {
      db.close();
    }
  };
}

module.exports = {
  createDatabase,
  getLayerIdForYear,
  getArcticSeaName,
  VALID_DOMAINS,
  SEED_METRICS,
  SEED_DOMAIN_METRICS,
  SEED_REGIONS
};

