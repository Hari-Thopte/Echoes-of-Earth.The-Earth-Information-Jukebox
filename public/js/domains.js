// =============================================================
// MULTI-DOMAIN EARTH JUKEBOX PROFILES
// Supports: Arctic Sea Ice, Air Quality, Greenness, Temperature, Rainfall
// =============================================================
const EARTH_DOMAINS = {
  ice: {
    id: 'ice',
    modeIndex: 0.0,
    name: 'Arctic Sea Ice',
    shortName: 'Arctic',
    icon: '',
    badgeDefault: 'AMSR-E / AMSR2 12km',
    heroBadge: 'NASA Space Apps: The Earth Information Jukebox',
    heroTitle: 'Earth Jukebox: Arctic',
    heroSubtitle: 'Explore 23 years of satellite Arctic sea-ice observations (2003–2025) through 3D subsurface pack-ice rendering, orbital telemetry, and real-time harmonic synthesis.',
    telemetryTitle: 'Cryosphere Telemetry',
    seriesTag: 'NSIDC v4 • M km²',
    accentColor: '#38bdf8',
    legendGradient: 'linear-gradient(90deg, rgba(2, 132, 199, 0.7), #38bdf8 55%, #e0f2fe 100%)',
    legendText: '15% Marginal → 100% Multi-Year Pack',
    closingCaption: 'ARCTIC SEA ICE, 1 SEPTEMBER, 2003–2025',
    soundKeyText: 'Higher pitch and warmer chords represent thicker Arctic sea ice',
    radarTitlePrefix: 'Arctic Radar',
    unitLabel: ' M km²',
    kpiLabelMain: 'Sept Extent',
    kpiLabelSecondary: 'Multi-Yr Pack',
    hoverPrefix: 'Pack Ice',
    drawerMetricTitle: 'Regional Pack Concentration',
    buoyNoun: 'Acoustic Sonar Buoy',
    buoyShort: 'BUOY',
    minHoverLat: 56.0,
    mapMode: 'polar',
    framing: { lat: 82.0, lon: 0.0, distance: 4.45 },
    formatValue: (v) => `${Number(v).toFixed(2)} M km²`,
    formatDiff: (d) => `${d >= 0 ? '+' : ''}${Number(d).toFixed(2)} M km²`,
    formatSecondary: (norm) => `${Math.round(28 + norm * 38)}%`,
    formatHoverConc: (conc) => `${Math.round(conc * 100)}%`,
    baselineSeries: {
      2003: 6.12, 2004: 5.98, 2005: 5.50, 2006: 5.86, 2007: 4.27,
      2008: 4.69, 2009: 5.26, 2010: 4.87, 2011: 4.56, 2012: 3.57,
      2013: 5.21, 2014: 5.22, 2015: 4.62, 2016: 4.53, 2017: 4.82,
      2018: 4.79, 2019: 4.36, 2020: 4.00, 2021: 4.95, 2022: 4.90,
      2023: 4.38, 2024: 4.35, 2025: 4.75
    },
    audio: {
      scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'],
      chordSets: {
        high: [['C3', 'G3', 'D4', 'E4'], ['F2', 'C3', 'G3', 'A3'], ['A2', 'E3', 'B3', 'C4']],
        mid: [['A2', 'E3', 'G3', 'C4'], ['F2', 'C3', 'E3', 'A3'], ['D3', 'A3', 'C4', 'F4']],
        low: [['A2', 'E3', 'B3'], ['F2', 'C3', 'G3']]
      },
      filterType: 'lowpass',
      descHigh: 'warm major harmonics (dense pack ice)',
      descMid: 'balanced mid-register chords',
      descLow: 'sparse minor voicings (retreated ice)'
    },
    regions: {
      pole: {
        label: '90°N Basin',
        title: 'Central Arctic Basin (85°N)',
        lat: 85.0, lon: 0.0, dist: 3.95,
        desc: 'Top-down orbital framing of the entire Arctic Ocean comparing the active year against the 2003 golden baseline contour.'
      },
      beaufort: {
        label: 'Beaufort Gyre',
        title: 'Beaufort Sea (74°N, 140°W)',
        lat: 74.0, lon: -140.0, dist: 3.3,
        desc: 'Historically the primary reservoir for thick multi-year pack ice, the Beaufort Gyre now experiences major late-summer melt and lower harmonic voicings.'
      },
      nwpassage: {
        label: 'NW Passage',
        title: 'Northwest Passage (74°N, 98°W)',
        lat: 74.0, lon: -98.0, dist: 3.3,
        desc: 'Threading through the Canadian Arctic Archipelago, seasonal shipping channels here have increasingly cleared of 15%+ pack ice compared to 2003.'
      },
      fram: {
        label: 'Fram Strait',
        title: 'Fram Strait & Svalbard (79°N, 2°E)',
        lat: 79.0, lon: 2.0, dist: 3.3,
        desc: 'Situated between Greenland and Svalbard, Fram Strait is the primary deep-water gateway where Arctic pack ice exports south into the Atlantic.'
      },
      laptev: {
        label: 'Laptev Nursery',
        title: 'Laptev Sea (76°N, 125°E)',
        lat: 76.0, lon: 125.0, dist: 3.3,
        desc: 'Known as the Arctic "ice factory," the Laptev Sea forms new seasonal ice each autumn—but warmer summer waters have pushed the September edge far north.'
      }
    },
    storyBeats: [
      { year: 2003, duration: 5.5, msg: '2003: Thick multi-year sea ice blankets the Arctic basin.' },
      { year: 2007, duration: 7.5, msg: '2007: Sudden September melt opens the Northwest Passage.' },
      { year: 2012, duration: 9.0, msg: '2012: Historic satellite record low Arctic sea ice minimum (3.57 M km²).' },
      { year: 2025, duration: 9.0, msg: '2025: Warm waters continue reshaping the cryosphere.' }
    ]
  },

  antarctica: {
    id: 'antarctica',
    modeIndex: 5.0,
    name: 'Antarctic Sea Ice',
    shortName: 'Antarctica',
    icon: '',
    badgeDefault: 'AMSR-E / AMSR2 South',
    heroBadge: 'NASA Space Apps: The Earth Information Jukebox',
    heroTitle: 'Earth Jukebox: Antarctica',
    heroSubtitle: 'Explore 23 years of Southern Ocean sea ice encircling Antarctica (2003–2025)—from the 2014 winter expansion record to the sharp 2023 retreat.',
    telemetryTitle: 'Antarctic Telemetry',
    seriesTag: 'NSIDC v4 • M km²',
    accentColor: '#10b981',
    legendGradient: 'linear-gradient(90deg, rgba(6, 78, 59, 0.7), #10b981 55%, #a7f3d0 100%)',
    legendText: '15% Sea-Ice Edge → 100% Austral Pack',
    closingCaption: 'ANTARCTIC SEA ICE, 1 SEPTEMBER, 2003–2025',
    soundKeyText: 'Deep resonant Antarctic voicings reflect winter pack extent around the continent',
    radarTitlePrefix: 'Antarctic Radar',
    unitLabel: ' M km²',
    kpiLabelMain: 'Ice Extent',
    kpiLabelSecondary: 'Austral Pack',
    hoverPrefix: 'Austral Ice',
    drawerMetricTitle: 'Regional Austral Ice Concentration',
    buoyNoun: 'Southern Sonar Buoy',
    buoyShort: 'ANT',
    minHoverLat: -90.0,
    maxHoverLat: -50.0,
    mapMode: 'south_polar',
    framing: { lat: -82.0, lon: 0.0, distance: 4.55 },
    formatValue: (v) => `${Number(v).toFixed(2)} M km²`,
    formatDiff: (d) => `${d >= 0 ? '+' : ''}${Number(d).toFixed(2)} M km²`,
    formatSecondary: (norm) => `${Math.round(32 + norm * 36)}%`,
    formatHoverConc: (conc) => `${Math.round(conc * 100)}%`,
    baselineSeries: {
      2003: 18.30, 2004: 18.92, 2005: 18.80, 2006: 19.09, 2007: 18.86,
      2008: 18.15, 2009: 18.96, 2010: 18.80, 2011: 18.74, 2012: 19.21,
      2013: 19.39, 2014: 19.76, 2015: 18.44, 2016: 18.15, 2017: 17.91,
      2018: 17.96, 2019: 18.33, 2020: 18.84, 2021: 18.51, 2022: 18.06,
      2023: 16.89, 2024: 17.15, 2025: 17.64
    },
    audio: {
      scale: ['G3', 'A3', 'Bb3', 'D4', 'E4', 'G4', 'A4', 'Bb4', 'D5'],
      chordSets: {
        high: [['G2', 'D3', 'A3', 'Bb3'], ['C3', 'G3', 'D4', 'E4'], ['Eb3', 'Bb3', 'F4', 'G4']],
        mid: [['G2', 'D3', 'F3', 'Bb3'], ['C3', 'G3', 'Bb3', 'D4'], ['F2', 'C3', 'G3', 'A3']],
        low: [['G2', 'D3', 'Bb3'], ['Eb2', 'Bb2', 'F3']]
      },
      filterType: 'lowpass',
      descHigh: 'expansive austral sea-ice chords (winter peak)',
      descMid: 'circumpolar shelf ice harmonics',
      descLow: 'retreated 2023 low Antarctic voicings'
    },
    regions: {
      south_pole: {
        label: '90°S Ring',
        title: 'Antarctic Circumpolar Ring (82°S)',
        lat: -82.0, lon: 0.0, dist: 4.05,
        desc: 'South-polar view encircling the Antarctic ice sheet, where winter sea ice expands millions of square kilometers across the Southern Ocean.'
      },
      weddell: {
        label: 'Weddell Sea',
        title: 'Weddell Sea Gyre (68°S, 42°W)',
        lat: -68.0, lon: -42.0, dist: 3.35,
        desc: 'East of the Antarctic Peninsula, the Weddell Gyre traps thick perennial sea ice against the Ronne-Filchner Ice Shelf.'
      },
      ross: {
        label: 'Ross Sea',
        title: 'Ross Sea Polynya (72°S, 175°E)',
        lat: -72.0, lon: 175.0, dist: 3.35,
        desc: 'Fierce katabatic winds sweep newly formed ice seaward from the Ross Ice Shelf, exporting cold salty water into the abyssal ocean.'
      },
      amundsen: {
        label: 'Amundsen Sea',
        title: 'Amundsen & Bellingshausen (71.5°S, 110°W)',
        lat: -71.5, lon: -110.0, dist: 3.35,
        desc: 'Neighboring Pine Island & Thwaites glaciers, steep sea-ice losses here expose fragile ice shelves directly to ocean swell.'
      },
      e_antarctica: {
        label: 'Wilkes Coast',
        title: 'Wilkes & Enderby Land (65.5°S, 115°E)',
        lat: -65.5, lon: 115.0, dist: 3.35,
        desc: 'Narrow seasonal pack ice along East Antarctica saw dramatic winter anomalies during the 2023 circumpolar deficit.'
      }
    },
    storyBeats: [
      { year: 2003, duration: 5.5, msg: '2003: Seasonal winter pack encircles the Antarctic continent (18.30 M km²).' },
      { year: 2014, duration: 7.5, msg: '2014: Winds push Antarctic winter sea ice to record high (19.76 M km²).' },
      { year: 2023, duration: 9.0, msg: '2023: Historic crash — Antarctic winter sea ice plunges to 16.89 M km².' },
      { year: 2025, duration: 9.0, msg: '2025: Persistent Southern Ocean warmth suppresses winter freeze.' }
    ]
  },

  air: {
    id: 'air',
    modeIndex: 1.0,
    name: 'Air Quality & Aerosols',
    shortName: 'Air',
    icon: '',
    badgeDefault: 'MODIS / OMPS AOD 10km',
    heroBadge: 'NASA Space Apps: The Earth Information Jukebox',
    heroTitle: 'Earth Jukebox: Air',
    heroSubtitle: 'Listen to 23 years of global atmospheric aerosols, Saharan dust plumes, and wildfire smoke (2003–2025) rendered as volumetric haze & breathy Dorian chords.',
    telemetryTitle: 'Atmosphere Telemetry',
    seriesTag: 'MODIS Terra • AOD',
    accentColor: '#fbbf24',
    legendGradient: 'linear-gradient(90deg, rgba(14,165,233,0.4), #fbbf24 55%, #ef4444 100%)',
    legendText: 'Clean 0.05 AOD → Dense Haze 0.90+ AOD',
    closingCaption: 'GLOBAL AEROSOL OPTICAL DEPTH, 2003–2025',
    soundKeyText: 'Brighter shimmer and higher voicings indicate dense aerosol plumes and haze',
    radarTitlePrefix: 'Global AOD',
    unitLabel: ' AOD',
    kpiLabelMain: 'Global AOD',
    kpiLabelSecondary: 'Clean Air Pct',
    hoverPrefix: 'Aerosol AOD',
    drawerMetricTitle: 'Regional Aerosol Optical Depth',
    buoyNoun: 'Atmospheric Sensor',
    buoyShort: 'AIR',
    minHoverLat: -85.0,
    mapMode: 'global',
    framing: { lat: 24.0, lon: 60.0, distance: 4.65 },
    formatValue: (v) => `${Number(v).toFixed(3)}`,
    formatDiff: (d) => `${d > 0 ? '+' : ''}${d.toFixed(3)}`,
    formatSecondary: (norm) => `${Math.round(88 - norm * 24)}%`,
    formatHoverConc: (conc) => `${(conc * 0.95).toFixed(2)} AOD`,
    baselineSeries: {
      2003: 0.176, 2004: 0.172, 2005: 0.175, 2006: 0.175, 2007: 0.181,
      2008: 0.180, 2009: 0.180, 2010: 0.180, 2011: 0.187, 2012: 0.184,
      2013: 0.176, 2014: 0.177, 2015: 0.190, 2016: 0.177, 2017: 0.173,
      2018: 0.177, 2019: 0.180, 2020: 0.182, 2021: 0.175, 2022: 0.180,
      2023: 0.182, 2024: 0.179, 2025: 0.163
    },
    audio: {
      scale: ['D4', 'E4', 'F4', 'A4', 'B4', 'C5', 'D5', 'E5', 'A5'],
      chordSets: {
        high: [['D3', 'A3', 'E4', 'F4'], ['G2', 'D3', 'A3', 'B3'], ['C3', 'G3', 'D4', 'E4']],
        mid: [['D3', 'A3', 'C4', 'F4'], ['A2', 'E3', 'G3', 'C4'], ['G2', 'D3', 'F3', 'B3']],
        low: [['D3', 'A3', 'E4'], ['A2', 'E3', 'B3']]
      },
      filterType: 'bandpass',
      descHigh: 'dense atmospheric shimmer (heavy aerosol plume)',
      descMid: 'moderate dust & urban haze harmonics',
      descLow: 'clear sky pure sine breath'
    },
    regions: {
      global_air: {
        label: 'Global Sky',
        title: 'Afro-Asian Aerosol Belt (24°N, 60°E)',
        lat: 24.0, lon: 60.0, dist: 4.35,
        desc: 'Orbital view across Earth’s primary mineral-dust and anthropogenic aerosol corridor stretching from the Sahara across South & East Asia.'
      },
      indo_gangetic: {
        label: 'Indo-Gangetic',
        title: 'Indo-Gangetic Airshed (26.8°N, 80.9°E)',
        lat: 26.8, lon: 80.9, dist: 3.3,
        desc: 'Topography traps winter boundary-layer haze, agricultural smoke, and fine particulate matter south of the Himalaya wall.'
      },
      sahara: {
        label: 'Sahara Plume',
        title: 'Sahara Bodélé Dust Belt (19.5°N, 5°E)',
        lat: 19.5, lon: 5.0, dist: 3.4,
        desc: 'The world’s largest mineral dust engine lifts iron-rich plumes across the Atlantic each summer, fertilizing the Amazon basin.'
      },
      east_asia: {
        label: 'North China',
        title: 'North China Plain (37.5°N, 116.5°E)',
        lat: 37.5, lon: 116.5, dist: 3.3,
        desc: 'Clear-air policy shifts after 2013 drove steep reductions in sulfate aerosols across eastern China over the past decade.'
      },
      amazon_smoke: {
        label: 'Amazon Smoke',
        title: 'Southern Amazon Fire Arc (8°S, 60°W)',
        lat: -8.0, lon: -60.0, dist: 3.4,
        desc: 'Dry-season biomass burning peaks each August–October, injecting dark carbon plumes into the South American troposphere.'
      }
    },
    storyBeats: [
      { year: 2003, duration: 5.5, msg: '2003: Baseline Saharan dust plumes & early-2000s urban haze.' },
      { year: 2013, duration: 7.5, msg: '2013: Peak industrial sulfate loading across East & South Asia.' },
      { year: 2020, duration: 8.5, msg: '2020: Pandemic lockdowns curbed urban haze, but mega-wildfires kept global AOD steady.' },
      { year: 2023, duration: 9.5, msg: '2023: Record boreal wildfire smoke events pour aerosols across the Northern Hemisphere.' }
    ]
  },

  greenness: {
    id: 'greenness',
    modeIndex: 2.0,
    name: 'Vegetation Greenness',
    shortName: 'Greenness',
    icon: '',
    badgeDefault: 'MODIS NDVI 16-Day',
    heroBadge: 'NASA Space Apps: The Earth Information Jukebox',
    heroTitle: 'Earth Jukebox: Greenness',
    heroSubtitle: 'Hear Earth’s living terrestrial canopy breathe across seasons and decades (2003–2025) through global NDVI vegetation density and Lydian biosphere voicings.',
    telemetryTitle: 'Biosphere Telemetry',
    seriesTag: 'MODIS Terra • NDVI',
    accentColor: '#34d399',
    legendGradient: 'linear-gradient(90deg, rgba(161,98,7,0.75), #84cc16 50%, #10b981 100%)',
    legendText: 'Arid 0.10 NDVI → Lush Canopy 0.90 NDVI',
    closingCaption: 'GLOBAL VEGETATION GREENNESS (NDVI), 2003–2025',
    soundKeyText: 'Richer emerald harmonics & rising Lydian intervals reflect dense forest canopy',
    radarTitlePrefix: 'Global NDVI',
    unitLabel: ' NDVI',
    kpiLabelMain: 'Mean NDVI',
    kpiLabelSecondary: 'Lush Canopy',
    hoverPrefix: 'Canopy NDVI',
    drawerMetricTitle: 'Regional Vegetation Greenness',
    buoyNoun: 'Biosphere Probe',
    buoyShort: 'NDVI',
    minHoverLat: -85.0,
    mapMode: 'global',
    framing: { lat: 8.0, lon: -45.0, distance: 4.65 },
    formatValue: (v) => `${Number(v).toFixed(3)}`,
    formatDiff: (d) => `${d > 0 ? '+' : ''}${d.toFixed(3)}`,
    formatSecondary: (norm) => `${Math.round(42 + norm * 28)}%`,
    formatHoverConc: (conc) => `${(conc * 0.92).toFixed(2)} NDVI`,
    baselineSeries: {
      2003: 0.419, 2004: 0.422, 2005: 0.422, 2006: 0.423, 2007: 0.424,
      2008: 0.419, 2009: 0.420, 2010: 0.425, 2011: 0.429, 2012: 0.426,
      2013: 0.427, 2014: 0.429, 2015: 0.430, 2016: 0.432, 2017: 0.432,
      2018: 0.428, 2019: 0.429, 2020: 0.435, 2021: 0.433, 2022: 0.432,
      2023: 0.436, 2024: 0.440, 2025: 0.442
    },
    audio: {
      scale: ['F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'G5', 'A5'],
      chordSets: {
        high: [['F3', 'C4', 'G4', 'A4'], ['D3', 'A3', 'E4', 'B4'], ['C3', 'G3', 'D4', 'E4']],
        mid: [['F3', 'C4', 'E4', 'A4'], ['D3', 'A3', 'C4', 'F4'], ['G3', 'D4', 'F4', 'A4']],
        low: [['D3', 'A3', 'E4'], ['A2', 'E3', 'G3']]
      },
      filterType: 'lowpass',
      descHigh: 'lush Lydian rainforest harmonies',
      descMid: 'temperate savanna & cropland voicings',
      descLow: 'arid desert sparse chimes'
    },
    regions: {
      global_green: {
        label: 'Global Canopy',
        title: 'Tropical & Boreal Green Belt (8°N, 45°W)',
        lat: 8.0, lon: -45.0, dist: 4.35,
        desc: 'Satellite NDVI tracks chlorophyll reflectance across Earth’s continents, capturing Amazon humidity, Sahel regreening, and northern leaf-out.'
      },
      amazon: {
        label: 'Amazon Basin',
        title: 'Central Amazon Rainforest (3.5°S, 62°W)',
        lat: -3.5, lon: -62.0, dist: 3.3,
        desc: 'Earth’s largest terrestrial carbon sink maintains NDVI above 0.80 year-round, punctuated by severe El Niño drought dips in 2010 and 2015–16.'
      },
      congo: {
        label: 'Congo Forest',
        title: 'Congo River Basin (0.5°N, 22°E)',
        lat: 0.5, lon: 22.0, dist: 3.3,
        desc: 'Deep equatorial cloud-forest canopy anchoring Central Africa’s rainfall recycling engine.'
      },
      boreal: {
        label: 'Boreal Taiga',
        title: 'Siberian Boreal Forest (61°N, 95°E)',
        lat: 61.0, lon: 95.0, dist: 3.4,
        desc: 'Northern warming has lengthened the boreal growing season, driving measurable Arctic-subarctic greening—alongside rising wildfire scars.'
      },
      sahel: {
        label: 'Sahel Belt',
        title: 'Central Sahel Savanna (13.5°N, 12°E)',
        lat: 13.5, lon: 12.0, dist: 3.4,
        desc: 'A sensitive semi-arid transition zone where wet-season monsoon pulses trigger vivid annual waves of savanna greenness.'
      }
    },
    storyBeats: [
      { year: 2003, duration: 5.5, msg: '2003: Baseline terrestrial NDVI across tropical and boreal forests.' },
      { year: 2010, duration: 7.5, msg: '2010: Severe Amazon drought briefly browns millions of sq km.' },
      { year: 2020, duration: 8.5, msg: '2020: Boreal leaf-out & cropland growth elevate global greening.' },
      { year: 2025, duration: 9.5, msg: '2025: Greening continues in high latitudes while tropics face heat stress.' }
    ]
  },

  temperature: {
    id: 'temperature',
    modeIndex: 3.0,
    name: 'Surface Temperature',
    shortName: 'Temp',
    icon: '',
    badgeDefault: 'GISTEMP / MODIS LST',
    heroBadge: 'NASA Space Apps: The Earth Information Jukebox',
    heroTitle: 'Earth Jukebox: Temperature',
    heroSubtitle: 'Experience 23 years of planetary warming anomalies (2003–2025) through global thermal maps, Arctic amplification, and ascending harmonic tension.',
    telemetryTitle: 'Thermal Telemetry',
    seriesTag: 'NASA GISTEMP v4 • °C',
    accentColor: '#fb7185',
    legendGradient: 'linear-gradient(90deg, #3b82f6 0%, #fbbf24 50%, #fb7185 100%)',
    legendText: 'Cool −0.5°C → Warm +2.0°C+ Anomaly',
    closingCaption: 'GLOBAL SURFACE TEMPERATURE ANOMALY, 2003–2025',
    soundKeyText: 'Ascending pitch tension and bright shimmer track positive thermal anomalies',
    radarTitlePrefix: 'Global Temp',
    unitLabel: '°C',
    kpiLabelMain: 'Global Anomaly',
    kpiLabelSecondary: 'Arctic Amp.',
    hoverPrefix: 'Temp Anomaly',
    drawerMetricTitle: 'Regional Temperature Anomaly',
    buoyNoun: 'Thermal Sensor',
    buoyShort: 'TEMP',
    minHoverLat: -85.0,
    mapMode: 'global',
    framing: { lat: 35.0, lon: 20.0, distance: 4.65 },
    formatValue: (v) => `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}°C`,
    formatDiff: (d) => `${d >= 0 ? '+' : ''}${d.toFixed(2)}°C`,
    formatSecondary: (norm) => `+${(1.2 + norm * 2.4).toFixed(1)}°C`,
    formatHoverConc: (conc) => {
      const deg = (conc - 0.35) * 3.2;
      return `${deg >= 0 ? '+' : ''}${deg.toFixed(1)}°C`;
    },
    baselineSeries: {
      2003: 0.62, 2004: 0.54, 2005: 0.68, 2006: 0.64, 2007: 0.66,
      2008: 0.54, 2009: 0.65, 2010: 0.72, 2011: 0.61, 2012: 0.65,
      2013: 0.68, 2014: 0.75, 2015: 0.90, 2016: 1.02, 2017: 0.93,
      2018: 0.85, 2019: 0.98, 2020: 1.02, 2021: 0.85, 2022: 0.89,
      2023: 1.17, 2024: 1.29, 2025: 1.19
    },
    audio: {
      scale: ['A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5', 'E5'],
      chordSets: {
        high: [['A3', 'E4', 'F4', 'C5'], ['D3', 'A3', 'E4', 'G4'], ['E3', 'B3', 'G4', 'C5']],
        mid: [['A2', 'E3', 'C4', 'D4'], ['F2', 'C3', 'G3', 'A3'], ['D3', 'A3', 'C4', 'F4']],
        low: [['A2', 'E3', 'C4'], ['D3', 'A3', 'F4']]
      },
      filterType: 'lowpass',
      descHigh: 'elevated warm thermal tension (+1.2°C spike)',
      descMid: 'steady planetary warming register',
      descLow: 'cooler La Niña baseline interval'
    },
    regions: {
      global_temp: {
        label: 'Global Thermal',
        title: 'Global Surface Anomaly (35°N, 20°E)',
        lat: 35.0, lon: 20.0, dist: 4.35,
        desc: 'Landmasses warm nearly twice as fast as oceans while Arctic polar amplification accelerates high-latitude heat anomalies.'
      },
      arctic_amp: {
        label: 'Arctic Amp.',
        title: 'Barents-Kara Warming Hotspot (75°N, 40°E)',
        lat: 75.0, lon: 40.0, dist: 3.4,
        desc: 'Loss of reflective sea ice creates a strong ice-albedo feedback, warming the high Arctic 3–4× faster than the global average.'
      },
      europe_heat: {
        label: 'Mediterranean',
        title: 'Mediterranean & Southern Europe (41°N, 14°E)',
        lat: 41.0, lon: 14.0, dist: 3.3,
        desc: 'Rapidly intensifying summer heatwaves and marine heat domes across the Mediterranean basin.'
      },
      sw_usa: {
        label: 'SW N. America',
        title: 'Southwestern North America (35°N, 112°W)',
        lat: 35.0, lon: -112.0, dist: 3.3,
        desc: 'Persistent subtropical high-pressure ridges driving multi-decade aridification and extreme daytime land surface temperatures.'
      },
      siberia_heat: {
        label: 'Siberia Tundra',
        title: 'Central Siberian Plateau (64°N, 105°E)',
        lat: 64.0, lon: 105.0, dist: 3.4,
        desc: 'Site of dramatic spring heat anomalies—including +5°C+ regional excursions thawing deep permafrost carbon.'
      }
    },
    storyBeats: [
      { year: 2003, duration: 5.5, msg: '2003: Early-21st-century warming stands near +0.62°C above 1951–80 mean.' },
      { year: 2016, duration: 7.5, msg: '2016: Super El Niño drives global anomaly past +1.02°C.' },
      { year: 2023, duration: 8.5, msg: '2023: Unprecedented ocean & land warmth breaks records at +1.17°C.' },
      { year: 2024, duration: 9.5, msg: '2024–25: Peak planetary warmth reaches +1.29°C with Arctic amp.' }
    ]
  },

  rainfall: {
    id: 'rainfall',
    modeIndex: 4.0,
    name: 'Global Rainfall & Monsoon',
    shortName: 'Rainfall',
    icon: '',
    badgeDefault: 'TRMM / GPM IMERG',
    heroBadge: 'NASA Space Apps: The Earth Information Jukebox',
    heroTitle: 'Earth Jukebox: Rainfall',
    heroSubtitle: 'Hear Earth’s tropical monsoons, atmospheric rivers, and ENSO storm tracks (2003–2025) through animated precipitation bands and sparkling raindrop arpeggios.',
    telemetryTitle: 'Hydrosphere Telemetry',
    seriesTag: 'GPCP v2.3 • mm/d',
    accentColor: '#60a5fa',
    legendGradient: 'linear-gradient(90deg, rgba(30, 58, 138, 0.7), #3b82f6 55%, #93c5fd 100%)',
    legendText: 'Dry 0 mm/d → Heavy Monsoon 25+ mm/d',
    closingCaption: 'GLOBAL PRECIPITATION RATE (IMERG), 2003–2025',
    soundKeyText: 'Dense kalimba raindrops & bright violet swells signal convective monsoon deluges',
    radarTitlePrefix: 'Global Rain',
    unitLabel: ' mm/d',
    kpiLabelMain: 'Global Rain',
    kpiLabelSecondary: 'Storm Cores',
    hoverPrefix: 'Precip Rate',
    drawerMetricTitle: 'Regional Precipitation Intensity',
    buoyNoun: 'Rain Gauge Node',
    buoyShort: 'RAIN',
    minHoverLat: -85.0,
    mapMode: 'global',
    framing: { lat: 10.0, lon: 85.0, distance: 4.65 },
    formatValue: (v) => `${Number(v).toFixed(2)} mm/d`,
    formatDiff: (d) => `${d >= 0 ? '+' : ''}${d.toFixed(2)} mm/d`,
    formatSecondary: (norm) => `${Math.round(14 + norm * 22)}%`,
    formatHoverConc: (conc) => `${(conc * 28.0).toFixed(1)} mm/d`,
    baselineSeries: {
      2003: 2.711, 2004: 2.704, 2005: 2.723, 2006: 2.724, 2007: 2.708,
      2008: 2.675, 2009: 2.698, 2010: 2.732, 2011: 2.677, 2012: 2.673,
      2013: 2.700, 2014: 2.670, 2015: 2.724, 2016: 2.729, 2017: 2.700,
      2018: 2.664, 2019: 2.682, 2020: 2.679, 2021: 2.645, 2022: 2.654,
      2023: 2.679, 2024: 2.726, 2025: 2.655
    },
    audio: {
      scale: ['E4', 'F#4', 'G#4', 'B4', 'C#5', 'E5', 'F#5', 'G#5', 'B5'],
      chordSets: {
        high: [['E3', 'B3', 'F#4', 'G#4'], ['A2', 'E3', 'C#4', 'G#4'], ['C#3', 'G#3', 'D#4', 'E4']],
        mid: [['E3', 'B3', 'G#4'], ['A2', 'E3', 'B3', 'C#4'], ['F#3', 'C#4', 'E4', 'A4']],
        low: [['E3', 'B3', 'F#4'], ['C#3', 'G#3', 'E4']]
      },
      filterType: 'lowpass',
      descHigh: 'cascading raindrop arpeggios (peak monsoon storm)',
      descMid: 'steady ITCZ tropical rainbelt',
      descLow: 'sparse subtropical rain shadow'
    },
    regions: {
      global_rain: {
        label: 'ITCZ Tropics',
        title: 'Indo-Pacific Monsoon Belt (10°N, 85°E)',
        lat: 10.0, lon: 85.0, dist: 4.35,
        desc: 'The Intertropical Convergence Zone circles Earth’s equator, unleashing massive convective rainfall belts that power Asian and African monsoons.'
      },
      monsoon: {
        label: 'India Monsoon',
        title: 'Western Ghats & Bay of Bengal (19°N, 76°E)',
        lat: 19.0, lon: 76.0, dist: 3.3,
        desc: 'Seasonal wind reversals pour moisture off the warm Indian Ocean, creating some of Earth’s highest terrestrial rainfall intensities.'
      },
      maritime: {
        label: 'Maritime Cont.',
        title: 'Indonesian Maritime Continent (1°S, 118°E)',
        lat: -1.0, lon: 118.0, dist: 3.4,
        desc: 'Warm Pacific & Indian waters collide across thousands of islands, forming Earth’s deepest atmospheric convection chimney.'
      },
      sahel_rain: {
        label: 'W. Africa Rain',
        title: 'West African Monsoon Zone (10.5°N, 5°W)',
        lat: 10.5, lon: -5.0, dist: 3.4,
        desc: 'Migrating summer Atlantic moisture bands sustain agriculture and river basins across West Africa.'
      },
      gulf_storm: {
        label: 'Atlantic Storms',
        title: 'Western Atlantic Hurricane Track (22°N, 75°W)',
        lat: 22.0, lon: -75.0, dist: 3.4,
        desc: 'Warm Caribbean & Gulf currents fuel late-summer tropical cyclones and heavy coastal precipitation events.'
      }
    },
    storyBeats: [
      { year: 2003, duration: 5.5, msg: '2003: Steady ITCZ convection & South Asian monsoon pulse.' },
      { year: 2010, duration: 7.5, msg: '2010: Intense La Niña amplifies tropical & Maritime Continent rain.' },
      { year: 2015, duration: 8.5, msg: '2015: El Niño shifts Pacific storm tracks, drying parts of the tropics.' },
      { year: 2024, duration: 9.5, msg: '2024: Warmer oceans hold more moisture — extreme rainfall events rise.' }
    ]
  }
};

window.EARTH_DOMAINS = EARTH_DOMAINS;
window.ACTIVE_DOMAIN_ID = 'ice';
function getActiveDomain() {
  return EARTH_DOMAINS[window.ACTIVE_DOMAIN_ID] || EARTH_DOMAINS.ice;
}

