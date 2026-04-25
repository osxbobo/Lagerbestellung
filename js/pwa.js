// ═══════════════════════════════════════════════
// LAGER//APP – PWA & Push Manager
// Einbinden in alle HTML Seiten:
// <script src="../js/pwa.js"></script>  (für pages/)
// <script src="js/pwa.js"></script>     (für index.html)
// ═══════════════════════════════════════════════

const PWA = {

  // ── Service Worker registrieren ──
  async init() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.register('/Lagerbestellung/sw.js', {
        scope: '/Lagerbestellung/'
      });

      console.log('✅ Service Worker registriert');

      // Update verfügbar?
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            PWA.showUpdateBanner();
          }
        });
      });

      // Verfallsprüfung im Hintergrund registrieren
      if ('SyncManager' in window) {
        try {
          await reg.sync.register('check-verfall');
        } catch {}
      }

    } catch (e) {
      console.error('Service Worker Fehler:', e);
    }
  },

  // ── Push Erlaubnis anfragen ──
  async requestPermission() {
    if (!('Notification' in window)) {
      return { success: false, reason: 'not_supported' };
    }

    if (Notification.permission === 'granted') {
      return { success: true };
    }

    if (Notification.permission === 'denied') {
      return { success: false, reason: 'denied' };
    }

    const permission = await Notification.requestPermission();
    return { success: permission === 'granted' };
  },

  // ── Benachrichtigung senden ──
  async notify(title, body, url = null, urgent = false) {
    if (Notification.permission !== 'granted') return;

    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      url: url || window.location.href,
      urgent,
    });
  },

  // ── Verfallsdaten prüfen und ggf. benachrichtigen ──
  async checkVerfallAndNotify(alleArtikel) {
    if (Notification.permission !== 'granted') return;

    const heute  = new Date();
    const heute7 = new Date(); heute7.setDate(heute7.getDate() + 7);
    const heute30= new Date(); heute30.setDate(heute30.getDate() + 30);

    const kritisch = [];
    const bald     = [];

    for (const a of alleArtikel) {
      if (!a.chargen || a.chargen.length === 0) continue;
      for (const c of a.chargen) {
        if (!c.verfall) continue;
        const verfall = new Date(c.verfall);
        const days    = Math.round((verfall - heute) / (1000*60*60*24));

        if (days <= 0) {
          kritisch.push({ name: a.name, lot: c.lot, days, label: 'ABGELAUFEN' });
        } else if (days <= 7) {
          kritisch.push({ name: a.name, lot: c.lot, days, label: `${days} Tage` });
        } else if (days <= 30) {
          bald.push({ name: a.name, lot: c.lot, days, label: `${days} Tage` });
        }
      }
    }

    // Kritische Artikel sofort melden
    if (kritisch.length > 0) {
      const namen = kritisch.slice(0,3).map(x => `${x.name} (${x.label})`).join(', ');
      await PWA.notify(
        `🔴 ${kritisch.length} Artikel kritisch!`,
        namen + (kritisch.length > 3 ? ` und ${kritisch.length-3} weitere` : ''),
        '/Lagerbestellung/pages/portal.html',
        true // urgent = bleibt bis weggeklickt
      );
    }

    // Bald ablaufende Artikel
    if (bald.length > 0 && kritisch.length === 0) {
      const namen = bald.slice(0,3).map(x => `${x.name} (${x.label})`).join(', ');
      await PWA.notify(
        `🟡 ${bald.length} Artikel laufen bald ab`,
        namen,
        '/Lagerbestellung/pages/portal.html',
      );
    }
  },

  // ── Lagercheck Benachrichtigung ──
  async notifyLagercheck(mitarbeiter, nachbestellungen) {
    if (Notification.permission !== 'granted') return;

    const nb = nachbestellungen || 0;
    await PWA.notify(
      '📋 Lagercheck abgeschlossen',
      nb > 0
        ? `${mitarbeiter} hat ${nb} Artikel zum Bestellen gemeldet`
        : `${mitarbeiter} – alles in Ordnung ✅`,
      '/Lagerbestellung/pages/portal.html',
    );
  },

  // ── Update Banner ──
  showUpdateBanner() {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: var(--surface); border: 1px solid var(--accent);
      border-radius: 12px; padding: 12px 20px; z-index: 9999;
      display: flex; align-items: center; gap: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      font-family: 'DM Sans', sans-serif; font-size: 0.85rem;
      color: var(--text); white-space: nowrap;
    `;
    banner.innerHTML = `
      <span>🔄 Update verfügbar!</span>
      <button onclick="window.location.reload()" style="
        background: var(--accent); color: white; border: none;
        border-radius: 8px; padding: 6px 14px; cursor: pointer;
        font-size: 0.82rem; font-weight: 600; font-family: 'DM Sans', sans-serif;
      ">Jetzt laden</button>
      <button onclick="this.parentElement.remove()" style="
        background: none; border: none; color: var(--muted);
        cursor: pointer; font-size: 1rem; padding: 0 4px;
      ">✕</button>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 10000);
  },

  // ── Install Prompt (Android) ──
  initInstallPrompt() {
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;

      // Install Button anzeigen falls vorhanden
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

    window.addEventListener('appinstalled', () => {
      console.log('✅ App installiert');
    });
  },

  // ── Notification Permission Button HTML ──
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
