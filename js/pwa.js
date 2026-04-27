// ═══════════════════════════════════════════════
// LAGER//APP – PWA & Push Manager
// ═══════════════════════════════════════════════

const PWA = {

  async init() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.register('/Lagerbestellung/sw.js', {
        scope: '/Lagerbestellung/'
      });

      console.log('✅ Service Worker registriert');

      // ── Update Detection ──
      // Wenn neuer SW wartet → sofort aktivieren
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Neue Version verfügbar → sofort aktivieren ohne Banner
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        });
      });

      // ── Nach SW Update: Seite automatisch neu laden ──
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('🔄 Neue Version – Seite wird neu geladen...');
          window.location.reload();
        }
      });

      // ── SW Update Message ──
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'SW_UPDATED') {
          console.log(`✅ LAGER//APP ${event.data.version} geladen`);
        }
      });

      // Regelmäßig auf Updates prüfen (alle 60 Minuten)
      setInterval(() => reg.update(), 60 * 60 * 1000);

    } catch (e) {
      console.error('Service Worker Fehler:', e);
    }
  },

  // ── Push Permission ──
  async requestPermission() {
    if (!('Notification' in window)) return { success: false };
    if (Notification.permission === 'granted') return { success: true };
    if (Notification.permission === 'denied') return { success: false, reason: 'denied' };
    const permission = await Notification.requestPermission();
    return { success: permission === 'granted' };
  },

  // ── Notification senden ──
  async notify(title, body, url = null, urgent = false) {
    if (Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({
      type: 'SHOW_NOTIFICATION',
      title, body,
      url: url || window.location.href,
      urgent,
    });
  },

  // ── Verfallsdaten prüfen ──
  async checkVerfallAndNotify(alleArtikel) {
    if (Notification.permission !== 'granted') return;
    const heute = new Date();
    const kritisch = [], bald = [];

    for (const a of alleArtikel) {
      if (!a.chargen || a.chargen.length === 0) continue;
      for (const c of a.chargen) {
        if (!c.verfall) continue;
        const days = Math.round((new Date(c.verfall) - heute) / (1000*60*60*24));
        if (days <= 7)       kritisch.push({ name: a.name, lot: c.lot, days });
        else if (days <= 30) bald.push({ name: a.name, lot: c.lot, days });
      }
    }

    if (kritisch.length > 0) {
      const namen = kritisch.slice(0,3).map(x => `${x.name} (${x.days <= 0 ? 'ABGELAUFEN' : x.days + ' Tage'}`).join(', ');
      await PWA.notify(`🔴 ${kritisch.length} Artikel kritisch!`, namen,
        '/Lagerbestellung/pages/portal.html', true);
    } else if (bald.length > 0) {
      const namen = bald.slice(0,3).map(x => `${x.name} (${x.days} Tage)`).join(', ');
      await PWA.notify(`🟡 ${bald.length} Artikel laufen bald ab`, namen,
        '/Lagerbestellung/pages/portal.html');
    }
  },

  // ── Lagerbestellung Benachrichtigung ──
  async notifyLagercheck(mitarbeiter, anzahl) {
    if (Notification.permission !== 'granted') return;
    await PWA.notify(
      '📋 Lagerbestellung abgeschlossen',
      anzahl > 0
        ? `${mitarbeiter} hat ${anzahl} Artikel zum Bestellen gemeldet`
        : `${mitarbeiter} – alles in Ordnung ✅`,
      '/Lagerbestellung/pages/portal.html',
    );
  },

  // ── Install Prompt (Android) ──
  initInstallPrompt() {
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      const btn = document.getElementById('pwa-install-btn');
      if (btn) {
        btn.classList.remove('hidden');
        btn.addEventListener('click', async () => {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') btn.remove();
          deferredPrompt = null;
        });
      }
    });
  },

  // ── Notification Permission Button ──
  getPermissionButtonHTML() {
    if (!('Notification' in window)) return '';
    if (Notification.permission === 'granted') return '';
    return `
      <button onclick="PWA.requestPermission().then(r => { if(r.success) this.remove(); })"
        style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;
               border:1px solid var(--border);background:var(--surface2);color:var(--text2);
               font-size:0.78rem;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:500;">
        🔔 Benachrichtigungen erlauben
      </button>`;
  },
};

// Auto-Init
document.addEventListener('DOMContentLoaded', () => {
  PWA.init();
  PWA.initInstallPrompt();
});
