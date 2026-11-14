const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../db/database');
const { createApp } = require('../server');

describe('Earth Jukebox API & SQLite Database', () => {
  let tmpDir;
  let db;
  let server;
  let baseUrl;
  let gibsFetchCalls = 0;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-jukebox-test-'));
    const cacheDir = path.join(tmpDir, 'gibs-cache');
    db = createDatabase(path.join(tmpDir, 'test.db'));

    const mockPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const app = createApp({
      db,
      cacheDir,
      publicDir: path.join(__dirname, '..', 'public'),
      adminApiKey: 'test-admin-key',
      gibsFetcher: async () => {
        gibsFetchCalls++;
        return mockPng;
      }
    });
    server = app.server;
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/health returns database status and counts', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.database, 'sqlite');
    assert.equal(body.metricsCount, 23);
  });

  it('GET /api/metrics returns seeded 2003-2025 series and PUT updates a year', async () => {
    const res = await fetch(`${baseUrl}/api/metrics`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.metrics.length, 23);
    assert.equal(body.metrics[0].year, 2003);
    assert.equal(body.metrics[0].iceIndexPercent, 6.12);
    assert.equal(body.dataProvenance.metricsType, 'nsidc_sea_ice_index_v4');

    const unauthRes = await fetch(`${baseUrl}/api/metrics/2012`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iceIndexPercent: 25.1 })
    });
    assert.equal(unauthRes.status, 401);

    const updateRes = await fetch(`${baseUrl}/api/metrics/2012`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'test-admin-key' },
      body: JSON.stringify({ iceIndexPercent: 25.1, source: 'nasa_gibs' })
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.metric.iceIndexPercent, 25.1);
    assert.equal(updated.metric.source, 'nasa_gibs');

    const invalidRes = await fetch(`${baseUrl}/api/metrics/2012`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'test-admin-key' },
      body: JSON.stringify({ iceIndexPercent: 150 })
    });
    assert.equal(invalidRes.status, 400);
  });

  it('GET /api/regions returns 5 seeded Arctic regions', async () => {
    const res = await fetch(`${baseUrl}/api/regions`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.regions.length, 5);
    assert.ok(body.regions.some((r) => r.key === 'beaufort'));
  });

  it('Buoys API persists, enforces max 3 per session, avoids duplicate numbers, and deletes', async () => {
    const sessionId = 'test-session-1';
    const coords = [
      { lat: 76.0, lon: -140.0 },
      { lat: 79.0, lon: 2.0 },
      { lat: 77.0, lon: 125.0 },
      { lat: 84.0, lon: -90.0 }
    ];

    const createdIds = [];
    for (const c of coords) {
      const res = await fetch(`${baseUrl}/api/buoys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...c })
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      createdIds.push(body.buoy);
    }

    const listRes = await fetch(`${baseUrl}/api/buoys?sessionId=${sessionId}`);
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.buoys.length, 3);
    assert.deepEqual(
      listBody.buoys.map((b) => b.buoyNumber),
      [2, 3, 4]
    );

    const delRes = await fetch(`${baseUrl}/api/buoys/${listBody.buoys[0].id}?sessionId=${sessionId}`, {
      method: 'DELETE'
    });
    assert.equal(delRes.status, 200);
    const delBody = await delRes.json();
    assert.equal(delBody.deleted, true);
    assert.equal(delBody.buoys.length, 2);

    const badBuoy = await fetch(`${baseUrl}/api/buoys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, lat: 10.0, lon: 0.0 })
    });
    assert.equal(badBuoy.status, 400);
  });

  it('Snapshots API creates and retrieves saved view states', async () => {
    const createRes = await fetch(`${baseUrl}/api/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 2012,
        mode: 'explore',
        audioStyle: 'Original',
        regionKey: 'beaufort',
        splitCurtainActive: true,
        splitScreenX: 0.42
      })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created.snapshot.id);
    assert.ok(created.sharePath.includes(created.snapshot.id));

    const getRes = await fetch(`${baseUrl}/api/snapshots/${created.snapshot.id}`);
    assert.equal(getRes.status, 200);
    const loaded = await getRes.json();
    assert.equal(loaded.snapshot.year, 2012);
    assert.equal(loaded.snapshot.splitCurtainActive, true);
    assert.equal(loaded.snapshot.regionKey, 'beaufort');

    const missingRes = await fetch(`${baseUrl}/api/snapshots/doesnotexist99`);
    assert.equal(missingRes.status, 404);
  });

  it('GIBS proxy caches imagery on disk and in SQLite', async () => {
    const first = await fetch(`${baseUrl}/api/gibs/2012`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('x-cache'), 'MISS');
    assert.equal(first.headers.get('content-type'), 'image/png');
    assert.equal(gibsFetchCalls, 1);

    const second = await fetch(`${baseUrl}/api/gibs/2012`);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get('x-cache'), 'HIT');
    assert.equal(gibsFetchCalls, 1);

    const statusRes = await fetch(`${baseUrl}/api/gibs/status`);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.cachedCount, 1);
  });

  it('Serves frontend HTML and blocks path traversal', async () => {
    const rootRes = await fetch(`${baseUrl}/`);
    assert.equal(rootRes.status, 200);
    const html = await rootRes.text();
    assert.ok(html.includes('Earth Jukebox'));

    const travRes = await fetch(`${baseUrl}/../server.js`);
    assert.ok(travRes.status === 403 || travRes.status === 404);
  });

  it('Supports air, greenness, temperature, and rainfall domains across metrics, buoys, snapshots, and GIBS proxy', async () => {
    for (const domain of ['antarctica', 'air', 'greenness', 'temperature', 'rainfall']) {
      const mRes = await fetch(`${baseUrl}/api/metrics?domain=${domain}`);
      assert.equal(mRes.status, 200);
      const mBody = await mRes.json();
      assert.equal(mBody.domain, domain);
      assert.equal(mBody.metrics.length, 23);
    }

    const globalBuoyRes = await fetch(`${baseUrl}/api/buoys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'global-sess', domain: 'greenness', lat: -3.5, lon: -62.0, label: 'Amazon & S. America' })
    });
    assert.equal(globalBuoyRes.status, 201);
    const globalBuoy = await globalBuoyRes.json();
    assert.equal(globalBuoy.buoy.domain, 'greenness');

    const snapRes = await fetch(`${baseUrl}/api/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'rainfall', year: 2020, mode: 'explore', audioStyle: 'Original' })
    });
    assert.equal(snapRes.status, 201);
    const snapBody = await snapRes.json();
    assert.equal(snapBody.snapshot.domain, 'rainfall');
    assert.ok(snapBody.sharePath.includes('#d=rainfall&y=2020'));

    const rainGibs = await fetch(`${baseUrl}/api/gibs/rainfall/2020`);
    assert.equal(rainGibs.status, 200);
    assert.equal(rainGibs.headers.get('content-type'), 'image/png');

    // Test malformed URI returns HTTP 400 instead of 500
    const malformedRes = await fetch(`${baseUrl}/%E0%A4%A`);
    assert.equal(malformedRes.status, 400);
    const malformedBody = await malformedRes.json();
    assert.ok(malformedBody.error);
  });
});

