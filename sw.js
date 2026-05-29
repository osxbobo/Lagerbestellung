// ═══════════════════════════════════════════════
// LAGER//APP – Service Worker
// PWA + Push Notifications + Offline Cache
// ═══════════════════════════════════════════════

// ── VERSION ──
// Diese Nummer bei jedem GitHub Upload um 1 erhöhen
// z.B. v2, v3, v4 ...
// → Browser erkennt automatisch die neue Version und lädt alles neu
const CACHE_VERSION = 'v167';
const CACHE_NAME    = `lagerapp-${CACHE_VERSION}`;

// Dateien die offline verfügbar sein sollen (relativ zum SW-Scope)
const CACHE_FILES = [
  './',
  'index.html',
  'pages/check.html',
  'pages/login.html',
  'pages/mitarbeiter.html',
  'pages/portal.html',
  'pages/admin.html',
  'pages/scanner.html',
  'pages/stockswipe.html',
  'pages/verfallmonitor.html',
  'css/main.css',
  'css/index.css',
  'css/portal.css',
  'css/admin.css',
  'css/check.css',
  'css/login.css',
  'css/mitarbeiter.css',
  'css/scanner.css',
  'css/stockswipe.css',
  'css/verfallmonitor.css',
  'js/firebase-config.js',
  'js/search.js',
  'js/theme.js',
  'js/pwa.js',
  'js/portal.js',
  'js/admin.js',
  'js/check.js',
  'js/login.js',
  'js/mitarbeiter.js',
  'js/scanner.js',
  'js/stockswipe.js',
  'js/verfallmonitor.js',
  'manifest.json',
];

// ── INSTALL ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        Promise.all(
          CACHE_FILES.map(url =>
            cache.add(url).catch(err => console.warn(`[SW] Cache-Fehler: ${url}`, err))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log(`🗑️ Alter Cache gelöscht: ${key}`);
              return caches.delete(key);
            })
        )
      )
      .then(() => {
        console.log(`✅ LAGER//APP ${CACHE_VERSION} aktiv`);
        return self.clients.claim();
      })
      .then(() => {
        // Alle offenen Tabs über Update informieren
        return self.clients.matchAll({ type: 'window' });
      })
      .then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      })
  );
});

// ── FETCH (Offline Support) ──
self.addEventListener('fetch', event => {
  // Nur http/https cachen – chrome-extension:// und andere Schemes überspringen
  if (!event.request.url.startsWith('http')) return;

  // Firebase & externe Requests immer online durchlassen
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('cloudinary') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic')) {
    return;
  }

  const isHtml = event.request.mode === 'navigate' ||
                 event.request.destination === 'document' ||
                 event.request.url.endsWith('.html');

  if (isHtml) {
    // Network-first für HTML-Seiten → immer aktuelle Version laden
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)
          .then(cached => cached || caches.match('index.html'))
        )
    );
  } else {
    // Cache-first für Assets (CSS, JS, Bilder)
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request)
          .then(response => {
            if (response.status === 200 && event.request.method === 'GET') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
        )
    );
  }
});

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body:    data.body    || '',
    icon:    'icons/icon-192.png',
    badge:   'icons/icon-192.png',
    tag:     data.tag     || 'lagerapp',
    data:    data.url     || '.',
    vibrate: [200, 100, 200],
    actions: data.actions || [],
    requireInteraction: data.urgent || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'LAGER//APP', options)
  );
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const url = event.notification.data || '.';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Existierendes Fenster fokussieren
        for (const client of clientList) {
          if (client.url.includes('lagerbestellung-19970.web.app') && 'focus' in client) {
            return client.focus().then(() => client.navigate(url));
          }
        }
        // Neues Fenster öffnen
        return clients.openWindow(url);
      })
  );
});

// ── BACKGROUND SYNC (Verfallsprüfung) ──
self.addEventListener('sync', event => {
  if (event.tag === 'check-verfall') {
    event.waitUntil(checkVerfall());
  }
});

async function checkVerfall() {
  // Wird vom Client getriggert um Verfallsdaten zu prüfen
  // Die eigentliche Logik läuft im Client
  const allClients = await clients.matchAll();
  allClients.forEach(client => {
    client.postMessage({ type: 'CHECK_VERFALL' });
  });
}

// ── INDEXEDDB – Firestore-Artikeldaten-Cache ──
// Ermöglicht Stale-while-revalidate und vollständigen Offline-Betrieb.
// Seiten schreiben via postMessage('CACHE_ARTIKEL'), lesen via 'GET_CACHED_ARTIKEL'.

const IDB_NAME    = 'lagerapp-offline';
const IDB_VERSION = 1;
const IDB_STORE   = 'artikel-cache';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = ()  => reject(req.error);
  });
}

async function saveToIDB(data) {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(data, 'main');
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function readFromIDB() {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get('main');
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

// ── MESSAGE HANDLER ──
self.addEventListener('message', event => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Artikeldaten aus Firestore im IndexedDB-Cache speichern (Stale-while-revalidate)
  if (event.data.type === 'CACHE_ARTIKEL') {
    saveToIDB(event.data.data).catch(err =>
      console.warn('[SW] IndexedDB-Schreibfehler:', err)
    );
  }

  // Gecachte Artikeldaten zurückliefern (Offline-Fallback)
  if (event.data.type === 'GET_CACHED_ARTIKEL') {
    readFromIDB()
      .then(cached => event.ports[0].postMessage(cached))
      .catch(() => event.ports[0].postMessage(null));
  }

  // Benachrichtigung direkt vom Client senden
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, url, urgent } = event.data;
    self.registration.showNotification(title, {
      body,
      icon:    'icons/icon-192.png',
      badge:   'icons/icon-192.png',
      data:    url || 'pages/portal.html',
      vibrate: [200, 100, 200],
      requireInteraction: urgent || false,
    });
  }
});
