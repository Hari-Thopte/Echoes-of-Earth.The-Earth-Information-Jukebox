# Earth Jukebox

> **NASA Space Apps Challenge:** Developed for **The Earth Information Jukebox** challenge (inspired by NASA’s Earth Information Center / EIC), translating multi-domain visual Earth observation data into interactive 3D telemetry and real-time harmonic sonification.

Interactive 3D Earth satellite telemetry, subsurface visualization, and Tone.js harmonic sonification across six planetary domains (2003–2025), backed by a zero-dependency Node.js HTTP server and SQLite database (`node:sqlite`).

## Team Krypthon

- **Harshika Thopte** — Team Leader and Backend Developer
  - Project leadership and coordination.
  - Node.js and `node:sqlite` backend, REST APIs and the NASA GIBS caching proxy.
  - NASA and NOAA data pipeline and data provenance documentation.
- **Ishan Sonawane** — Frontend Developer
  - Three.js WebGL globe and custom shaders.
  - Tone.js sonification engine.
  - Interactive interface: timeline, split curtain, acoustic buoys, Classroom and Simple UI modes, and video and MIDI export.

## Hackathon Compliance & Project Timeline

- **Challenge Timing**: Project development started after October 28th, following the official release of the challenge description for **The Earth Information Jukebox**.
- **Original Work**: Built during the NASA Space Apps Challenge window. All WebGL shaders, Tone.js harmonic sonification mappings, vector UI assets, SQLite schema, and zero-dependency Node.js server logic were developed specifically for this submission.

## Use of Super Intelligence (SI)

In line with the NASA Space Apps Challenge rules, we disclose where Super Intelligence tools were used in this project:

- **Coding, debugging and troubleshooting:** SI assistants (Claude by Anthropic, Antigravity and Grok) helped write, review and fix code, including the data-processing scripts in `scripts/` and the service-worker registration.
- **Data analysis and interpretation:** SI assisted with processing and checking the MODIS, GPCP and other series. All values come from the NASA and NOAA sources listed in [`data/PROVENANCE.md`](data/PROVENANCE.md).
- **Research and information gathering:** SI helped identify data sources, products and tools.
- **Writing and editing:** this README, the project summary and the descriptions were drafted and edited with SI assistance.
- **Not used:** no AI model runs inside the app, and [confirm: no AI-generated images, video or audio are included].

All SI-assisted work was reviewed by the team, and the team takes responsibility for the final result. The project does not use or modify any NASA logos, flags or mission identifiers.

## Requirements

- **Node.js `>=22.5.0`** (uses built-in `node:sqlite` — currently experimental in Node.js — plus `node:http`, `node:crypto`, and `node:test`, with zero `npm install` dependencies)

## Data Provenance & Verification (NSIDC Sea Ice Index v4.0 Unified)

- **NASA Space Apps Challenge Alignment:** Built specifically for *The Earth Information Jukebox* challenge, sonifying visual planetary data streams to foster multi-sensory scientific understanding, accessibility, and climate storytelling.
- **Unified NSIDC Sea Ice Index Version:** Both Arctic and Antarctic cryosphere series are unified on **NSIDC Sea Ice Index Version 4.0 (v4.0)** from the NOAA/NSIDC G02135 archive:
  - **Arctic Sea Ice (`ice`):** NSIDC Sea Ice Index v4.0 September monthly mean extent cross-checked against NSIDC Sea Ice Index data (`N_09_extent_v4.0.csv`: 2003: 6.12 M km², 2012 record low: 3.57 M km², 2014: 5.22 M km², 2018: 4.79 M km², 2025: 4.75 M km²).
  - **Antarctica Sea Ice (`antarctica`):** NSIDC Sea Ice Index v4.0 September monthly mean extent cross-checked against NSIDC Sea Ice Index data (`S_09_extent_v4.0.csv`: 2003: 18.30 M km², 2014 winter peak: 19.76 M km², 2023 winter crash: 16.89 M km², 2025: 17.64 M km²).
- **Global Surface Temperature (`temperature`):** Real **NASA GISS GISTEMP v4** annual global land-ocean temperature anomaly in °C vs 1951–1980 (2003: +0.62°C, 2016 Super El Niño: +1.02°C, 2024 record high: +1.29°C, 2025: +1.19°C), exactly synchronized across SQLite and client fallbacks.
- **Air, Greenness, Rainfall (`air`, `greenness`, `rainfall`):** 
  - **Air Quality (`air`):** Published **NASA MODIS Terra Collection 6.1** (`MOD08_M3`) global annual mean Aerosol Optical Depth at 550nm (labeled `MODIS Terra • AOD`, range 0.163–0.190 AOD, 2003–2025) from LAADS DAAC. Spatial overlay: MODIS / OMPS AOD via NASA GIBS.
  - **Vegetation Greenness (`greenness`):** Published **NASA MODIS Terra Collection 6.1** (`MOD13C2`) global terrestrial vegetated land annual mean NDVI (labeled `MODIS Terra • NDVI`, range 0.419–0.442 NDVI, 2003–2025) from LP DAAC. Spatial overlay: MODIS Terra 16-Day NDVI via NASA GIBS.
  - **Precipitation (`rainfall`):** Published **NOAA / NASA GPCP Version 2.3** global annual mean precipitation rate (labeled `GPCP v2.3 • mm/d`, 2.645–2.732 mm/day, 2003–2025) calculated directly from monthly NetCDF records via `scripts/fetch-reference-data.py`. Spatial overlay: TRMM / GPM IMERG via NASA GIBS.
- **Averaging Method:** All three global gridded products—rainfall (GPCP v2.3), air quality (MOD08_M3), and vegetation greenness (MOD13C2)—are true 12-month annual area-weighted means across all 12 calendar monthly grids per year (276 monthly grids each across 2003–2025), weighted by cos(latitude), with fill values masked and NDVI limited to terrestrial vegetated land. The processing script and the reference datasets are fully synchronized.
- **3D Globe Overlays:** Real satellite imagery proxied and cached from **NASA GIBS WMS** (`db/cache/gibs/`).

## Write Protection (`PUT /api/metrics/:year`)

- Public writes to `PUT /api/metrics/:year` are **disabled by default** (`403` when `ADMIN_API_KEY` is unset).
- To enable admin updates, start the server with `ADMIN_API_KEY=your-secret` and send `X-Admin-Key: your-secret` (or `Authorization: Bearer your-secret`); invalid or missing keys return `401`.

## Quick Start

```bash
npm start
```

- **Landing Hero:** [http://localhost:3000](http://localhost:3000) (`public/index.html` — interactive WebGL Earth scrub hero)
- **Earth Jukebox App:** [http://localhost:3000/jukebox.html](http://localhost:3000/jukebox.html)

To run the test suite:

```bash
npm test
```

## Domains & Provenance Summary

1. **Arctic Sea Ice (`ice`)**: Published **NSIDC Sea Ice Index v4.0** September monthly mean extent (million km²), cross-checked against NSIDC Sea Ice Index data `N_09_extent_v4.0.csv` (2012 record low: 3.57 M km²). Spatial layer: AMSR-E / AMSR2 12km via NASA GIBS.
2. **Antarctica Sea Ice (`antarctica`)**: Verified **NSIDC Sea Ice Index v4.0** Southern Hemisphere September monthly mean extent (million km²), cross-checked against NSIDC Sea Ice Index data `S_09_extent_v4.0.csv` (2014 winter peak: 19.76 M km², 2023 crash: 16.89 M km²). Spatial layer: AMSR-E / AMSR2 South via NASA GIBS.
3. **Global Surface Temperature (`temperature`)**: Published **NASA GISS GISTEMP v4** annual land-ocean temperature anomaly (°C vs 1951–1980 baseline). Spatial layer: MODIS Terra Land Surface Temp / MERRA-2 2m via NASA GIBS.
4. **Air Quality & Aerosols (`air`)**: Published **NASA MODIS Terra Collection 6.1** (`MOD08_M3`) global annual mean Aerosol Optical Depth at 550nm (labeled `MODIS Terra • AOD`, range 0.163–0.190 AOD, 2003–2025). Spatial overlay: MODIS / OMPS AOD via NASA GIBS.
5. **Vegetation Greenness (`greenness`)**: Published **NASA MODIS Terra Collection 6.1** (`MOD13C2`) global terrestrial vegetated land annual mean NDVI (labeled `MODIS Terra • NDVI`, range 0.419–0.442 NDVI, 2003–2025). Spatial overlay: MODIS Terra 16-Day NDVI via NASA GIBS.
6. **Precipitation & Monsoon (`rainfall`)**: Published **NOAA / NASA GPCP Version 2.3** global annual mean precipitation rate (labeled `GPCP v2.3 • mm/d`, range 2.645–2.732 mm/day, 2003–2025), computed directly from 276 monthly NetCDF-4 grids via `scripts/fetch-reference-data.py`. Spatial overlay: TRMM / GPM IMERG via NASA GIBS.

## Features

- **3D WebGL Globe & Custom Shaders** — Subsurface pack-ice/domain overlays, natural cyan-blue atmospheric limb glow, 2003 gold baseline ring, and 3D split curtain (`Then vs. Now`).
- **Real-Time Harmonic Sonification** — Tone.js synth & ambient drone mapped to satellite telemetry, with selectable audio styles, live spectrum visualizer, spoken/text captions, and MIDI export.
- **Interactive Exploration** — Click-to-listen regional probes, regional story cards, 3D acoustic sonar buoys (persisted per session), live/monthly NASA GIBS imagery (with automatic 12s timeout and low-res/procedural fallback), custom `year,value` CSV overlay, experimental shared buoy rooms (4s polling sync), WebM video export (`8s` / `16s` / `24s` with live progress and cancel), and Lite / Classroom / mobile-friendly `Simple UI` modes.
- **Offline-Ready & PWA** — Core client libraries (Three.js, Tone.js, GSAP, lil-gui) and Earth globe textures (Blue Marble day, night city lights, normal bump, ocean specular, clouds) are vendored locally under `public/vendor/`. Installable manifest and offline service worker caching (`public/manifest.webmanifest`, `public/sw.js`) ensure full 3D globe functionality offline after the first visit (the service worker installs on the first online load). Typography (Inter, JetBrains Mono, Space Grotesk) is loaded from Google Fonts and falls back to system fonts (`system-ui, sans-serif`) when offline.

## Architecture

- [`server.js`](server.js) — Zero-dependency HTTP server serving `public/` static assets and `/api/*` JSON/PNG endpoints. Requires Node.js ≥22.5.0.
- [`db/database.js`](db/database.js) — SQLite schema, WAL setup, idempotent multi-domain seed data, and prepared-statement queries.
- [`public/index.html`](public/index.html) — Full-viewport raw WebGL Earth scrub hero landing page with domain-preserving `Enter Earth Jukebox ↗` handoff.
- [`public/jukebox.html`](public/jukebox.html) — Main 3D Earth Jukebox interface.
- [`public/style.css`](public/style.css) — Glassmorphic cyber-blue UI layout, responsive controls, and collapsible Tools menu.
- [`public/vendor/`](public/vendor/) — Vendored client libraries (`three.min.js`, `Tone.js`, `gsap.min.js`, `lil-gui.umd.min.js`) for zero-external-CDN offline independence.
- [`public/js/`](public/js/) — Modular frontend (`config.js`, `domains.js`, `helpers.js`, `shaders.js`, `scene.js`, `audio.js`, `data.js`, `timeline.js`, `controls.js`, `galaxy-bg.js`, `app.js`, `extras.js`).
- [`tests/api.test.js`](tests/api.test.js) — Automated integration tests for all API endpoints, malformed URL handling, and database persistence.

## Database Tables (`db/earth_jukebox.db`)

- `domain_metrics` — Multi-domain yearly time series (`ice`, `antarctica`, `air`, `greenness`, `temperature`, `rainfall`, 2003–2025) with provenance tags.
- `arctic_metrics` — Backward-compatible Arctic sea-ice time series with multi-year pack ice percentages.
- `arctic_regions` — Landmark coordinates, camera framing, and regional story insights.
- `acoustic_buoys` — Session-scoped deployed 3D acoustic sonar buoys (max 3 per session, domain-isolated).
- `shared_snapshots` — Short-URL saved view states (domain, year, audio style, split curtain, region).
- `gibs_cache` — Metadata for NASA GIBS WMS PNG tiles cached under `db/cache/gibs/`.

## API Endpoints

- `GET /api/health` — Server and database status
- `GET /api/metrics?domain=...` / `PUT /api/metrics/:year` — Read or update yearly domain metrics with provenance
- `GET /api/regions?domain=...` — Regional landmark metadata
- `GET /api/geocode?lat=...&lon=...` — Instant reverse-geocoding (city, state, country & water bodies)
- `GET /api/buoys?sessionId=...&domain=...` / `POST /api/buoys` / `DELETE /api/buoys/:id` — Manage persisted sonar buoys
- `POST /api/snapshots` / `GET /api/snapshots/:id` — Create and restore shareable view snapshots
- `GET /api/gibs/status` — GIBS cache status
- `GET /api/gibs/:year` / `GET /api/gibs/:domain/:year` / `GET /api/gibs/:domain/:year/:month` / `GET /api/gibs/live/:domain` — Caching proxy for NASA GIBS imagery

## Credits & Data Sources

- **NASA:** GISS GISTEMP v4, MODIS Terra MOD08_M3 (LAADS DAAC), MODIS Terra MOD13C2 (LP DAAC), Global Imagery Browse Services (GIBS), Earthdata.
- **NOAA and partners:** GPCP v2.3 monthly precipitation (NOAA NCEI), NSIDC Sea Ice Index v4.
- **Open-source software:** Three.js, Tone.js, GSAP, lil-gui, earthaccess, pyhdf, OpenStreetMap Nominatim, Node.js.
- **Earth textures and background video:** [add source and licence for the five files in `public/vendor/textures/` and for `public/bg-video.mp4`].

## License

MIT License. See the [`LICENSE`](LICENSE) file.
