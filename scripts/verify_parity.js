const fs = require('fs');
const path = require('path');
const rootDir = path.resolve(__dirname, '..');
const ref = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/reference-series.json'), 'utf8'));
const { SEED_DOMAIN_METRICS, createDatabase } = require(path.join(rootDir, 'db/database.js'));

const domainsJs = fs.readFileSync(path.join(rootDir, 'public/js/domains.js'), 'utf8');

const airMatch = domainsJs.match(/id:\s*'air'[\s\S]*?baselineSeries:\s*\{([\s\S]*?)\}/);
const greenMatch = domainsJs.match(/id:\s*'greenness'[\s\S]*?baselineSeries:\s*\{([\s\S]*?)\}/);

function parseSeries(str) {
  const obj = {};
  const re = /(\d{4}):\s*([0-9.]+)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    obj[m[1]] = parseFloat(m[2]);
  }
  return obj;
}

const domainsAir = parseSeries(airMatch[1]);
const domainsGreenness = parseSeries(greenMatch[1]);

const db = createDatabase();

let errors = 0;
for (let y = 2003; y <= 2025; y++) {
  const sy = String(y);

  const refAod = ref.modis_aod[sy];
  const seedAod = SEED_DOMAIN_METRICS.air.find((m) => m.year === y).value;
  const domAod = domainsAir[sy];
  const dbAod = db.getMetric(y, 'air').value;

  if (refAod !== seedAod || refAod !== domAod || refAod !== dbAod) {
    console.error(`Mismatch for Air ${y}: ref=${refAod}, seed=${seedAod}, dom=${domAod}, db=${dbAod}`);
    errors++;
  }

  const refNdvi = ref.modis_ndvi[sy];
  const seedNdvi = SEED_DOMAIN_METRICS.greenness.find((m) => m.year === y).value;
  const domNdvi = domainsGreenness[sy];
  const dbNdvi = db.getMetric(y, 'greenness').value;

  if (refNdvi !== seedNdvi || refNdvi !== domNdvi || refNdvi !== dbNdvi) {
    console.error(`Mismatch for Greenness ${y}: ref=${refNdvi}, seed=${seedNdvi}, dom=${domNdvi}, db=${dbNdvi}`);
    errors++;
  }
}
db.close();

if (errors === 0) {
  console.log('PERFECT PARITY: All 23 years (2003–2025) of Air & Greenness match exactly across all locations (reference-series.json, database.js seeds, earth_jukebox.db, domains.js)!');
} else {
  console.error(`Found ${errors} mismatches!`);
  process.exit(1);
}
