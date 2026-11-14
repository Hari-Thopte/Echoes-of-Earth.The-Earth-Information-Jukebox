// =============================================================
// 2. PURE DATA HELPERS & DETECT MOMENTS
// =============================================================
function detectMoments(series) {
  if (!Array.isArray(series)) {
    return { minYear: null, minVal: null, maxDropYear: null, maxDrop: 0, maxReboundYear: null, maxRebound: 0, firstBelowMean: null, mean: 0 };
  }
  const valid = series
    .map((item) => ({
      year: Number(item && item.year),
      val: item && item.val !== null && item.val !== undefined ? Number(item.val) : NaN
    }))
    .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.val))
    .sort((a, b) => a.year - b.year);

  if (valid.length === 0) {
    return { minYear: null, minVal: null, maxDropYear: null, maxDrop: 0, maxReboundYear: null, maxRebound: 0, firstBelowMean: null, mean: 0 };
  }

  let minYear = valid[0].year, minVal = valid[0].val;
  let maxDropYear = null, maxDrop = 0, maxReboundYear = null, maxRebound = 0, sum = 0;

  for (let i = 0; i < valid.length; i++) {
    const cur = valid[i];
    sum += cur.val;
    if (cur.val < minVal) { minVal = cur.val; minYear = cur.year; }
    if (i > 0) {
      const prev = valid[i - 1];
      if (cur.year - prev.year === 1) {
        const d = cur.val - prev.val;
        if (d < maxDrop) { maxDrop = d; maxDropYear = cur.year; }
        if (d > maxRebound) { maxRebound = d; maxReboundYear = cur.year; }
      }
    }
  }

  const mean = sum / valid.length;
  const firstBelowMeanObj = valid.find((s) => s.val < mean);
  const firstBelowMean = firstBelowMeanObj ? firstBelowMeanObj.year : valid[0].year;
  return { minYear, minVal, maxDropYear, maxDrop, maxReboundYear, maxRebound, firstBelowMean, mean };
}

function extentToRenderIndex(val, domainId = 'ice') {
  const v = Number(val);
  if (!Number.isFinite(v)) return 35.0;
  if (domainId === 'ice') {
    if (v > 15.0) return v; // Already on 0..100 render scale
    // NSIDC Arctic Sept Sea Ice Extent: 3.57 M km² (2012 record low) -> 25.4, 6.12 M km² (2003 reference) -> 46.2
    const norm = (v - 3.57) / (6.12 - 3.57);
    const scaled = 25.4 + norm * (46.2 - 25.4);
    return Math.max(12.0, Math.min(68.0, scaled));
  }
  if (domainId === 'antarctica') {
    if (v > 25.0) return v; // Already on 0..100 render scale
    // NSIDC Antarctic Sept Sea Ice Extent: 16.89 M km² (2023 record low) -> 40.8, 19.76 M km² (2014 peak) -> 52.1
    const norm = (v - 16.89) / (19.76 - 16.89);
    const scaled = 40.8 + norm * (52.1 - 40.8);
    return Math.max(25.0, Math.min(68.0, scaled));
  }
  return v;
}

function createProceduralEarthTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#dceefb');
  grad.addColorStop(0.12, '#0a2548');
  grad.addColorStop(0.5, '#071c3a');
  grad.addColorStop(0.88, '#0a2548');
  grad.addColorStop(1.0, '#e2f1fc');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#1b3b2b';
  [[130, 88, 36, 26], [158, 148, 22, 34], [268, 86, 42, 24], [285, 134, 24, 34], [356, 86, 54, 30], [412, 168, 22, 16]].forEach(([x, y, rx, ry]) => {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2); ctx.fill();
  });
  const tex = new THREE.CanvasTexture(cv);
  if (typeof configureTexture === 'function') configureTexture(tex, true);
  return tex;
}

// =============================================================
// GLOBAL GAZETTEER: CITIES (CITY, STATE, COUNTRY) & WATER BODIES
// =============================================================
const GLOBAL_GAZETTEER_CITIES = [
  // India (Major Metros & State Capitals)
  { name: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.076, lon: 72.877, maxDistKm: 180 },
  { name: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.520, lon: 73.856, maxDistKm: 130 },
  { name: 'Nagpur', state: 'Maharashtra', country: 'India', lat: 21.145, lon: 79.088, maxDistKm: 160 },
  { name: 'Nashik', state: 'Maharashtra', country: 'India', lat: 19.997, lon: 73.789, maxDistKm: 120 },
  { name: 'Aurangabad', state: 'Maharashtra', country: 'India', lat: 19.876, lon: 75.343, maxDistKm: 130 },
  { name: 'Kolhapur', state: 'Maharashtra', country: 'India', lat: 16.705, lon: 74.243, maxDistKm: 110 },
  { name: 'Solapur', state: 'Maharashtra', country: 'India', lat: 17.659, lon: 75.906, maxDistKm: 120 },
  { name: 'New Delhi', state: 'Delhi', country: 'India', lat: 28.613, lon: 77.209, maxDistKm: 180 },
  { name: 'Bengaluru', state: 'Karnataka', country: 'India', lat: 12.971, lon: 77.594, maxDistKm: 180 },
  { name: 'Mysuru', state: 'Karnataka', country: 'India', lat: 12.295, lon: 76.639, maxDistKm: 120 },
  { name: 'Mangaluru', state: 'Karnataka', country: 'India', lat: 12.914, lon: 74.856, maxDistKm: 120 },
  { name: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.385, lon: 78.486, maxDistKm: 180 },
  { name: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.082, lon: 80.270, maxDistKm: 180 },
  { name: 'Coimbatore', state: 'Tamil Nadu', country: 'India', lat: 11.016, lon: 76.955, maxDistKm: 130 },
  { name: 'Madurai', state: 'Tamil Nadu', country: 'India', lat: 9.925, lon: 78.119, maxDistKm: 130 },
  { name: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.572, lon: 88.363, maxDistKm: 180 },
  { name: 'Siliguri', state: 'West Bengal', country: 'India', lat: 26.727, lon: 88.395, maxDistKm: 130 },
  { name: 'Ahmedabad', state: 'Gujarat', country: 'India', lat: 23.022, lon: 72.571, maxDistKm: 180 },
  { name: 'Surat', state: 'Gujarat', country: 'India', lat: 21.170, lon: 72.831, maxDistKm: 120 },
  { name: 'Vadodara', state: 'Gujarat', country: 'India', lat: 22.307, lon: 73.181, maxDistKm: 110 },
  { name: 'Rajkot', state: 'Gujarat', country: 'India', lat: 22.303, lon: 70.802, maxDistKm: 130 },
  { name: 'Jaipur', state: 'Rajasthan', country: 'India', lat: 26.912, lon: 75.787, maxDistKm: 180 },
  { name: 'Jodhpur', state: 'Rajasthan', country: 'India', lat: 26.238, lon: 73.024, maxDistKm: 150 },
  { name: 'Udaipur', state: 'Rajasthan', country: 'India', lat: 24.585, lon: 73.712, maxDistKm: 130 },
  { name: 'Lucknow', state: 'Uttar Pradesh', country: 'India', lat: 26.846, lon: 80.946, maxDistKm: 180 },
  { name: 'Kanpur', state: 'Uttar Pradesh', country: 'India', lat: 26.449, lon: 80.331, maxDistKm: 120 },
  { name: 'Varanasi', state: 'Uttar Pradesh', country: 'India', lat: 25.317, lon: 82.973, maxDistKm: 130 },
  { name: 'Agra', state: 'Uttar Pradesh', country: 'India', lat: 27.176, lon: 78.008, maxDistKm: 120 },
  { name: 'Patna', state: 'Bihar', country: 'India', lat: 25.594, lon: 85.137, maxDistKm: 180 },
  { name: 'Bhopal', state: 'Madhya Pradesh', country: 'India', lat: 23.259, lon: 77.412, maxDistKm: 180 },
  { name: 'Indore', state: 'Madhya Pradesh', country: 'India', lat: 22.719, lon: 75.857, maxDistKm: 150 },
  { name: 'Gwalior', state: 'Madhya Pradesh', country: 'India', lat: 26.218, lon: 78.182, maxDistKm: 130 },
  { name: 'Chandigarh', state: 'Punjab', country: 'India', lat: 30.733, lon: 76.779, maxDistKm: 150 },
  { name: 'Amritsar', state: 'Punjab', country: 'India', lat: 31.634, lon: 74.872, maxDistKm: 130 },
  { name: 'Ludhiana', state: 'Punjab', country: 'India', lat: 30.901, lon: 75.857, maxDistKm: 120 },
  { name: 'Kochi', state: 'Kerala', country: 'India', lat: 9.931, lon: 76.267, maxDistKm: 130 },
  { name: 'Thiruvananthapuram', state: 'Kerala', country: 'India', lat: 8.524, lon: 76.936, maxDistKm: 120 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India', lat: 17.686, lon: 83.218, maxDistKm: 170 },
  { name: 'Vijayawada', state: 'Andhra Pradesh', country: 'India', lat: 16.506, lon: 80.648, maxDistKm: 140 },
  { name: 'Bhubaneswar', state: 'Odisha', country: 'India', lat: 20.296, lon: 85.824, maxDistKm: 170 },
  { name: 'Ranchi', state: 'Jharkhand', country: 'India', lat: 23.344, lon: 85.309, maxDistKm: 150 },
  { name: 'Raipur', state: 'Chhattisgarh', country: 'India', lat: 21.251, lon: 81.629, maxDistKm: 170 },
  { name: 'Guwahati', state: 'Assam', country: 'India', lat: 26.144, lon: 91.736, maxDistKm: 170 },
  { name: 'Srinagar', state: 'Jammu & Kashmir', country: 'India', lat: 34.083, lon: 74.797, maxDistKm: 150 },
  { name: 'Shimla', state: 'Himachal Pradesh', country: 'India', lat: 31.104, lon: 77.173, maxDistKm: 120 },
  { name: 'Dehradun', state: 'Uttarakhand', country: 'India', lat: 30.316, lon: 78.032, maxDistKm: 130 },
  { name: 'Panaji', state: 'Goa', country: 'India', lat: 15.490, lon: 73.827, maxDistKm: 100 },

  // World Metros
  { name: 'New York', state: 'NY', country: 'United States', lat: 40.712, lon: -74.006, maxDistKm: 220 },
  { name: 'Los Angeles', state: 'CA', country: 'United States', lat: 34.052, lon: -118.243, maxDistKm: 220 },
  { name: 'San Francisco', state: 'CA', country: 'United States', lat: 37.774, lon: -122.419, maxDistKm: 180 },
  { name: 'Chicago', state: 'IL', country: 'United States', lat: 41.878, lon: -87.629, maxDistKm: 220 },
  { name: 'Houston', state: 'TX', country: 'United States', lat: 29.760, lon: -95.369, maxDistKm: 200 },
  { name: 'Miami', state: 'FL', country: 'United States', lat: 25.761, lon: -80.191, maxDistKm: 180 },
  { name: 'Seattle', state: 'WA', country: 'United States', lat: 47.606, lon: -122.332, maxDistKm: 200 },
  { name: 'Toronto', state: 'ON', country: 'Canada', lat: 43.653, lon: -79.383, maxDistKm: 220 },
  { name: 'Vancouver', state: 'BC', country: 'Canada', lat: 49.282, lon: -123.120, maxDistKm: 200 },
  { name: 'Mexico City', state: 'CDMX', country: 'Mexico', lat: 19.432, lon: -99.133, maxDistKm: 220 },
  { name: 'London', state: 'England', country: 'United Kingdom', lat: 51.507, lon: -0.127, maxDistKm: 200 },
  { name: 'Paris', state: 'Île-de-France', country: 'France', lat: 48.856, lon: 2.352, maxDistKm: 200 },
  { name: 'Berlin', state: 'Berlin', country: 'Germany', lat: 52.520, lon: 13.405, maxDistKm: 200 },
  { name: 'Rome', state: 'Lazio', country: 'Italy', lat: 41.902, lon: 12.496, maxDistKm: 200 },
  { name: 'Madrid', state: 'Community of Madrid', country: 'Spain', lat: 40.416, lon: -3.703, maxDistKm: 220 },
  { name: 'Amsterdam', state: 'North Holland', country: 'Netherlands', lat: 52.367, lon: 4.904, maxDistKm: 160 },
  { name: 'Zurich', state: 'Canton of Zurich', country: 'Switzerland', lat: 47.376, lon: 8.541, maxDistKm: 150 },
  { name: 'Tokyo', state: 'Kanto', country: 'Japan', lat: 35.676, lon: 139.650, maxDistKm: 220 },
  { name: 'Osaka', state: 'Kansai', country: 'Japan', lat: 34.693, lon: 135.502, maxDistKm: 160 },
  { name: 'Seoul', state: 'Gyeonggi', country: 'South Korea', lat: 37.566, lon: 126.978, maxDistKm: 200 },
  { name: 'Beijing', state: 'Beijing', country: 'China', lat: 39.904, lon: 116.407, maxDistKm: 220 },
  { name: 'Shanghai', state: 'Shanghai', country: 'China', lat: 31.230, lon: 121.473, maxDistKm: 220 },
  { name: 'Hong Kong', state: 'Hong Kong', country: 'China', lat: 22.319, lon: 114.169, maxDistKm: 120 },
  { name: 'Bangkok', state: 'Bangkok', country: 'Thailand', lat: 13.756, lon: 100.501, maxDistKm: 200 },
  { name: 'Singapore', state: 'Singapore', country: 'Singapore', lat: 1.352, lon: 103.819, maxDistKm: 90 },
  { name: 'Kuala Lumpur', state: 'Federal Territory', country: 'Malaysia', lat: 3.139, lon: 101.686, maxDistKm: 160 },
  { name: 'Jakarta', state: 'Java', country: 'Indonesia', lat: -6.208, lon: 106.845, maxDistKm: 200 },
  { name: 'Sydney', state: 'NSW', country: 'Australia', lat: -33.868, lon: 151.209, maxDistKm: 220 },
  { name: 'Melbourne', state: 'VIC', country: 'Australia', lat: -37.813, lon: 144.963, maxDistKm: 200 },
  { name: 'Cairo', state: 'Cairo Governorate', country: 'Egypt', lat: 30.044, lon: 31.235, maxDistKm: 200 },
  { name: 'Dubai', state: 'Dubai', country: 'United Arab Emirates', lat: 25.204, lon: 55.270, maxDistKm: 160 },
  { name: 'Riyadh', state: 'Riyadh Province', country: 'Saudi Arabia', lat: 24.713, lon: 46.675, maxDistKm: 220 },
  { name: 'São Paulo', state: 'SP', country: 'Brazil', lat: -23.550, lon: -46.633, maxDistKm: 220 },
  { name: 'Buenos Aires', state: 'Buenos Aires', country: 'Argentina', lat: -34.603, lon: -58.381, maxDistKm: 200 }
];

const GLOBAL_WATER_BODIES = [
  { name: 'Bay of Bengal, Indian Ocean', minLat: 5.0, maxLat: 22.5, minLon: 80.0, maxLon: 96.0 },
  { name: 'Arabian Sea, Indian Ocean', minLat: 8.0, maxLat: 26.0, minLon: 55.0, maxLon: 76.5 },
  { name: 'Laccadive Sea, Indian Ocean', minLat: 5.0, maxLat: 13.5, minLon: 71.0, maxLon: 79.5 },
  { name: 'Andaman Sea, Indian Ocean', minLat: 6.0, maxLat: 16.0, minLon: 92.0, maxLon: 99.5 },
  { name: 'Persian Gulf', minLat: 24.0, maxLat: 30.5, minLon: 48.0, maxLon: 56.5 },
  { name: 'Gulf of Oman', minLat: 22.0, maxLat: 26.5, minLon: 56.5, maxLon: 60.5 },
  { name: 'Red Sea', minLat: 12.5, maxLat: 28.5, minLon: 32.5, maxLon: 44.0 },
  { name: 'Gulf of Aden', minLat: 11.0, maxLat: 15.0, minLon: 43.0, maxLon: 51.5 },
  { name: 'Mediterranean Sea', minLat: 30.0, maxLat: 45.5, minLon: -6.0, maxLon: 36.0 },
  { name: 'Black Sea', minLat: 40.5, maxLat: 47.0, minLon: 27.5, maxLon: 41.5 },
  { name: 'Caspian Sea', minLat: 36.5, maxLat: 47.2, minLon: 46.5, maxLon: 55.0 },
  { name: 'Baltic Sea', minLat: 53.5, maxLat: 66.0, minLon: 10.0, maxLon: 30.0 },
  { name: 'North Sea', minLat: 51.0, maxLat: 61.5, minLon: -4.0, maxLon: 9.5 },
  { name: 'Norwegian Sea', minLat: 61.5, maxLat: 72.0, minLon: -5.0, maxLon: 16.0 },
  { name: 'South China Sea', minLat: 3.0, maxLat: 23.0, minLon: 105.0, maxLon: 121.0 },
  { name: 'East China Sea', minLat: 24.0, maxLat: 33.0, minLon: 117.0, maxLon: 131.0 },
  { name: 'Sea of Japan', minLat: 35.0, maxLat: 48.0, minLon: 127.0, maxLon: 142.0 },
  { name: 'Philippine Sea', minLat: 5.0, maxLat: 25.0, minLon: 122.0, maxLon: 145.0 },
  { name: 'Coral Sea', minLat: -25.0, maxLat: -10.0, minLon: 142.0, maxLon: 165.0 },
  { name: 'Tasman Sea', minLat: -45.0, maxLat: -30.0, minLon: 150.0, maxLon: 172.0 },
  { name: 'Gulf of Mexico', minLat: 18.0, maxLat: 31.0, minLon: -98.0, maxLon: -81.0 },
  { name: 'Caribbean Sea', minLat: 9.0, maxLat: 22.5, minLon: -88.0, maxLon: -60.0 },
  { name: 'Hudson Bay', minLat: 51.0, maxLat: 64.0, minLon: -95.0, maxLon: -76.0 },
  { name: 'Bering Sea', minLat: 52.0, maxLat: 66.0, minLon: 162.0, maxLon: -157.0 },
  { name: 'Fram Strait', minLat: 76.0, maxLat: 81.0, minLon: -15.0, maxLon: 20.0 },
  { name: 'Barents Sea', minLat: 68.0, maxLat: 78.0, minLon: 18.0, maxLon: 60.0 },
  { name: 'Kara Sea', minLat: 70.0, maxLat: 81.0, minLon: 60.0, maxLon: 90.0 },
  { name: 'Laptev Sea', minLat: 72.0, maxLat: 81.0, minLon: 105.0, maxLon: 145.0 },
  { name: 'Beaufort Sea', minLat: 70.0, maxLat: 78.0, minLon: -155.0, maxLon: -125.0 },
  { name: 'Northwest Passage', minLat: 68.0, maxLat: 76.0, minLon: -125.0, maxLon: -75.0 },
  { name: 'Weddell Sea', minLat: -78.0, maxLat: -62.0, minLon: -60.0, maxLon: -15.0 },
  { name: 'Ross Sea', minLat: -78.0, maxLat: -65.0, minLon: 160.0, maxLon: -150.0 },
  { name: 'Indian Ocean', minLat: -55.0, maxLat: 5.0, minLon: 40.0, maxLon: 115.0 },
  { name: 'North Atlantic Ocean', minLat: 0.0, maxLat: 60.0, minLon: -75.0, maxLon: -10.0 },
  { name: 'South Atlantic Ocean', minLat: -55.0, maxLat: 0.0, minLon: -50.0, maxLon: 15.0 },
  { name: 'North Pacific Ocean', minLat: 0.0, maxLat: 60.0, minLon: 120.0, maxLon: -120.0 },
  { name: 'South Pacific Ocean', minLat: -55.0, maxLat: 0.0, minLon: 145.0, maxLon: -70.0 },
  { name: 'Southern Ocean', minLat: -85.0, maxLat: -55.0, minLon: -180.0, maxLon: 180.0 },
  { name: 'Arctic Ocean', minLat: 70.0, maxLat: 90.0, minLon: -180.0, maxLon: 180.0 }
];

const GLOBAL_LAND_REGIONS = [
  { name: 'Maharashtra, India', minLat: 15.6, maxLat: 22.0, minLon: 72.6, maxLon: 80.9 },
  { name: 'Gujarat, India', minLat: 20.1, maxLat: 24.7, minLon: 68.1, maxLon: 74.4 },
  { name: 'Karnataka, India', minLat: 11.5, maxLat: 18.5, minLon: 74.0, maxLon: 78.6 },
  { name: 'Tamil Nadu, India', minLat: 8.1, maxLat: 13.5, minLon: 76.2, maxLon: 80.3 },
  { name: 'Kerala, India', minLat: 8.3, maxLat: 12.8, minLon: 74.9, maxLon: 77.4 },
  { name: 'Andhra Pradesh, India', minLat: 12.6, maxLat: 19.1, minLon: 76.7, maxLon: 84.8 },
  { name: 'Telangana, India', minLat: 15.8, maxLat: 19.9, minLon: 77.2, maxLon: 81.8 },
  { name: 'Madhya Pradesh, India', minLat: 21.3, maxLat: 26.9, minLon: 74.0, maxLon: 82.8 },
  { name: 'Uttar Pradesh, India', minLat: 23.9, maxLat: 30.4, minLon: 77.1, maxLon: 84.6 },
  { name: 'Rajasthan, India', minLat: 23.0, maxLat: 30.2, minLon: 69.5, maxLon: 78.3 },
  { name: 'West Bengal, India', minLat: 21.5, maxLat: 27.2, minLon: 85.8, maxLon: 89.9 },
  { name: 'Bihar, India', minLat: 24.3, maxLat: 27.5, minLon: 83.3, maxLon: 88.3 },
  { name: 'Odisha, India', minLat: 17.8, maxLat: 22.6, minLon: 81.4, maxLon: 87.5 },
  { name: 'Punjab & Haryana, India', minLat: 27.6, maxLat: 32.5, minLon: 73.8, maxLon: 77.6 },
  { name: 'Himachal Pradesh, India', minLat: 30.4, maxLat: 33.2, minLon: 75.8, maxLon: 79.0 },
  { name: 'Uttarakhand, India', minLat: 28.7, maxLat: 31.5, minLon: 77.6, maxLon: 81.0 },
  { name: 'Jammu & Kashmir, India', minLat: 32.3, maxLat: 37.1, minLon: 73.5, maxLon: 80.3 },
  { name: 'Assam & Northeast, India', minLat: 22.0, maxLat: 29.5, minLon: 89.5, maxLon: 97.4 },
  { name: 'India', minLat: 8.0, maxLat: 37.0, minLon: 68.0, maxLon: 97.0 }
];

function haversineDistKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDetailedGeographicalPlace(lat, lon) {
  const normLon = ((((lon + 180) % 360) + 360) % 360) - 180;

  // 1. Check proximity to major global/metro cities (City, State, Country)
  let closestCity = null;
  let minCityDist = Infinity;
  for (const c of GLOBAL_GAZETTEER_CITIES) {
    const d = haversineDistKm(lat, normLon, c.lat, c.lon);
    if (d < minCityDist && d <= c.maxDistKm) {
      minCityDist = d;
      closestCity = c;
    }
  }
  if (closestCity) {
    return closestCity.state
      ? `${closestCity.name}, ${closestCity.state}, ${closestCity.country}`
      : `${closestCity.name}, ${closestCity.country}`;
  }

  // 2. Check specific water bodies (bays, seas, gulfs)
  for (const w of GLOBAL_WATER_BODIES) {
    if (lat >= w.minLat && lat <= w.maxLat && normLon >= w.minLon && normLon <= w.maxLon) {
      return w.name;
    }
  }

  // 3. Check regional state/province bounds
  for (const r of GLOBAL_LAND_REGIONS) {
    if (lat >= r.minLat && lat <= r.maxLat && normLon >= r.minLon && normLon <= r.maxLon) {
      return r.name;
    }
  }

  // 4. Arctic & Antarctic cryosphere fallbacks
  if (lat >= 85.5) return 'Central Arctic Pack';
  if (lat < -55.0) return 'Southern Ocean Pack';
  if (normLon >= 40 && normLon < 110 && lat < 25) return 'Indian Ocean Basin';
  if (normLon >= -60 && normLon < 15) return 'Atlantic Basin';
  return 'Pacific Basin';
}

function getArcticSeaName(lat, lon) {
  return getDetailedGeographicalPlace(lat, lon);
}

function getLayerIdForYear(yearInt, domain = getActiveDomain().id) {
  if (domain === 'air') return 'MERRA2_Aerosol_Optical_Depth_Analysis_Monthly';
  if (domain === 'greenness') return 'MODIS_Terra_L3_NDVI_Monthly';
  if (domain === 'temperature') return 'MERRA2_2m_Air_Temperature_Monthly';
  if (domain === 'rainfall') return 'IMERG_Precipitation_Rate';
  for (const l of config.story.layersByYear) {
    if (yearInt >= l.from && yearInt <= l.to) return l.id;
  }
  return 'AMSRU2_Sea_Ice_Concentration_12km';
}

const BACKEND_ENABLED = window.location.protocol === 'http:' || window.location.protocol === 'https:';
function getClientSessionId() {
  try {
    let sid = localStorage.getItem('ej_session_id');
    if (!sid) {
      sid = 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('ej_session_id', sid);
    }
    return sid;
  } catch (e) {
    return 'default';
  }
}
const CLIENT_SESSION_ID = getClientSessionId();

async function apiRequest(path, options = {}) {
  if (!BACKEND_ENABLED) return null;
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function buildGibsWmsUrl(yearInt, dayOffset = 0, domain = getActiveDomain().id) {
  if (BACKEND_ENABLED && dayOffset === 0) {
    return domain === 'ice' ? `/api/gibs/${yearInt}` : `/api/gibs/${domain}/${yearInt}`;
  }
  const dt = new Date(Date.UTC(yearInt, config.story.sampleMonth - 1, config.story.sampleDay + dayOffset));
  const yyyy = String(dt.getUTCFullYear());
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const layer = encodeURIComponent(getLayerIdForYear(yearInt, domain));
  return 'https://gibs.earthdata.nasa.gov/wms/epsg4326/all/wms.cgi?CRS=EPSG:4326&FORMAT=image/png&LAYERS=' +
    layer + '&REQUEST=GetMap&SERVICE=WMS&STYLES=default&VERSION=1.3.0&TRANSPARENT=true&WIDTH=1024&HEIGHT=512&BBOX=-90,-180,90,180&TIME=' +
    yyyy + '-' + mm + '-' + dd;
}

function decodeGibsRainbowPixel(r, g, b, a) {
  if (a < 20) return 0.0;
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const maxC = Math.max(rn, gn, bn), minC = Math.min(rn, gn, bn);
  if (maxC > 0.80 && minC > 0.62) return Math.min(1.0, 0.86 + (minC - 0.62) * 0.36);
  const delta = maxC - minC;
  if (delta < 0.05) return maxC * 0.9;
  let hue = 0;
  if (maxC === rn) hue = (((gn - bn) / delta) * 60 + 360) % 360;
  else if (maxC === gn) hue = (((bn - rn) / delta) + 2) * 60;
  else hue = (((rn - gn) / delta) + 4) * 60;
  if (hue >= 285) return Math.min(0.96, 0.82 + ((hue - 285) / 75) * 0.14);
  const clampedHue = Math.min(265, Math.max(0, hue));
  return Math.min(0.88, Math.max(0.0, (1.0 - clampedHue / 265) * 0.84));
}

