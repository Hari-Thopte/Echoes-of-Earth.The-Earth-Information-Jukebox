// =============================================================
// 4. STUDIO-GRADE HARMONIC AUDIO ENGINE
// =============================================================
const CALM_SCALE = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'];
const CHORD_SETS = {
  high: [['C3', 'G3', 'D4', 'E4'], ['F2', 'C3', 'G3', 'A3'], ['A2', 'E3', 'B3', 'C4']],
  mid: [['A2', 'E3', 'G3', 'C4'], ['F2', 'C3', 'E3', 'A3'], ['D3', 'A3', 'C4', 'F4']],
  low: [['A2', 'E3', 'B3'], ['F2', 'C3', 'G3']]
};

const soundState = {
  initialized: false,
  currentActivity: 0.5,
  currentRegionalActivity: 0.5,
  hasDataForCurrentYear: true,
  lastPulseTime: 0.0,
  lastChordTime: -20.0,
  lastBuoyPingTime: 0.0,
  chordIndex: 0,
  buoyCycleIndex: 0
};

let masterLimiter = null, masterGain = null, sharedReverb = null, stereoPanner = null;
let padFilter = null, padLfo = null, pulseShelf = null;
let pulseSynth = null, chordSynth = null, touchSynth = null, fftAnalyser = null;

function isPulseAllowedToPlay() {
  return playback.mode === 'timeline' || playback.mode === 'compare' || playback.mode === 'preview' || playback.mode === 'film';
}

function initAudioEngine() {
  if (soundState.initialized || typeof Tone === 'undefined') return;
  try {
    soundState.initialized = true;
    masterLimiter = new Tone.Limiter(-1.5).toDestination();
    masterGain = new Tone.Gain(config.audio.muted ? 0.0 : config.audio.volume).connect(masterLimiter);
    fftAnalyser = new Tone.Analyser('fft', 32);
    masterGain.connect(fftAnalyser);

    sharedReverb = new Tone.Reverb({ decay: 5.5, wet: config.audio.reverbWet }).connect(masterGain);
    // padFilter freq starts at droneFilterFreq; LFO will swell it up to droneSwellFreq
    padFilter = new Tone.Filter({ type: 'lowpass', frequency: config.audio.droneFilterFreq, rolloff: -12 }).connect(sharedReverb);
    // LFO gently modulates the pad filter frequency between droneFilterFreq and droneSwellFreq
    padLfo = new Tone.LFO({
      frequency: config.audio.droneLfoRate,
      min: config.audio.droneFilterFreq,
      max: config.audio.droneSwellFreq,
      type: 'sine'
    });
    padLfo.connect(padFilter.frequency);
    padLfo.start();
    stereoPanner = new Tone.Panner(0.0).connect(padFilter);

    // Warm acoustic-style pad
    chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 2.6, decay: 2.0, sustain: 0.7, release: 4.5 }
    }).connect(padFilter);
    chordSynth.volume.value = config.audio.droneLevel;

    // High-shelf brightness filter for Crystalline (Original) mode; boosted when active
    pulseShelf = new Tone.Filter({ type: 'highshelf', frequency: config.audio.pulseBrightness, gain: 0 }).connect(stereoPanner);

    // Warm harmonic marimba/bell voice
    pulseSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.025, decay: 1.1, sustain: 0.0, release: 1.4 }
    }).connect(pulseShelf);
    pulseSynth.volume.value = config.audio.pulseLevel;

    touchSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.012, decay: 0.45, sustain: 0.0, release: 0.5 }
    }).connect(pulseShelf);
    touchSynth.volume.value = -13;
  } catch (err) {
    console.warn('initAudioEngine warning:', err);
  }
}

async function ensureAudioStartedForInteractivePanel() {
  if (typeof Tone !== 'undefined') {
    try { await Tone.start(); } catch (e) { }
    initAudioEngine();
  }
}

function getActiveAudioProfile() {
  const dom = typeof getActiveDomain === 'function' ? getActiveDomain() : null;
  if (dom && dom.audio) return dom.audio;
  return {
    scale: CALM_SCALE,
    chordSets: CHORD_SETS,
    filterType: 'lowpass',
    descHigh: 'warm major harmonics (dense pack ice)',
    descMid: 'balanced mid-register chords',
    descLow: 'sparse minor voicings (retreated ice)'
  };
}

function playStereoIceNote(conc, lonDeg, duration = '16n') {
  if (!soundState.initialized || config.audio.muted || !touchSynth) return;
  try {
    if (stereoPanner) {
      const panVal = THREE.MathUtils.clamp(Math.sin(THREE.MathUtils.degToRad(lonDeg)), -0.85, 0.85);
      stereoPanner.pan.rampTo(panVal, 0.05);
    }
    const scale = getActiveAudioProfile().scale;
    const noteIdx = Math.min(scale.length - 1, Math.max(0, Math.floor(conc * (scale.length - 1))));
    touchSynth.triggerAttackRelease(scale[noteIdx], duration);
  } catch (e) { }
}

function playLocalizedProbeSequence(conc, lonDeg) {
  if (!soundState.initialized || config.audio.muted || !pulseSynth) return;
  try {
    if (stereoPanner) {
      const panVal = THREE.MathUtils.clamp(Math.sin(THREE.MathUtils.degToRad(lonDeg)), -0.9, 0.9);
      stereoPanner.pan.rampTo(panVal, 0.04);
    }
    const scale = getActiveAudioProfile().scale;
    const baseIdx = Math.min(scale.length - 1, Math.max(0, Math.floor(conc * (scale.length - 1))));
    const n1 = scale[baseIdx];
    const n2 = scale[Math.min(scale.length - 1, baseIdx + 2)];
    const n3 = scale[Math.min(scale.length - 1, baseIdx + 4)];
    const now = Tone.now();
    pulseSynth.triggerAttackRelease(n1, '8n', now);
    pulseSynth.triggerAttackRelease(n2, '8n', now + 0.11);
    pulseSynth.triggerAttackRelease(n3, '4n', now + 0.22);
  } catch (e) { }
}

let audioStreamDest = null;
function getAudioMediaStream() {
  if (!soundState.initialized || !masterGain || typeof Tone === 'undefined') return null;
  try {
    if (!audioStreamDest) {
      const ctx = Tone.getContext().rawContext;
      audioStreamDest = ctx.createMediaStreamDestination();
      masterGain.connect(audioStreamDest);
    }
    return audioStreamDest.stream;
  } catch (e) {
    return null;
  }
}

function speakAccessibilityDescription(text) {
  if (!config.a11y || !config.a11y.speechCaptions || typeof window.speechSynthesis === 'undefined') return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch (e) { }
}

function exportCurrentDomainMidi() {
  const dom = typeof getActiveDomain === 'function' ? getActiveDomain() : { id: 'ice' };
  const scale = getActiveAudioProfile().scale;
  const noteToMidi = (n) => {
    const map = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
    const m = String(n).match(/^([A-G][#b]?)(-?\d)$/);
    return m ? (Number(m[2]) + 1) * 12 + (map[m[1]] || 0) : 60;
  };
  const writeVarLen = (v) => {
    const out = [v & 0x7f];
    while ((v >>= 7) > 0) out.unshift((v & 0x7f) | 0x80);
    return out;
  };
  const trackEvents = [0x00, 0xff, 0x51, 0x03, 0x09, 0x27, 0xc0]; // ~100 BPM
  for (let yr = config.story.startYear; yr <= config.story.endYear; yr++) {
    const m = yearMetricsMap.get(yr);
    const norm = m ? THREE.MathUtils.clamp(m.normActivity, 0, 1) : 0.5;
    const idx = Math.min(scale.length - 1, Math.floor(norm * (scale.length - 1)));
    const midi = noteToMidi(scale[idx]);
    const vel = Math.round(52 + norm * 65);
    trackEvents.push(...writeVarLen(0), 0x90, midi, vel);
    trackEvents.push(...writeVarLen(240), 0x80, midi, 0x00);
  }
  trackEvents.push(0x00, 0xff, 0x2f, 0x00);
  const trkLen = trackEvents.length;
  const bytes = new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, // MThd: format 0, 1 track, 480 TPQN
    0x4d, 0x54, 0x72, 0x6b, (trkLen >> 24) & 255, (trkLen >> 16) & 255, (trkLen >> 8) & 255, trkLen & 255,
    ...trackEvents
  ]);
  const blob = new Blob([bytes], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `earth-jukebox-${dom.id}-2003-2025.mid`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function updateMasterVolume() {
  if (!soundState.initialized || !masterGain) return;
  try {
    masterGain.gain.rampTo(config.audio.muted ? 0.0 : config.audio.volume, 0.15);
  } catch (e) { }
}

function applySoundStyleRouting() {
  const profile = getActiveAudioProfile();
  const dom = typeof getActiveDomain === 'function' ? getActiveDomain() : { id: 'ice', shortName: 'Ice' };
  const isRain = dom.id === 'rainfall';
  const isAir = dom.id === 'air';
  const style = config.audio.style;

  if (soundState.initialized && padFilter && sharedReverb) {
    try { padFilter.type = style === 'Deep Drone' ? 'lowpass' : (profile.filterType || 'lowpass'); } catch (_) { }
    if (style === 'Original') {
      sharedReverb.wet.rampTo(0.55, 0.25);
      if (pulseSynth) pulseSynth.set({ oscillator: { type: 'sine' }, envelope: { attack: isRain ? 0.008 : 0.02, decay: isRain ? 0.45 : 0.75, release: 1.0 } });
      if (padLfo) padLfo.frequency.rampTo(config.audio.droneLfoRate * 2.5, 0.5);
      if (pulseShelf) pulseShelf.gain.rampTo(8, 0.3);
      if (chordSynth) chordSynth.volume.rampTo(config.audio.droneLevel, 0.3);
    } else if (style === 'Minimal') {
      sharedReverb.wet.rampTo(0.22, 0.25);
      if (pulseSynth) pulseSynth.set({ oscillator: { type: 'triangle' }, envelope: { attack: 0.015, decay: isRain ? 0.3 : 0.5, release: 0.6 } });
      if (padLfo) padLfo.frequency.rampTo(config.audio.droneLfoRate * 1.5, 0.5);
      if (pulseShelf) pulseShelf.gain.rampTo(0, 0.3);
    } else if (style === 'Deep Drone') {
      sharedReverb.wet.rampTo(0.68, 0.3);
      if (pulseSynth) pulseSynth.set({ oscillator: { type: 'sine' }, envelope: { attack: 0.18, decay: 1.8, release: 2.2 } });
      if (padLfo) padLfo.frequency.rampTo(0.03, 0.5);
      if (pulseShelf) pulseShelf.gain.rampTo(-4, 0.3);
      if (chordSynth) chordSynth.volume.rampTo(config.audio.droneLevel + 5, 0.3);
    } else if (style === 'Sparse Piano') {
      sharedReverb.wet.rampTo(0.32, 0.25);
      if (pulseSynth) pulseSynth.set({ oscillator: { type: 'triangle' }, envelope: { attack: 0.004, decay: 0.9, release: 0.85 } });
      if (padLfo) padLfo.frequency.rampTo(config.audio.droneLfoRate * 0.8, 0.5);
      if (pulseShelf) pulseShelf.gain.rampTo(3, 0.3);
      if (chordSynth) chordSynth.volume.rampTo(config.audio.droneLevel - 4, 0.3);
    } else if (style === 'Glacial Granular') {
      sharedReverb.wet.rampTo(0.62, 0.25);
      if (pulseSynth) pulseSynth.set({ oscillator: { type: 'sine' }, envelope: { attack: 0.003, decay: 0.14, release: 0.2 } });
      if (padLfo) padLfo.frequency.rampTo(config.audio.droneLfoRate * 3.5, 0.5);
      if (pulseShelf) pulseShelf.gain.rampTo(6, 0.3);
    } else {
      sharedReverb.wet.rampTo(config.audio.reverbWet, 0.25);
      if (pulseSynth) {
        pulseSynth.set({
          oscillator: { type: isAir ? 'sine' : 'triangle' },
          envelope: { attack: isRain ? 0.008 : isAir ? 0.06 : 0.025, decay: isRain ? 0.55 : 1.1, release: 1.4 }
        });
      }
      if (padLfo) padLfo.frequency.rampTo(config.audio.droneLfoRate, 0.5);
      if (pulseShelf) pulseShelf.gain.rampTo(0, 0.3);
      if (chordSynth) chordSynth.volume.rampTo(config.audio.droneLevel, 0.3);
    }
  }
  const act = soundState.currentActivity;
  const styleLabel = style === 'Original' ? 'Crystalline' : style;
  const levelDesc = act > 0.66 ? profile.descHigh : act > 0.33 ? profile.descMid : profile.descLow;
  if (soundCaptionStripEl) {
    soundCaptionStripEl.textContent = `${dom.shortName} • ${styleLabel} • ${levelDesc}`;
  }
  const pitchDesc = act > 0.66 ? 'High register & open filter' : act > 0.33 ? 'Mid-register steady pulse' : 'Low thinned register';
  const liveTxt = `${styleLabel}: ${pitchDesc} — ${levelDesc}`;
  const whatEl = document.getElementById('what-hearing-strip');
  if (whatEl) {
    whatEl.style.display = config.a11y && config.a11y.captions ? 'block' : 'none';
    whatEl.textContent = `What you're hearing: ${liveTxt}`;
  }
  const modalLiveEl = document.getElementById('listen-live-text');
  if (modalLiveEl) modalLiveEl.textContent = liveTxt;
}

function tickAudioEngine(elapsedTime) {
  const dom = typeof getActiveDomain === 'function' ? getActiveDomain() : { accentColor: '#38bdf8' };
  const profile = getActiveAudioProfile();

  if (audioVizCtx && audioVizCanvas) {
    const vw = audioVizCanvas.width, vh = audioVizCanvas.height;
    audioVizCtx.clearRect(0, 0, vw, vh);
    if (soundState.initialized && !config.audio.muted && fftAnalyser) {
      const vals = fftAnalyser.getValue();
      const barCount = 13, barW = 3.2, gap = 1.4;
      for (let i = 0; i < barCount; i++) {
        const db = vals[i] || -100;
        const norm = THREE.MathUtils.clamp((db + 75) / 55, 0.1, 1.0);
        const bh = Math.max(2, norm * (vh - 4));
        audioVizCtx.fillStyle = norm > 0.65 ? '#34d399' : (dom.accentColor || '#38bdf8');
        audioVizCtx.fillRect(3 + i * (barW + gap), vh - bh - 2, barW, bh);
      }
    } else {
      audioVizCtx.fillStyle = 'rgba(148, 163, 184, 0.22)';
      for (let i = 0; i < 13; i++) audioVizCtx.fillRect(3 + i * 4.6, vh - 4, 3.2, 2);
    }
  }

  if (!soundState.initialized || config.audio.muted) return;

  if (activeBuoys.length > 0 && elapsedTime - soundState.lastBuoyPingTime >= 2.2) {
    soundState.lastBuoyPingTime = elapsedTime;
    const b = activeBuoys[soundState.buoyCycleIndex % activeBuoys.length];
    soundState.buoyCycleIndex++;
    const yr = Math.floor(config.timeline.currentYear);
    const conc = getConcentrationAt(yr, b.lat, b.lon, config.overlay.seasonalMode ? config.overlay.seasonalMonthFloat : 9.0);
    playStereoIceNote(Math.max(0.18, conc), b.lon, '16n');
  }

  if (!isPulseAllowedToPlay()) return;
  try {
    const a = THREE.MathUtils.clamp(soundState.currentActivity, 0.0, 1.0);
    const isCrystalline = config.audio.style === 'Original';
    // Adjust LFO swell range based on activity (more activity → higher filter ceiling)
    if (padLfo) {
      const baseFreq = isCrystalline ? config.audio.droneFilterFreq : (config.audio.droneFilterFreq * 0.75);
      const topFreq = isCrystalline
        ? (config.audio.droneSwellFreq + a * 1200)
        : (config.audio.droneSwellFreq * 0.9 + a * 600);
      padLfo.min = baseFreq;
      padLfo.max = topFreq;
    }
    if (config.audio.style !== 'Minimal' && chordSynth && elapsedTime - soundState.lastChordTime >= 9.0) {
      soundState.lastChordTime = elapsedTime;
      const chordSets = profile.chordSets || CHORD_SETS;
      const band = a > 0.66 ? chordSets.high : a >= 0.33 ? chordSets.mid : chordSets.low;
      const chord = band[soundState.chordIndex % band.length];
      soundState.chordIndex++;
      chordSynth.triggerAttackRelease(chord, '6n');
      applySoundStyleRouting();
    }
    const style = config.audio.style;
    const rateScale = (dom.id === 'rainfall' ? 1.45 : 1.0) * (style === 'Glacial Granular' ? 2.4 : style === 'Sparse Piano' ? 0.72 : style === 'Deep Drone' ? 0.55 : 1.0);
    const rate = THREE.MathUtils.lerp(config.audio.minNotesPerSec, config.audio.maxNotesPerSec * rateScale, a);
    const interval = 1.0 / Math.max(0.25, rate);
    const restProb = style === 'Sparse Piano' ? 0.48 : (style === 'Glacial Granular' ? 0.15 : config.audio.restProbability);
    if (pulseSynth && elapsedTime - soundState.lastPulseTime >= interval) {
      soundState.lastPulseTime = elapsedTime;
      if (Math.random() > restProb) {
        const scale = profile.scale || CALM_SCALE;
        const idx = Math.min(scale.length - 1, Math.floor(a * (scale.length - 1)));
        const baseNote = scale[idx];
        let playNote = baseNote;
        if (typeof Tone !== 'undefined') {
          if (isCrystalline || style === 'Glacial Granular') playNote = Tone.Frequency(baseNote).transpose(12).toNote();
          else if (style === 'Deep Drone') playNote = Tone.Frequency(baseNote).transpose(-12).toNote();
        }
        const panSpread = style === 'Glacial Granular' ? 1.6 : 0.65;
        if (stereoPanner) stereoPanner.pan.rampTo(THREE.MathUtils.clamp((Math.random() - 0.5) * panSpread, -0.9, 0.9), 0.1);
        pulseSynth.triggerAttackRelease(playNote, style === 'Glacial Granular' ? '32n' : '8n');
        if (!(config.a11y && config.a11y.reducedMotion)) triggerOverlayNoteRipple();
      }
    }
  } catch (e) { }
}

