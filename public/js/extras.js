// =============================================================
// 9. EXTRAS: VIDEO/MIDI EXPORT, LIVE GIBS, CSV, COLLAB, A11Y/MODES
// =============================================================

// Time-Lapse WebM Video + Mixed Audio Export (8s / 16s / 24s / Cancel)
const exportVideoNavBtn = document.getElementById('export-video-nav-btn');
let activeVideoExport = null;

function stopActiveVideoExport(cancel = false) {
  if (!activeVideoExport) return;
  const { rec, proxy, cancelledRef } = activeVideoExport;
  cancelledRef.cancelled = cancel;
  if (typeof gsap !== 'undefined') gsap.killTweensOf(proxy);
  playback.mode = 'idle';
  if (rec && rec.state === 'recording') {
    try { rec.stop(); } catch (_) {}
  }
  activeVideoExport = null;
  if (exportVideoNavBtn) exportVideoNavBtn.textContent = 'Video';
  if (cancel) showOverlayBannerNote('Video export cancelled');
}

if (exportVideoNavBtn) {
  exportVideoNavBtn.addEventListener('click', async () => {
    if (activeVideoExport) {
      stopActiveVideoExport(true);
      return;
    }
    if (typeof MediaRecorder === 'undefined' || !renderer.domElement.captureStream) {
      showOverlayBannerNote('Video export unavailable: MediaRecorder or captureStream not supported in this browser');
      return;
    }
    const lenChoice = window.prompt('Choose time-lapse export duration in seconds: 8, 16, or 24', '8');
    if (lenChoice === null) return;
    const parsedSec = Number(lenChoice.trim());
    const durationSec = [8, 16, 24].includes(parsedSec) ? parsedSec : 8;

    await resumeAndInitAudioFromGesture();
    const dom = getActiveDomain();
    let combined;
    let rec;
    try {
      const videoStream = renderer.domElement.captureStream(30);
      const audioStream = typeof getAudioMediaStream === 'function' ? getAudioMediaStream() : null;
      const tracks = [...videoStream.getVideoTracks(), ...(audioStream ? audioStream.getAudioTracks() : [])];
      combined = new MediaStream(tracks);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
      rec = mime ? new MediaRecorder(combined, { mimeType: mime }) : new MediaRecorder(combined);
    } catch (err) {
      showOverlayBannerNote('Video export failed to initialize MediaRecorder: ' + (err.message || 'blocked'));
      return;
    }

    const chunks = [];
    const cancelledRef = { cancelled: false };
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
    rec.onstop = () => {
      activeVideoExport = null;
      if (exportVideoNavBtn) exportVideoNavBtn.textContent = 'Video';
      if (cancelledRef.cancelled || chunks.length === 0) return;
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `earth-jukebox-${dom.id}-2003-2025-${durationSec}s.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showOverlayBannerNote(`Saved ${dom.shortName} ${durationSec}s time-lapse WebM video!`);
    };

    const proxy = { y: 2003 };
    activeVideoExport = { rec, proxy, cancelledRef };
    exportVideoNavBtn.textContent = 'Rec 0% (Stop)';
    showOverlayBannerNote(`Recording ${durationSec}s ${dom.name} time-lapse (click Video again to cancel)...`);
    masterTimeline.pause();
    masterTimeline.scrub(2003);
    playback.mode = 'preview';
    rec.start();
    gsap.to(proxy, {
      y: 2025,
      duration: durationSec,
      ease: 'none',
      onUpdate: () => {
        masterTimeline.scrub(proxy.y);
        const pct = Math.min(100, Math.round(((proxy.y - 2003) / 22) * 100));
        if (exportVideoNavBtn && activeVideoExport) exportVideoNavBtn.textContent = `Rec ${pct}% (Stop)`;
      },
      onComplete: () => stopActiveVideoExport(false)
    });
  });
}

// MIDI Export
const exportMidiNavBtn = document.getElementById('export-midi-nav-btn');
if (exportMidiNavBtn) {
  exportMidiNavBtn.addEventListener('click', () => {
    if (typeof exportCurrentDomainMidi === 'function') {
      exportCurrentDomainMidi();
      showOverlayBannerNote(`Downloaded ${getActiveDomain().shortName} 2003–2025 MIDI file`);
    }
  });
}

// Live Near-Real-Time GIBS
const liveGibsToggleBtn = document.getElementById('live-gibs-toggle');
if (liveGibsToggleBtn) {
  liveGibsToggleBtn.addEventListener('click', () => {
    const active = liveGibsToggleBtn.getAttribute('aria-pressed') === 'true';
    if (!active) {
      liveGibsToggleBtn.setAttribute('aria-pressed', 'true');
      loadLiveGibsSnapshot(getActiveDomain().id);
    } else {
      liveGibsToggleBtn.setAttribute('aria-pressed', 'false');
      updateOverlayForCurrentYear(true);
      showOverlayBannerNote('Returned to 2003–2025 historical series');
    }
  });
}

// User CSV Overlay
const csvUploadBtn = document.getElementById('csv-upload-btn');
const csvFileInput = document.getElementById('csv-file-input');
if (csvUploadBtn && csvFileInput) {
  csvUploadBtn.addEventListener('click', () => csvFileInput.click());
  csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => showOverlayBannerNote('Could not read CSV file');
    reader.onload = () => parseAndApplyCustomCsv(reader.result, file.name);
    reader.readAsText(file);
    csvFileInput.value = '';
  });
}

// Experimental Multi-user Collaborative Buoys Room (4s polling sync)
const collabRoomBtn = document.getElementById('collab-room-btn');
let collabPollTimer = null;
function setCollabRoom(roomCode) {
  const clean = String(roomCode || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  if (!clean) return;
  window.COLLAB_ROOM_ID = 'room_' + clean;
  if (collabRoomBtn) {
    collabRoomBtn.setAttribute('aria-pressed', 'true');
    collabRoomBtn.textContent = `Room: ${clean} (4s)`;
  }
  clearBuoysFromScene();
  loadBuoysForDomain(getActiveDomain().id);
  if (collabPollTimer) clearInterval(collabPollTimer);
  collabPollTimer = setInterval(() => {
    if (!BACKEND_ENABLED) return;
    apiRequest(`/api/buoys?sessionId=${encodeURIComponent(window.COLLAB_ROOM_ID)}&domain=${encodeURIComponent(getActiveDomain().id)}`).then((res) => {
      if (!res || !Array.isArray(res.buoys)) return;
      if (res.buoys.length !== activeBuoys.length) {
        clearBuoysFromScene();
        nextBuoyNumber = 1;
        for (const b of res.buoys) {
          addBuoyToScene({ dbId: b.id, buoyNumber: b.buoyNumber, latDeg: b.lat, lonDeg: b.lon });
          nextBuoyNumber = Math.max(nextBuoyNumber, b.buoyNumber + 1);
        }
      }
    });
  }, 4000);
}
if (collabRoomBtn) {
  collabRoomBtn.addEventListener('click', () => {
    const code = window.prompt('Experimental shared room (syncs buoys every 4s). Enter room code:', 'earth-lab-1');
    if (code) {
      setCollabRoom(code);
      showOverlayBannerNote(`Joined experimental shared room "${code}" (syncs every 4s)`);
    }
  });
}

// Spoken Captions, Classroom Mode, Lite Quality, Simple UI Mode, Shortcuts Modal
const speechToggleBtn = document.getElementById('speech-toggle-btn');
if (speechToggleBtn) {
  speechToggleBtn.addEventListener('click', () => {
    config.a11y.speechCaptions = !config.a11y.speechCaptions;
    speechToggleBtn.setAttribute('aria-pressed', String(config.a11y.speechCaptions));
    if (config.a11y.speechCaptions) speakAccessibilityDescription(`Spoken audio description enabled for ${getActiveDomain().name}.`);
  });
}

const classroomToggleBtn = document.getElementById('classroom-toggle-btn');
const classroomDrawerEl = document.getElementById('classroom-drawer');
const classroomCloseBtn = document.getElementById('classroom-close-btn');
function syncClassroomNotes() {
  const body = document.getElementById('classroom-notes-body');
  if (!body) return;
  const dom = getActiveDomain();
  body.innerHTML = `<p><strong>Active Lesson:</strong> ${dom.name} (2003–2025)</p><p style="margin-top:6px;">${dom.heroSubtitle}</p><p style="margin-top:6px;color:var(--accent-cyan);"><strong>Discussion Prompt:</strong> Compare 2003 vs ${Math.floor(config.timeline.currentYear)} using the 3D Split Curtain and listen for how harmonic pitch shifts at extreme years.</p>`;
}
if (classroomToggleBtn) {
  classroomToggleBtn.addEventListener('click', () => {
    const on = document.body.classList.toggle('classroom-mode');
    classroomToggleBtn.setAttribute('aria-pressed', String(on));
    if (classroomDrawerEl) classroomDrawerEl.style.display = on ? 'block' : 'none';
    if (on) syncClassroomNotes();
  });
}
if (classroomCloseBtn && classroomDrawerEl) {
  classroomCloseBtn.addEventListener('click', () => {
    document.body.classList.remove('classroom-mode');
    if (classroomToggleBtn) classroomToggleBtn.setAttribute('aria-pressed', 'false');
    classroomDrawerEl.style.display = 'none';
  });
}

const liteToggleBtn = document.getElementById('lite-toggle-btn');
if (liteToggleBtn) {
  liteToggleBtn.addEventListener('click', () => {
    config.quality.lite = !config.quality.lite;
    liteToggleBtn.setAttribute('aria-pressed', String(config.quality.lite));
    config.bloom.strength = config.quality.lite ? 0.0 : 0.11;
    config.look.grainIntensity = config.quality.lite ? 0.0 : 0.01;
    handleViewportResize();
    showOverlayBannerNote(config.quality.lite ? 'Lite Performance Mode ON (1x DPR, Bloom off)' : 'Full Quality Mode restored');
  });
}

const mobileStoryBtn = document.getElementById('mobile-story-btn');
if (mobileStoryBtn) {
  mobileStoryBtn.addEventListener('click', () => {
    const on = document.body.classList.toggle('mobile-story-only');
    mobileStoryBtn.setAttribute('aria-pressed', String(on));
    showOverlayBannerNote(on ? 'Simple UI Mode ON (secondary panels hidden)' : 'Full UI restored');
  });
}

const shortcutsNavBtn = document.getElementById('shortcuts-nav-btn');
if (shortcutsNavBtn) {
  shortcutsNavBtn.addEventListener('click', () => {
    closeAllModals();
    const m = document.getElementById('shortcuts-modal');
    if (m) m.classList.add('open');
  });
}

