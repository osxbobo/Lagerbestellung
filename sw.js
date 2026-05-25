// ═══════════════════════════════════════════════
// LAGER//APP – Service Worker
// PWA + Push Notifications + Offline Cache
// ═══════════════════════════════════════════════

// ── VERSION ──
// Diese Nummer bei jedem GitHub Upload um 1 erhöhen
// z.B. v2, v3, v4 ...
// → Browser erkennt automatisch die neue Version und lädt alles neu
const CACHE_VERSION = 'v125';
const CACHE_NAME    = `lagerapp-${CACHE_VERSION}`;
const BASE_PATH     = '/lagerapp_alpha';

// Dateien die offline verfügbar sein sollen
const CACHE_FILES = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/pages/check.html`,
  `${BASE_PATH}/pages/login.html`,
  `${BASE_PATH}/pages/portal.html`,
  `${BASE_PATH}/pages/admin.html`,
  `${BASE_PATH}/pages/scanner.html`,
  `${BASE_PATH}/css/main.css`,
  `${BASE_PATH}/css/index.css`,
  `${BASE_PATH}/manifest.json`,
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
          .then(cached => cached || caches.match(`${BASE_PATH}/index.html`))
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
    icon:    `${BASE_PATH}/icons/icon-192.png`,
    badge:   `${BASE_PATH}/icons/icon-192.png`,
    tag:     data.tag     || 'lagerapp',
    data:    data.url     || `${BASE_PATH}/`,
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

  const url = event.notification.data || `${BASE_PATH}/`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Existierendes Fenster fokussieren
        for (const client of clientList) {
          if (client.url.includes('lagerapp_alpha') && 'focus' in client) {
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

// ── MESSAGE HANDLER ──
self.addEventListener('message', event => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Benachrichtigung direkt vom Client senden
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, url, urgent } = event.data;
    self.registration.showNotification(title, {
      body,
      icon:    `${BASE_PATH}/icons/icon-192.png`,
      badge:   `${BASE_PATH}/icons/icon-192.png`,
      data:    url || `${BASE_PATH}/pages/portal.html`,
      vibrate: [200, 100, 200],
      requireInteraction: urgent || false,
    });
  }
});
