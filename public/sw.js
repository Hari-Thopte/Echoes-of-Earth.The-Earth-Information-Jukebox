const CACHE_NAME = 'earth-jukebox-v20';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/jukebox.html',
  '/style.css',
  '/manifest.webmanifest',
  '/vendor/three.min.js',
  '/vendor/gsap.min.js',
  '/vendor/Tone.js',
  '/vendor/lil-gui.umd.min.js',
  '/vendor/textures/earth-blue-marble.jpg',
  '/vendor/textures/earth-night.jpg',
  '/vendor/textures/earth-normal.jpg',
  '/vendor/textures/earth-specular.jpg',
  '/vendor/textures/earth-clouds.png',
  '/js/shaders.js',
  '/js/config.js',
  '/js/domains.js',
  '/js/helpers.js',
  '/js/scene.js',
  '/js/audio.js',
  '/js/data.js',
  '/js/controls.js',
  '/js/timeline.js',
  '/js/galaxy-bg.js',
  '/js/app.js',
  '/js/extras.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Stream video files directly from network without caching
  if (url.pathname.endsWith('.mp4') || url.pathname.endsWith('.webm')) return;

  // Cache-first for GIBS tiles and external CDN globe textures/libs so offline mode works
  if ((url.pathname.startsWith('/api/gibs/') && !url.pathname.includes('/live/')) ||
      url.hostname === 'cdn.jsdelivr.net' ||
      url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const fresh = await fetch(event.request);
          if (fresh.ok) cache.put(event.request, fresh.clone());
          return fresh;
        } catch (err) {
          return cached || new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // Network-first for shell assets with offline fallback
  if (url.origin === self.location.origin && !url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

