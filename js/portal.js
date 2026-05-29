    import { initializeApp, getApps, deleteApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
    import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword }
                              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
    import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, where, onSnapshot, Timestamp, writeBatch }
                              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
    import { getStorage, ref as storageRef, getDownloadURL, getBytes }
                              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
    import { firebaseConfig } from "../js/firebase-config.js";

    // Theme
    const savedTheme  = localStorage.getItem('lager-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme       = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
    window.toggleTheme = function() {
      const cur  = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('lager-theme', next);
      document.getElementById('theme-toggle').textContent = next === 'dark' ? '☀️' : '🌙';
    };

    // Firebase

    const app     = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const auth    = getAuth(app);
    const db      = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    const storage = getStorage(app);

    const CLOUDINARY_CLOUD  = 'dvqug2dcx';
    const CLOUDINARY_PRESET = 'lagerapp_unsigned';

    let alleArtikel   = [];
    let alleBereiche  = [];
    let alleBestellungen = [];
    let currentPin    = '1234';
    let newPinValue   = '';
    let pinVisible    = false;
    let chargenFilter = 'alle';
    let chargenSort   = 'bereich';
    let currentBest   = null;
    let currentFotoType = 'produkt';

    // ── Auth ──
    onAuthStateChanged(auth, async user => {
      if (!user) { window.location.href = 'login.html'; return; }
      const snap = await getDoc(doc(db, 'users', user.uid));
      const role = snap.exists() ? snap.data().role : null;
      if (role !== 'wachenleiter' && role !== 'admin') {
        window.location.href = 'login.html?tab=wachenleiter'; return;
      }
      const displayName = snap.data()?.name || user.email;
      window._portalDisplayName = displayName;
      document.getElementById('nav-user').textContent = user.email;
      document.getElementById('auth-loading').classList.add('hidden');
      document.getElementById('portal-layout').classList.remove('hidden');
      document.getElementById('bottom-nav').classList.remove('hidden');
      document.getElementById('dashboard-greeting').textContent = `Willkommen, ${displayName}`;
      const sidebarName = document.getElementById('sidebar-user-name');
      if (sidebarName) sidebarName.textContent = displayName;
      const sidebarAvatar = document.getElementById('sidebar-user-avatar');
      if (sidebarAvatar) sidebarAvatar.textContent = (displayName[0] || 'W').toUpperCase();

      // Admin-Button nur für Admins anzeigen
      if (role === 'admin') {
        const adminBtn = document.createElement('a');
        adminBtn.href = 'admin.html';
        adminBtn.className = 'nav-action-btn hide-mobile';
        adminBtn.textContent = '⚙️ Admin';
        document.querySelector('.p-btn-logout').before(adminBtn);
      }

      await loadAll();
      setupSessionListener();
    });

    window.doLogout = async function() {
      ['lager-pin-auth','lager-pin-name','lager-employee-id','lager-portal-role'].forEach(k => {
        sessionStorage.removeItem(k);
        localStorage.removeItem(k);
      });
      localStorage.removeItem('lager-keep-login');
      await signOut(auth);
      window.location.href = 'login.html';
    };

    window.goToMitarbeiter = function() {
      const name = window._portalDisplayName || document.getElementById('nav-user').textContent;
      sessionStorage.setItem('lager-pin-auth', 'true');
      sessionStorage.setItem('lager-portal-role', 'wachenleiter');
      if (name) sessionStorage.setItem('lager-pin-name', name);
      window.location.href = 'mitarbeiter.html';
    };

    window.toggleMobileNav = function() {
      openBottomSheet();
    };

    // ── Load All ──
    async function loadAll() {
      const [bSnap, aSnap, bestSnap, configSnap] = await Promise.all([
        getDocs(query(collection(db, 'bereiche'), orderBy('reihenfolge'))),
        getDocs(collection(db, 'artikel')),
        getDocs(query(collection(db, 'bestellungen'), orderBy('datum', 'desc'), limit(50))),
        getDoc(doc(db, 'config', 'app')),
      ]);

      alleBereiche     = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      alleArtikel      = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      alleBestellungen = bestSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (configSnap.exists()) {
        currentPin = configSnap.data().pin || '1234';
        const lbText = configSnap.data().laufband || '';
        const lbInput = document.getElementById('laufband-input');
        if (lbInput) { lbInput.value = lbText; updateLaufbandPreview(); }
      }

      renderDashboard();
      renderBestellungen();
      renderChargen();
      renderArtikelTable(alleArtikel);
      renderBereiche();
      renderFotos();
      populateBereichFilter();
      populateFotoSelect();
      populateSsBereichFilter();
      populateFotoBereichFilter();
    }

    // ── Navigation ──
    const moreSheetSections = ['artikel','bereiche','fotos','ss-fotos','statistik','pin','analytics','sessions','verfallskalender','rollen','mitarbeiter','anleitung','laufband'];

    window.showSection = function(name) {
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.bottom-tab').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.bottom-sheet-item').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${name}`).classList.add('active');
      const nav = document.getElementById(`nav-${name}`);
      if (nav) nav.classList.add('active');
      const bottomTab = document.querySelector(`.bottom-tab[data-section="${name}"]`);
      if (bottomTab) {
        bottomTab.classList.add('active');
      } else if (moreSheetSections.includes(name)) {
        document.getElementById('bottom-more-tab').classList.add('active');
        const sheetItem = document.querySelector(`.bottom-sheet-item[data-section="${name}"]`);
        if (sheetItem) sheetItem.classList.add('active');
      }
      if (name === 'statistik') renderStatistik();
      if (name === 'ss-fotos') renderSsFotos();
      if (name === 'anleitung') renderAnleitung();
      if (name === 'analytics') renderAnalytics();
      if (name === 'verfallskalender') renderVerfallskalender();
      if (name === 'rollen') loadRollen();
      if (name === 'mitarbeiter') loadMitarbeiter();
    };

    window.openBottomSheet = function() {
      document.getElementById('bottom-sheet-backdrop').classList.remove('hidden');
      document.getElementById('bottom-sheet-backdrop').classList.add('open');
      document.getElementById('bottom-sheet').classList.add('open');
    };

    window.closeBottomSheet = function() {
      document.getElementById('bottom-sheet-backdrop').classList.remove('open');
      document.getElementById('bottom-sheet').classList.remove('open');
      setTimeout(() => document.getElementById('bottom-sheet-backdrop').classList.add('hidden'), 300);
    };

    function esc(str) {
      return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function prettyBereich(name) {
      return String(name ?? '').replace(/^Lager\s*[-–]\s*/i, '').trim();
    }

    // ── Analytics (echte Firestore-Daten) ──
    function renderAnalytics() {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const lagerchecksMonat = alleBestellungen.filter(b => {
        const d = b.datum?.toDate ? b.datum.toDate() : new Date(b.datum);
        return d >= firstOfMonth;
      }).length;

      const kritischeArtikel = alleArtikel.filter(a =>
        (a.items || []).some(it => it.status === 'crit') ||
        (a.status === 'crit')
      );

      // KPI Cards
      document.getElementById('analytics-kpis').innerHTML = `
        <div class="la-card outline" style="padding:16px 18px;">
          <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);margin-bottom:6px;">Lagerchecks (dieser Monat)</div>
          <div style="font-size:32px;font-weight:700;letter-spacing:-.5px;line-height:1;font-family:var(--font-mono)">${lagerchecksMonat}</div>
          <div style="font-size:11px;color:var(--ink-3);margin-top:4px;">${alleBestellungen.length} gesamt in den letzten 50</div>
        </div>
        <div class="la-card outline" style="padding:16px 18px;">
          <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);margin-bottom:6px;">Kritische Artikel</div>
          <div style="font-size:32px;font-weight:700;letter-spacing:-.5px;line-height:1;font-family:var(--font-mono);color:var(--crit)">${kritischeArtikel.length}</div>
          <div style="font-size:11px;color:var(--crit);margin-top:4px;">${kritischeArtikel.length > 0 ? 'Sofort nachbestellen' : 'Alles im grünen Bereich'}</div>
        </div>`;

      // Letzte Bestellungen Tabelle
      const bestellRows = alleBestellungen.slice(0, 10).map((b, i) => {
        const d = b.datum?.toDate ? b.datum.toDate() : new Date(b.datum);
        const dateStr = isNaN(d) ? '–' : d.toLocaleDateString('de-DE');
        const cnt = (b.items || b.nachbestellungen || []).length || '–';
        return `<tr class="${i < alleBestellungen.slice(0,10).length - 1 ? 'lin-tr' : ''}">
          <td class="lin-td" style="font-family:var(--font-mono);font-size:12px;">${dateStr}</td>
          <td class="lin-td" style="font-size:13px;">${esc(b.mitarbeiter || b.name || '–')}</td>
          <td class="lin-td" style="text-align:right;font-family:var(--font-mono);font-size:12px;">${cnt}</td>
        </tr>`;
      }).join('');
      document.getElementById('analytics-bestellungen-tbody').innerHTML =
        bestellRows || '<tr><td colspan="3" class="lin-td" style="text-align:center;color:var(--ink-3);">Keine Bestellungen</td></tr>';

      // Kritische Artikel Tabelle
      const kritRows = kritischeArtikel.slice(0, 10).map((a, i) => {
        const bereich = alleBereiche.find(b => b.id === a.bereich)?.name || a.bereich || '–';
        return `<tr class="${i < kritischeArtikel.slice(0,10).length - 1 ? 'lin-tr' : ''}">
          <td class="lin-td" style="font-size:13px;font-weight:500;">${esc(a.name)}</td>
          <td class="lin-td" style="font-size:12px;color:var(--ink-2);">${esc(bereich)}</td>
          <td class="lin-td" style="text-align:center;"><span class="la-chip crit" style="height:18px;font-size:10px;"><span class="dot"></span>Kritisch</span></td>
        </tr>`;
      }).join('');
      document.getElementById('analytics-kritisch-tbody').innerHTML =
        kritRows || '<tr><td colspan="3" class="lin-td" style="text-align:center;color:var(--ok);">Keine kritischen Artikel</td></tr>';
    }

    // ── Live Sessions (echte Firestore-Daten via onSnapshot) ──
    function setupSessionListener() {
      onSnapshot(doc(db, 'bestellungen_session', 'current'), (snap) => {
        const activeCard = document.getElementById('sessions-active-card');
        const noActive   = document.getElementById('sessions-no-active');
        const badge      = document.getElementById('session-live-badge');

        if (snap.exists() && snap.data().status === 'aktiv') {
          const s = snap.data();
          badge.style.display = 'inline-flex';
          activeCard.style.display = 'block';
          noActive.style.display   = 'none';

          // Meta info
          document.getElementById('sessions-active-meta').textContent =
            `PIN ···· · Gestartet ${s.startedAt?.toDate
              ? s.startedAt.toDate().toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'})
              : 'Unbekannt'}`;

          // Teilnehmer
          const teilnehmer = (s.teilnehmer || []);
          document.getElementById('sessions-active-teilnehmer').innerHTML = teilnehmer.length
            ? teilnehmer.map(t => `<div style="display:flex;align-items:center;gap:8px;">
                <span class="la-av live" style="width:28px;height:28px;font-size:10px;">${esc(t.name||'?').slice(0,2).toUpperCase()}</span>
                <span style="font-size:13px;">${esc(t.name)}</span>
              </div>`).join('')
            : '<span style="font-size:13px;color:var(--ink-3);">Keine Teilnehmer</span>';

          // Bereiche
          const bereichStatus = s.bereichStatus || {};
          const bereichRows = Object.entries(bereichStatus).map(([bid, bs]) => {
            const bName = alleBereiche.find(b => b.id === bid)?.name || bid;
            const dot = bs.status === 'erledigt' ? '🟢' : bs.status === 'gesperrt' ? '🟠' : bs.status === 'abgebrochen' ? '🔴' : '⚪';
            return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-2);padding:3px 0;">
              <span>${dot}</span><span>${esc(bName)}</span>
              ${bs.mitarbeiter ? `<span style="color:var(--ink-3)">· ${esc(bs.mitarbeiter)}</span>` : ''}
            </div>`;
          });
          document.getElementById('sessions-active-bereiche').innerHTML =
            bereichRows.length ? bereichRows.join('') : '<span style="font-size:12px;color:var(--ink-3);">Noch kein Bereich gestartet</span>';
        } else {
          badge.style.display   = 'none';
          activeCard.style.display = 'none';
          noActive.style.display   = 'block';
        }

        // Vergangene Bestellungen
        const rows = alleBestellungen.slice(0, 10).map((b, i) => {
          const d = b.datum?.toDate ? b.datum.toDate() : new Date(b.datum);
          const dateStr = isNaN(d) ? '–' : d.toLocaleDateString('de-DE');
          const cnt = (b.items || b.nachbestellungen || []).length || '–';
          return `<tr class="${i < 9 ? 'lin-tr' : ''}">
            <td class="lin-td" style="font-family:var(--font-mono);font-size:12px;">${dateStr}</td>
            <td class="lin-td" style="font-size:13px;">${esc(b.mitarbeiter || b.name || '–')}</td>
            <td class="lin-td" style="text-align:right;font-family:var(--font-mono);font-size:12px;">${cnt}</td>
          </tr>`;
        }).join('');
        document.getElementById('sessions-past-tbody').innerHTML =
          rows || '<tr><td colspan="3" class="lin-td" style="text-align:center;color:var(--ink-3);">Keine vergangenen Bestellungen</td></tr>';
      }, () => {
        document.getElementById('sessions-no-active').style.display = 'block';
      });
    }

    // ── Session Reset ──
    window.resetSession = async function() {
      const ok = confirm(
        'Session komplett zurücksetzen?\n\n' +
        'Dadurch wird die laufende Bestellung gelöscht – alle Bereiche und Warenkorb-Einträge gehen verloren.\n\n' +
        'Nur nutzen wenn die Session feststeckt!'
      );
      if (!ok) return;

      try {
        // Delete all warenkorb docs for this session
        const wSnap = await getDocs(
          query(collection(db, 'warenkorb'), where('sessionId', '==', 'current'))
        );
        if (!wSnap.empty) {
          const batch = writeBatch(db);
          wSnap.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }

        // Delete the session document
        await deleteDoc(doc(db, 'bestellungen_session', 'current'));

        showToast('Session wurde zurückgesetzt', 'success');
      } catch(e) {
        showToast('Fehler: ' + e.message, 'error');
      }
    };

    // ── Laufband ──
    window.updateLaufbandPreview = function() {
      const text = document.getElementById('laufband-input')?.value.trim() || '';
      const el = document.getElementById('laufband-preview-text');
      if (el) el.textContent = text || '(kein Text)';
    };

    window.saveLaufband = async function() {
      const text = document.getElementById('laufband-input')?.value.trim() || '';
      try {
        await setDoc(doc(db, 'config', 'app'), { laufband: text }, { merge: true });
        showToast('Laufband gespeichert', 'success');
      } catch(e) {
        showToast('Fehler: ' + e.message, 'error');
      }
    };

    window.clearLaufband = async function() {
      const input = document.getElementById('laufband-input');
      if (input) input.value = '';
      updateLaufbandPreview();
      try {
        await setDoc(doc(db, 'config', 'app'), { laufband: '' }, { merge: true });
        showToast('Laufband gelöscht', 'success');
      } catch(e) {
        showToast('Fehler: ' + e.message, 'error');
      }
    };

    // ── Verfallskalender ──
    window.setVkView = function(view) {
      document.getElementById('vk-view-liste').style.display    = view === 'liste' ? '' : 'none';
      document.getElementById('vk-view-kalender').style.display = view === 'kalender' ? '' : 'none';
      const btnL = document.getElementById('vk-btn-liste');
      const btnK = document.getElementById('vk-btn-kalender');
      btnL.style.background  = view === 'liste'    ? 'var(--surface-3)' : 'transparent';
      btnK.style.background  = view === 'kalender' ? 'var(--surface-3)' : 'transparent';
      btnL.style.fontWeight  = view === 'liste'    ? '600' : '400';
      btnK.style.fontWeight  = view === 'kalender' ? '600' : '400';
      btnL.style.color       = view === 'liste'    ? 'var(--ink)'  : 'var(--ink-3)';
      btnK.style.color       = view === 'kalender' ? 'var(--ink)'  : 'var(--ink-3)';
    };

    let vkRendered = false;
    function renderVerfallskalender() {
      if (vkRendered) return;
      vkRendered = true;

      const heute = new Date();
      heute.setHours(0, 0, 0, 0);

      // Collect all charges with a verfall date
      const charges = [];
      for (const a of alleArtikel) {
        for (const c of (a.chargen || [])) {
          if (!c.verfall) continue;
          const exp  = new Date(c.verfall);
          const days = Math.round((exp - heute) / 86400000);
          const bereich = alleBereiche.find(b => b.id === a.bereichId)?.name || a.bereichId || '–';
          charges.push({ a, c, days, exp, bereich });
        }
      }
      charges.sort((x, y) => x.days - y.days);

      // Bucket counts
      const akut    = charges.filter(x => x.days <= 7).length;
      const monat   = charges.filter(x => x.days > 7  && x.days <= 30).length;
      const spaeter = charges.filter(x => x.days > 30).length;
      document.getElementById('vk-count-akut').textContent    = akut;
      document.getElementById('vk-count-monat').textContent   = monat;
      document.getElementById('vk-count-spaeter').textContent = spaeter;

      // Badge
      const badge = document.getElementById('vk-badge');
      const badgeCount = document.getElementById('vk-badge-count');
      if (akut > 0) {
        badge.style.display = 'inline-flex';
        badge.className = 'la-chip crit';
        badgeCount.textContent = akut;
      } else if (monat > 0) {
        badge.style.display = 'inline-flex';
        badge.className = 'la-chip low';
        badgeCount.textContent = monat;
      } else {
        badge.style.display = 'none';
      }

      // Liste-View
      const timeline = document.getElementById('vk-timeline-list');
      if (charges.length === 0) {
        timeline.innerHTML = '<div style="padding:20px 16px;font-size:13px;color:var(--ink-3);text-align:center;">Keine Chargen mit Verfallsdatum erfasst</div>';
      } else {
        timeline.innerHTML = charges.map((x, i) => {
          const isLast = i === charges.length - 1;
          let dotColor = 'var(--ink-4)';
          let daysLabel = '';
          if (x.days < 0) {
            dotColor = 'var(--crit)';
            daysLabel = `Abgelaufen vor ${Math.abs(x.days)} Tag${Math.abs(x.days) === 1 ? '' : 'en'}`;
          } else if (x.days === 0) {
            dotColor = 'var(--crit)';
            daysLabel = 'Läuft heute ab';
          } else if (x.days <= 7) {
            dotColor = 'var(--crit)';
            daysLabel = `Noch ${x.days} Tag${x.days === 1 ? '' : 'e'}`;
          } else if (x.days <= 30) {
            dotColor = 'var(--low)';
            daysLabel = `Noch ${x.days} Tage`;
          } else {
            dotColor = 'var(--ok)';
            daysLabel = `Noch ${x.days} Tage`;
          }
          const verfallStr = x.exp.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
          return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;${isLast ? '' : 'border-bottom:1px solid var(--hairline);'}">
            <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(x.a.name)}</div>
              <div style="font-size:11px;color:var(--ink-3);margin-top:1px;">${esc(prettyBereich(x.bereich))}${x.c.lot ? ` · LOT ${esc(x.c.lot)}` : ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:12px;font-family:var(--font-mono);">${verfallStr}</div>
              <div style="font-size:11px;color:${dotColor};margin-top:1px;">${daysLabel}</div>
            </div>
          </div>`;
        }).join('');
      }

      // Kalender-View: 6-Monats-Heatmap
      const grid = document.getElementById('vk-heatmap-grid');
      const monthCards = [];
      for (let m = 0; m < 6; m++) {
        const d = new Date(heute.getFullYear(), heute.getMonth() + m, 1);
        const year  = d.getFullYear();
        const month = d.getMonth();
        const monthCharges = charges.filter(x => {
          return x.exp.getFullYear() === year && x.exp.getMonth() === month;
        });
        const akutM    = monthCharges.filter(x => x.days <= 7).length;
        const monatM   = monthCharges.filter(x => x.days > 7 && x.days <= 30).length;
        const spaeterM = monthCharges.filter(x => x.days > 30).length;
        const isThisMonth = m === 0;
        const color = akutM > 0 ? 'var(--crit)' : monatM > 0 ? 'var(--low)' : spaeterM > 0 ? '#F0A12E' : 'var(--ink-4)';
        const monthName = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
        monthCards.push(`<div class="la-card outline" style="padding:12px;${isThisMonth ? 'box-shadow:inset 0 0 0 2px var(--brand);' : ''}">
          <div style="font-size:10px;font-family:var(--font-mono);color:${isThisMonth ? 'var(--brand)' : 'var(--ink-3)'};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">${monthName}</div>
          <div style="font-size:22px;font-weight:700;color:${monthCharges.length > 0 ? color : 'var(--ink-4)'};">${monthCharges.length}</div>
          <div style="font-size:10px;color:var(--ink-3);margin-top:2px;">Charge${monthCharges.length !== 1 ? 'n' : ''}</div>
        </div>`);
      }
      grid.innerHTML = monthCards.join('');
    }

    // ── Konten & Rollen (echte Firestore-Daten) ──
    let alleUsers = [];
    let aktiverRollenFilter = 'alle';

    async function loadRollen() {
      if (alleUsers.length > 0) { renderRollen(); return; }
      try {
        const snap = await getDocs(collection(db, 'users'));
        alleUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderRollen();
      } catch(e) {
        document.getElementById('rollen-liste').innerHTML =
          `<div style="padding:12px 16px;font-size:13px;color:var(--crit);">Fehler: ${esc(e.message)}</div>`;
      }
    }

    function renderRollen() {
      const rollenMap = {};
      alleUsers.forEach(u => {
        const r = u.role || 'unbekannt';
        rollenMap[r] = (rollenMap[r] || []);
        rollenMap[r].push(u);
      });

      // Rollen-Panel
      const alleRollenListe = [{ id: 'alle', label: 'Alle', count: alleUsers.length }];
      Object.entries(rollenMap).forEach(([r, users]) => {
        alleRollenListe.push({ id: r, label: r.charAt(0).toUpperCase() + r.slice(1), count: users.length });
      });

      document.getElementById('rollen-liste').innerHTML = alleRollenListe.map(r => `
        <div onclick="setRollenFilter('${esc(r.id)}')"
             style="padding:10px 16px;cursor:pointer;border-left:2px solid ${aktiverRollenFilter===r.id?'var(--brand)':'transparent'};
                    background:${aktiverRollenFilter===r.id?'var(--surface)':'transparent'};
                    display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:13px;font-weight:${aktiverRollenFilter===r.id?'600':'400'}">${esc(r.label)}</span>
          <span style="font-size:11px;color:var(--ink-3);font-family:var(--font-mono);">${r.count}</span>
        </div>`).join('');

      renderRollenUsers();
    }

    window.setRollenFilter = function(rolle) {
      aktiverRollenFilter = rolle;
      renderRollen();
    };

    window.filterRollenSearch = function() {
      renderRollenUsers();
    };

    function renderRollenUsers() {
      const search = (document.getElementById('rollen-search')?.value || '').toLowerCase();
      const filtered = alleUsers.filter(u => {
        const matchRole = aktiverRollenFilter === 'alle' || u.role === aktiverRollenFilter;
        const matchSearch = !search ||
          (u.name || '').toLowerCase().includes(search) ||
          (u.email || '').toLowerCase().includes(search);
        return matchRole && matchSearch;
      });

      const label = aktiverRollenFilter === 'alle' ? 'Alle Konten' :
        `${aktiverRollenFilter.charAt(0).toUpperCase()}${aktiverRollenFilter.slice(1)} · ${filtered.length} Konto${filtered.length !== 1 ? 'en' : ''}`;
      document.getElementById('rollen-user-header').textContent = label;

      const rows = filtered.map((u, i) => {
        const d = u.createdAt ? new Date(u.createdAt).toLocaleDateString('de-DE') : '–';
        return `<tr class="${i < filtered.length - 1 ? 'lin-tr' : ''}">
          <td class="lin-td" style="font-size:13px;font-weight:500;">${esc(u.name || '–')}</td>
          <td class="lin-td" style="font-size:12px;color:var(--ink-2);font-family:var(--font-mono);">${esc(u.email || '–')}</td>
          <td class="lin-td"><span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;
            background:${u.role==='admin'?'var(--crit-soft)':u.role==='wachenleiter'?'var(--brand-soft)':'var(--surface-3)'};
            color:${u.role==='admin'?'var(--crit)':u.role==='wachenleiter'?'var(--brand)':'var(--ink-2)'}">
            ${esc(u.role || '–')}</span></td>
          <td class="lin-td" style="font-size:12px;color:var(--ink-3);">${d}</td>
        </tr>`;
      }).join('');

      document.getElementById('rollen-user-tbody').innerHTML =
        rows || '<tr><td colspan="4" class="lin-td" style="text-align:center;color:var(--ink-3);">Keine Konten gefunden</td></tr>';
    }

    // ── Toast ──
    function toast(msg, type = 'success') {
      const existing = document.querySelector('.toast-msg');
      if (existing) existing.remove();
      const t = document.createElement('div');
      t.className = `toast-msg ${type}`;
      t.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2500);
    }

    // ── DASHBOARD ──
    function renderDashboard() {
      document.getElementById('kpi-artikel').textContent = alleArtikel.length;
      document.getElementById('kpi-total').textContent   = alleBestellungen.length;

      if (alleBestellungen.length > 0) {
        const last = alleBestellungen[0];
        const d = last.datum?.toDate ? last.datum.toDate() : new Date();
        document.getElementById('kpi-last').textContent     = d.toLocaleDateString('de-DE');
        document.getElementById('kpi-last-sub').textContent = last.mitarbeiter || '–';
      }

      const kritisch = alleArtikel.filter(a =>
        (a.chargen||[]).some(c => {
          const days = Math.round((new Date(c.verfall||'9999') - new Date()) / (1000*60*60*24));
          return days <= 30;
        })
      ).length;
      document.getElementById('kpi-verfall').textContent = kritisch;
      document.getElementById('kpi-verfall').style.color = kritisch > 0 ? 'var(--red)' : 'var(--green)';

      const last5 = alleBestellungen.slice(0, 5);
      const wrap  = document.getElementById('dashboard-bestellungen');
      if (last5.length === 0) {
        wrap.innerHTML = '<div class="empty-state">Noch keine Lagerchecks</div>';
        return;
      }
      wrap.innerHTML = `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="padding:8px 14px;text-align:left;font-size:0.62rem;color:var(--muted);text-transform:uppercase;font-family:'IBM Plex Mono',monospace;background:var(--surface2);border-bottom:1px solid var(--border);">Mitarbeiter</th>
          <th style="padding:8px 14px;text-align:left;font-size:0.62rem;color:var(--muted);text-transform:uppercase;font-family:'IBM Plex Mono',monospace;background:var(--surface2);border-bottom:1px solid var(--border);">Datum</th>
          <th style="padding:8px 14px;text-align:left;font-size:0.62rem;color:var(--muted);text-transform:uppercase;font-family:'IBM Plex Mono',monospace;background:var(--surface2);border-bottom:1px solid var(--border);">Nachbestell.</th>
          <th style="padding:8px 14px;text-align:left;font-size:0.62rem;color:var(--muted);text-transform:uppercase;font-family:'IBM Plex Mono',monospace;background:var(--surface2);border-bottom:1px solid var(--border);">PDF</th>
        </tr></thead>
        <tbody>${last5.map(b => {
          const d  = b.datum?.toDate ? b.datum.toDate() : new Date();
          const nb = (b.items || b.nachbestellungen || []).length;
          return `<tr style="cursor:pointer;" onclick="openDetail('${b.id}')">
            <td style="padding:10px 14px;font-size:0.82rem;font-weight:600;border-bottom:1px solid var(--border);">${b.mitarbeiter||'–'}</td>
            <td style="padding:10px 14px;font-size:0.75rem;font-family:'IBM Plex Mono',monospace;color:var(--muted);border-bottom:1px solid var(--border);">${d.toLocaleDateString('de-DE')}</td>
            <td style="padding:10px 14px;font-size:0.75rem;border-bottom:1px solid var(--border);color:${nb>0?'var(--red)':'var(--green)'};">${nb>0?`⚠️ ${nb}`:'✅ Keine'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid var(--border);">
              <div style="display:flex;gap:4px;">
                <button class="tbl-btn" onclick="event.stopPropagation();quickPDF('${b.id}',this)">↓ PDF</button>
                <button class="tbl-btn del" onclick="event.stopPropagation();deleteBestellung('${b.id}')">🗑️</button>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    }

    // ── BESTELLUNGEN ──
    function renderBestellungen() {
      const list = document.getElementById('bestellungen-list');
      if (alleBestellungen.length === 0) {
        list.innerHTML = '<div class="empty-state">Noch keine Lagerchecks</div>';
        return;
      }
      list.innerHTML = alleBestellungen.map(b => {
        const d  = b.datum?.toDate ? b.datum.toDate() : new Date();
        const nb = (b.items || b.nachbestellungen || []).length;
        return `
          <div class="bestellung-item" onclick="openDetail('${b.id}')">
            <div class="bestellung-icon">📋</div>
            <div class="bestellung-info">
              <div class="bestellung-name">${b.mitarbeiter||'Unbekannt'}</div>
              <div class="bestellung-meta">${d.toLocaleDateString('de-DE')} · ${d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</div>
              ${nb>0?`<div class="bestellung-warn">⚠️ ${nb} Artikel nachbestellen</div>`:'<div style="font-size:0.68rem;color:var(--green);">✅ Alles in Ordnung</div>'}
            </div>
            <button class="tbl-btn" onclick="event.stopPropagation();quickPDF('${b.id}',this)">↓ PDF</button>
          </div>`;
      }).join('');
    }

    // ── CHARGEN (Fach für Fach) ──
    window.setChargenFilter = function(f) {
      chargenFilter = f;
      ['alle','kritisch','ok'].forEach(x =>
        document.getElementById(`cf-${x}`).classList.toggle('active', x === f)
      );
      renderChargen();
    };

    window.setChargenSort = function(s) {
      chargenSort = s;
      ['bereich','verfall','name'].forEach(x => {
        const el = document.getElementById(`sort-${x}`);
        if (el) el.classList.toggle('active', x === s);
      });
      renderChargen();
    };

    function renderChargen() {
      const container = document.getElementById('chargen-content');
      const heute     = new Date();
      let totalChargen = 0;

      // Alle Chargen sammeln
      let allRows = [];
      for (const a of alleArtikel) {
        const bereich = alleBereiche.find(b => b.id === a.bereich);
        for (const c of (a.chargen || [])) {
          const days = Math.round((new Date(c.verfall||'9999') - heute) / (1000*60*60*24));
          if (chargenFilter === 'kritisch' && days > 30)  continue;
          if (chargenFilter === 'ok'       && days <= 30) continue;
          allRows.push({ artikel: a, charge: c, days, bereich });
        }
      }

      if (allRows.length === 0) {
        container.innerHTML = '<div class="empty-state">🟢 Keine Chargen gefunden</div>';
        return;
      }

      // Sortierung
      if (chargenSort === 'verfall') {
        allRows.sort((a, b) => a.days - b.days);
      } else if (chargenSort === 'name') {
        allRows.sort((a, b) => (a.artikel.name||'').localeCompare(b.artikel.name||''));
      } else {
        // Bereich-Sortierung (nach Reihenfolge in alleBereiche)
        const bereichOrder = {};
        alleBereiche.forEach((b, i) => bereichOrder[b.id] = i);
        allRows.sort((a, b) => {
          const bo = (bereichOrder[a.artikel.bereich]||99) - (bereichOrder[b.artikel.bereich]||99);
          if (bo !== 0) return bo;
          return naturalSort(a.artikel.lp||'', b.artikel.lp||'');
        });
      }

      totalChargen = allRows.length;

      // Gruppieren
      let html    = '';
      let lastKey = null;

      for (const { artikel: a, charge: c, days, bereich } of allRows) {
        const color = days <= 0 ? 'var(--red)' : days <= 7 ? 'var(--red)' : days <= 30 ? 'var(--yellow)' : 'var(--green)';
        const label = days <= 0 ? 'ABGELAUFEN' : days <= 30 ? `${days} Tage` : `${Math.round(days/30)} Mon.`;

        // Gruppenheader
        let groupKey;
        if (chargenSort === 'bereich') {
          groupKey = a.bereich;
          if (groupKey !== lastKey) {
            if (lastKey !== null) html += '</div>';
            const icon = getBereichIcon(bereich?.name||'');
            html += `<div class="bereich-group">
              <div class="bereich-group-header">
                <span class="bereich-group-icon">${icon}</span>
                ${esc(prettyBereich(bereich?.name||'Unbekannt'))}
              </div>`;
            lastKey = groupKey;
          }
        } else if (chargenSort === 'verfall') {
          groupKey = days <= 0 ? 'abgelaufen' : days <= 7 ? 'kritisch' : days <= 30 ? 'bald' : 'ok';
          if (groupKey !== lastKey) {
            if (lastKey !== null) html += '</div>';
            const labels = { abgelaufen:'🔴 Abgelaufen', kritisch:'🔴 Kritisch (≤7 Tage)', bald:'🟡 Bald (≤30 Tage)', ok:'🟢 OK' };
            html += `<div class="bereich-group">
              <div class="bereich-group-header">${labels[groupKey]}</div>`;
            lastKey = groupKey;
          }
        } else {
          // Name – keine Gruppen
          if (lastKey === null) {
            html += '<div class="bereich-group">';
            lastKey = 'all';
          }
        }

        // Charge-Zeile mit Bearbeiten-Button
        const chargeIdx = (a.chargen||[]).findIndex(x => x.lot === c.lot && x.verfall === c.verfall);
        html += `
          <div class="charge-row" id="crow-${a.id}-${chargeIdx}">
            <div class="charge-dot" style="background:${color}"></div>
            <div class="charge-info" style="flex:1;min-width:0;">
              <div class="charge-name">${a.name}</div>
              <div class="charge-lot">LOT: ${c.lot||'–'} · ${c.verfall ? new Date(c.verfall).toLocaleDateString('de-DE',{month:'2-digit',year:'numeric'}) : '–'} · ${a.lp||''}</div>
            </div>
            <div class="charge-days" style="color:${color};flex-shrink:0;">${label}</div>
            <button class="charge-del" style="color:var(--accent2);font-size:0.75rem;padding:4px 6px;"
              onclick="editCharge('${a.id}',${chargeIdx})">✏️</button>
            <button class="charge-del"
              onclick="deleteCharge('${a.id}','${c.lot}','${c.verfall||''}')">✕</button>
          </div>`;
      }

      if (lastKey !== null) html += '</div>';
      container.innerHTML = html;
    }

    // ── Charge bearbeiten ──
    window.editCharge = function(artikelId, idx) {
      const a = alleArtikel.find(x => x.id === artikelId);
      if (!a) return;
      const c = (a.chargen||[])[idx];
      if (!c) return;

      // Inline-Edit einblenden
      const rowEl = document.getElementById(`crow-${artikelId}-${idx}`);
      if (!rowEl) return;

      rowEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;width:100%;padding:4px 0;">
          <div style="font-size:0.8rem;font-weight:600;color:var(--text2);">${a.name}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <div>
              <div style="font-size:0.6rem;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-bottom:2px;">CHARGE / LOT</div>
              <input type="text" id="edit-lot-${artikelId}-${idx}" value="${c.lot||''}"
                style="padding:6px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.82rem;width:140px;">
            </div>
            <div>
              <div style="font-size:0.6rem;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-bottom:2px;">VERFALLSDATUM</div>
              <input type="date" id="edit-verfall-${artikelId}-${idx}" value="${c.verfall||''}"
                style="padding:6px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.82rem;">
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="saveEditCharge('${artikelId}',${idx})"
              style="padding:6px 14px;border-radius:8px;background:var(--green);color:#fff;border:none;font-family:'DM Sans',sans-serif;font-size:0.8rem;font-weight:600;cursor:pointer;">
              ✅ Speichern
            </button>
            <button onclick="renderChargen()"
              style="padding:6px 14px;border-radius:8px;background:var(--surface2);color:var(--text2);border:1px solid var(--border);font-family:'DM Sans',sans-serif;font-size:0.8rem;cursor:pointer;">
              Abbrechen
            </button>
          </div>
        </div>`;
    };

    window.saveEditCharge = async function(artikelId, idx) {
      const newLot    = document.getElementById(`edit-lot-${artikelId}-${idx}`)?.value.trim();
      const newVerfall= document.getElementById(`edit-verfall-${artikelId}-${idx}`)?.value;

      const a = alleArtikel.find(x => x.id === artikelId);
      if (!a) return;

      const chargen = [...(a.chargen||[])];
      chargen[idx]  = { ...chargen[idx], lot: newLot, verfall: newVerfall || null };

      await updateDoc(doc(db, 'artikel', artikelId), { chargen });
      const i = alleArtikel.findIndex(x => x.id === artikelId);
      if (i >= 0) alleArtikel[i].chargen = chargen;

      showToast('Charge gespeichert ✅');
      renderChargen();
    };

    // ── Natürliche Sortierung für LP-Nummern ──
    function naturalSort(a, b) {
      const seg = s => (s||'').split(/[.\-]/).map(x => isNaN(x) ? x : parseInt(x,10));
      const sa = seg(a), sb = seg(b);
      for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
        const va = sa[i] ?? '', vb = sb[i] ?? '';
        if (va < vb) return -1;
        if (va > vb) return  1;
      }
      return 0;
    }

    function getBereichIcon(name) {
      const n = name.toLowerCase();
      if (n.includes('schrank')) return '🗄️';
      if (n.includes('regal'))   return '📦';
      if (n.includes('sauer'))   return '🫧';
      if (n.includes('büro'))    return '📋';
      if (n.includes('küche'))   return '🍽️';
      if (n.includes('wasch'))   return '🚿';
      if (n.includes('mpg'))     return '🔋';
      if (n.includes('medika'))  return '💊';
      return '📁';
    }

    window.deleteCharge = async function(artikelId, lot, verfall) {
      if (!confirm(`Charge ${lot} wirklich löschen?`)) return;
      const a       = alleArtikel.find(x => x.id === artikelId);
      const chargen = (a.chargen||[]).filter(c => !(c.lot === lot && (c.verfall||'') === verfall));
      await updateDoc(doc(db, 'artikel', artikelId), { chargen });
      const idx = alleArtikel.findIndex(x => x.id === artikelId);
      if (idx >= 0) alleArtikel[idx].chargen = chargen;
      renderChargen();
      toast('Charge gelöscht');
    };

    // ── ARTIKEL ──
    function renderArtikelTable(data) {
      data = [...data].sort((a,b) => naturalSort(a.lp||'', b.lp||''));
      const tbody = document.getElementById('artikel-tbody');
      tbody.innerHTML = data.map(a => {
        const b = alleBereiche.find(x => x.id === a.bereich);
        return `<tr>
          <td data-label="Artikel" style="font-weight:600;max-width:200px;">${a.name}</td>
          <td data-label="Standort" style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--accent);">${a.location||'–'}<br><span style="color:var(--muted);font-size:0.62rem;">${prettyBereich(b?.name||'–')}</span></td>
          <td data-label="MIN / MAX" style="font-family:'IBM Plex Mono',monospace;font-size:0.7rem;">${a.min??'–'} ${a.minEinheit||''} / ${a.max??'–'} ${a.maxEinheit||''}</td>
          <td data-label="Aktionen" style="display:flex;gap:6px;">
            <button class="tbl-btn" onclick="openArtikelModal('${a.id}')">✏️</button>
            <button class="tbl-btn del" onclick="deleteArtikel('${a.id}','${a.name.replace(/'/g,"\\'")}')">🗑️</button>
          </td>
        </tr>`;
      }).join('') || '<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--muted);">Keine Artikel</td></tr>';
    }

    window.filterArtikel = function(val) {
      const q = (val || document.getElementById('artikel-search').value || '').toLowerCase();
      const b = document.getElementById('bereich-filter').value;
      renderArtikelTable(alleArtikel.filter(a =>
        (!q || a.name?.toLowerCase().includes(q) || a.lp?.toLowerCase().includes(q)) &&
        (!b || a.bereich === b)
      ));
    };

    function populateBereichFilter() {
      const sel = document.getElementById('bereich-filter');
      sel.innerHTML = '';
      const def = document.createElement('option'); def.value = ''; def.textContent = 'Alle Bereiche';
      sel.appendChild(def);
      alleBereiche.forEach(b => {
        const o = document.createElement('option'); o.value = b.id; o.textContent = prettyBereich(b.name);
        sel.appendChild(o);
      });
    }

    window.openArtikelModal = function(id) {
      const sel = document.getElementById('edit-bereich');
      sel.innerHTML = '';
      alleBereiche.forEach(b => {
        const o = document.createElement('option'); o.value = b.id; o.textContent = prettyBereich(b.name);
        sel.appendChild(o);
      });
      if (id) {
        const a = alleArtikel.find(x => x.id === id);
        document.getElementById('artikel-modal-title').textContent = 'Artikel bearbeiten';
        document.getElementById('edit-id').value       = a.id;
        document.getElementById('edit-name').value     = a.name||'';
        document.getElementById('edit-lp').value       = a.lp||'';
        document.getElementById('edit-location').value = a.location||'';
        document.getElementById('edit-bereich').value  = a.bereich||'';
        document.getElementById('edit-min').value      = a.min??'';
        document.getElementById('edit-minE').value     = a.minEinheit||'';
        document.getElementById('edit-max').value      = a.max??'';
        document.getElementById('edit-maxE').value     = a.maxEinheit||'';
        document.getElementById('edit-aliases').value  = (a.aliases||[]).join(', ');
        document.getElementById('edit-hinweis').value  = a.hinweis||'';
      } else {
        document.getElementById('artikel-modal-title').textContent = 'Neuer Artikel';
        ['edit-id','edit-name','edit-lp','edit-location','edit-min','edit-minE','edit-max','edit-maxE','edit-aliases','edit-hinweis'].forEach(i => document.getElementById(i).value = '');
      }
      document.getElementById('artikel-modal').classList.remove('hidden');
    };

    window.closeArtikelModal = () => document.getElementById('artikel-modal').classList.add('hidden');

    window.saveArtikel = async function() {
      const id   = document.getElementById('edit-id').value;
      const name = document.getElementById('edit-name').value.trim();
      if (!name) { toast('Name ist Pflichtfeld', 'error'); return; }
      const data = {
        name,
        lp:         document.getElementById('edit-lp').value.trim(),
        location:   document.getElementById('edit-location').value.trim(),
        bereich:    document.getElementById('edit-bereich').value,
        min:        parseFloat(document.getElementById('edit-min').value) || null,
        minEinheit: document.getElementById('edit-minE').value.trim(),
        max:        parseFloat(document.getElementById('edit-max').value) || null,
        maxEinheit: document.getElementById('edit-maxE').value.trim(),
        aliases:    document.getElementById('edit-aliases').value.split(',').map(s=>s.trim()).filter(Boolean),
        hinweis:    document.getElementById('edit-hinweis').value.trim(),
      };
      try {
        if (id) {
          await updateDoc(doc(db, 'artikel', id), data);
          const idx = alleArtikel.findIndex(a => a.id === id);
          if (idx >= 0) alleArtikel[idx] = { ...alleArtikel[idx], ...data };
          toast('Artikel gespeichert');
        } else {
          const ref = await addDoc(collection(db, 'artikel'), { ...data, fotoUrl:'', chargen:[], aktiv:true });
          alleArtikel.push({ id: ref.id, ...data, fotoUrl:'', chargen:[] });
          toast('Artikel hinzugefügt');
        }
        closeArtikelModal();
        filterArtikel();
      } catch(e) { toast(e.message, 'error'); }
    };

    window.deleteArtikel = async function(id, name) {
      if (!confirm(`„${name}" wirklich löschen?`)) return;
      await deleteDoc(doc(db, 'artikel', id));
      alleArtikel = alleArtikel.filter(a => a.id !== id);
      filterArtikel();
      toast('Artikel gelöscht');
    };

    // ── BEREICHE ──
    function renderBereiche() {
      document.getElementById('bereich-list').innerHTML = alleBereiche.map(b => {
        const count = alleArtikel.filter(a => a.bereich === b.id).length;
        return `
          <div class="bereich-item">
            <div class="bereich-item-icon">${getBereichIcon(b.name)}</div>
            <div style="flex:1;">
              <div class="bereich-item-name">${esc(prettyBereich(b.name))}</div>
              <div class="bereich-item-count">${count} Artikel · Reihenfolge: ${b.reihenfolge}</div>
            </div>
            <button class="tbl-btn" onclick="openBereichModal('${b.id}')">✏️</button>
          </div>`;
      }).join('');
    }

    window.openBereichModal = function(id) {
      if (id) {
        const b = alleBereiche.find(x => x.id === id);
        document.getElementById('bereich-modal-title').textContent    = 'Bereich bearbeiten';
        document.getElementById('bereich-edit-id').value              = b.id;
        document.getElementById('bereich-edit-name').value            = b.name;
        document.getElementById('bereich-edit-reihenfolge').value     = b.reihenfolge;
      } else {
        document.getElementById('bereich-modal-title').textContent    = 'Neuer Bereich';
        document.getElementById('bereich-edit-id').value              = '';
        document.getElementById('bereich-edit-name').value            = '';
        document.getElementById('bereich-edit-reihenfolge').value     = alleBereiche.length + 1;
      }
      document.getElementById('bereich-modal').classList.remove('hidden');
    };

    window.closeBereichModal = () => document.getElementById('bereich-modal').classList.add('hidden');

    window.saveBereich = async function() {
      const id   = document.getElementById('bereich-edit-id').value;
      const name = document.getElementById('bereich-edit-name').value.trim();
      const reihenfolge = parseInt(document.getElementById('bereich-edit-reihenfolge').value) || 99;
      if (!name) { toast('Name ist Pflichtfeld', 'error'); return; }
      try {
        if (id) {
          await updateDoc(doc(db, 'bereiche', id), { name, reihenfolge });
          const idx = alleBereiche.findIndex(b => b.id === id);
          if (idx >= 0) alleBereiche[idx] = { ...alleBereiche[idx], name, reihenfolge };
          toast('Bereich gespeichert');
        } else {
          const slug = name.toLowerCase().replace(/\s+/g,'-').replace(/[äöüß]/g,c=>({ä:'ae',ö:'oe',ü:'ue',ß:'ss'}[c])).replace(/[^a-z0-9-]/g,'');
          await setDoc(doc(db, 'bereiche', slug), { name, reihenfolge, aktiv: true });
          alleBereiche.push({ id: slug, name, reihenfolge });
          toast('Bereich hinzugefügt');
        }
        closeBereichModal();
        alleBereiche.sort((a,b) => a.reihenfolge - b.reihenfolge);
        renderBereiche();
      } catch(e) { toast(e.message, 'error'); }
    };

    // ── FOTOS ──
    function populateFotoSelect() {
      const sel = document.getElementById('foto-artikel-select');
      if (!sel) return;
      sel.innerHTML = '';
      const def2 = document.createElement('option'); def2.value = ''; def2.textContent = '– Artikel wählen –';
      sel.appendChild(def2);
      [...alleArtikel].sort((a,b) => (a.name||'').localeCompare(b.name||'')).forEach(a => {
        const o = document.createElement('option'); o.value = a.id;
        o.textContent = a.lp ? `${a.lp} – ${a.name}` : a.name;
        sel.appendChild(o);
      });
    }

    let fotoUploadTargetId = null;
    let fotoUploadType = 'produkt';

    function populateFotoBereichFilter() {
      const sel = document.getElementById('foto-bereich');
      if (!sel) return;
      while (sel.options.length > 1) sel.remove(1);
      alleBereiche.forEach(b => {
        const o = document.createElement('option');
        o.value = b.id; o.textContent = prettyBereich(b.name);
        sel.appendChild(o);
      });
    }

    window.triggerFotoUpload = function(id, type) {
      fotoUploadTargetId = id;
      fotoUploadType = type;
      const inp = document.getElementById('foto-file-input');
      inp.value = '';
      inp.click();
    };

    window.uploadFotoFromGrid = async function() {
      const file = document.getElementById('foto-file-input').files[0];
      if (!file || !fotoUploadTargetId) return;
      toast('Foto wird hochgeladen…');
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_PRESET);
        formData.append('folder', 'lagerapp/artikel');
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Upload fehlgeschlagen');
        const data = await res.json();
        const field = fotoUploadType === 'lager' ? 'lagerFotoUrl' : 'fotoUrl';
        await updateDoc(doc(db, 'artikel', fotoUploadTargetId), { [field]: data.secure_url });
        const idx = alleArtikel.findIndex(a => a.id === fotoUploadTargetId);
        if (idx >= 0) alleArtikel[idx][field] = data.secure_url;
        renderFotos();
        toast('Foto gespeichert ✅');
      } catch(e) { toast(e.message, 'error'); }
    };

    window.deleteFotoFromGrid = async function(id, type) {
      if (!confirm('Foto wirklich löschen?')) return;
      const field = type === 'lager' ? 'lagerFotoUrl' : 'fotoUrl';
      try {
        await updateDoc(doc(db, 'artikel', id), { [field]: '' });
        const idx = alleArtikel.findIndex(a => a.id === id);
        if (idx >= 0) alleArtikel[idx][field] = '';
        renderFotos();
        toast('Foto gelöscht');
      } catch(e) { toast(e.message, 'error'); }
    };

    window.updateArtikelLP = async function(id, lp) {
      try {
        await updateDoc(doc(db, 'artikel', id), { lp });
        const idx = alleArtikel.findIndex(a => a.id === id);
        if (idx >= 0) alleArtikel[idx].lp = lp;
        toast('LP gespeichert');
      } catch(e) { toast(e.message, 'error'); }
    };

    function getLpOptions(currentLp) {
      const lps = [...new Set(alleArtikel.map(a => a.lp).filter(Boolean))].sort((a,b) => naturalSort(a,b));
      return lps.map(lp => `<option value="${esc(lp)}"${lp === currentLp ? ' selected' : ''}>${esc(lp)}</option>`).join('');
    }

    window.renderFotos = function renderFotos() {
      const grid    = document.getElementById('foto-grid');
      const search  = (document.getElementById('foto-search')?.value  || '').toLowerCase();
      const filter  = document.getElementById('foto-filter')?.value   || 'alle';
      const bereich = document.getElementById('foto-bereich')?.value  || '';
      const sort    = document.getElementById('foto-sort')?.value     || 'name';

      let items = alleArtikel.filter(a => {
        const matchSearch  = !search || (a.name||'').toLowerCase().includes(search) || (a.lp||'').toLowerCase().includes(search);
        const matchFilter  = filter === 'ohne-produkt' ? !a.fotoUrl
                           : filter === 'ohne-lager'   ? !a.lagerFotoUrl
                           : filter === 'ohne-beide'   ? !a.fotoUrl && !a.lagerFotoUrl
                           : filter === 'vollstaendig' ? !!a.fotoUrl && !!a.lagerFotoUrl
                           : true;
        const matchBereich = !bereich || a.bereich === bereich;
        return matchSearch && matchFilter && matchBereich;
      });

      if (sort === 'lp') items.sort((a,b) => naturalSort(a.lp||'', b.lp||''));
      else               items.sort((a,b) => (a.name||'').localeCompare(b.name||''));

      document.getElementById('foto-grid-label').textContent = `${items.length} Artikel`;
      items = items.slice(0, 60);

      grid.innerHTML = items.map(a => {
        const short = a.name.length > 24 ? a.name.substring(0,21) + '…' : a.name;
        const slotP = a.fotoUrl
          ? `<img src="${esc(a.fotoUrl)}" style="width:100%;height:110px;object-fit:cover;display:block;" loading="lazy">`
          : `<div style="width:100%;height:110px;background:var(--surface2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;"><span style="font-size:1.8rem;">📦</span><span style="font-size:0.58rem;color:var(--muted);">Kein Produktfoto</span></div>`;
        const slotL = a.lagerFotoUrl
          ? `<img src="${esc(a.lagerFotoUrl)}" style="width:100%;height:110px;object-fit:cover;display:block;" loading="lazy">`
          : `<div style="width:100%;height:110px;background:var(--surface3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;"><span style="font-size:1.8rem;">🗄️</span><span style="font-size:0.58rem;color:var(--muted);">Kein Lagerortfoto</span></div>`;
        const delP = a.fotoUrl
          ? `<button onclick="deleteFotoFromGrid('${esc(a.id)}','produkt')" style="padding:6px 10px;background:none;border:none;color:var(--red);cursor:pointer;font-size:0.85rem;flex-shrink:0;" title="Löschen">🗑</button>`
          : '';
        const delL = a.lagerFotoUrl
          ? `<button onclick="deleteFotoFromGrid('${esc(a.id)}','lager')" style="padding:6px 10px;background:none;border:none;color:var(--red);cursor:pointer;font-size:0.85rem;flex-shrink:0;" title="Löschen">🗑</button>`
          : '';
        return `
          <div class="foto-card">
            ${slotP}
            <div style="display:flex;align-items:center;border-top:1px solid var(--border);">
              <button class="foto-upload-btn" style="flex:1;border:none;text-align:left;" onclick="triggerFotoUpload('${esc(a.id)}','produkt')">📸 Produktfoto</button>
              ${delP}
            </div>
            <div style="border-top:1px solid var(--border);">${slotL}</div>
            <div style="display:flex;align-items:center;border-top:1px solid var(--border);">
              <button class="foto-upload-btn" style="flex:1;border:none;text-align:left;" onclick="triggerFotoUpload('${esc(a.id)}','lager')">🗄️ Lagerortfoto</button>
              ${delL}
            </div>
            <div class="foto-name" style="padding-bottom:4px;">
              ${esc(short)}
            </div>
            <div style="padding:0 8px 8px;">
              <select onchange="updateArtikelLP('${esc(a.id)}', this.value)"
                style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:0.68rem;color:var(--accent2);font-family:'IBM Plex Mono',monospace;cursor:pointer;">
                <option value="">— kein LP —</option>
                ${getLpOptions(a.lp)}
              </select>
            </div>
          </div>`;
      }).join('') || '<div class="empty-state">Keine Artikel gefunden</div>';
    };

    // ── STOCKSWIPE FOTOS ──
    let ssFotoTargetId = null;

    function populateSsBereichFilter() {
      const sel = document.getElementById('ss-foto-bereich');
      if (!sel) return;
      // Remove old options except first
      while (sel.options.length > 1) sel.remove(1);
      alleBereiche.forEach(b => {
        const o = document.createElement('option');
        o.value = b.id; o.textContent = prettyBereich(b.name);
        sel.appendChild(o);
      });
    }

    window.renderSsFotos = function() {
      const grid    = document.getElementById('ss-foto-grid');
      if (!grid) return;
      const search  = (document.getElementById('ss-foto-search')?.value || '').toLowerCase();
      const filter  = document.getElementById('ss-foto-filter')?.value  || 'alle';
      const bereich = document.getElementById('ss-foto-bereich')?.value || '';

      let items = alleArtikel.filter(a => {
        const matchSearch  = !search || (a.name||'').toLowerCase().includes(search) || (a.lp||'').toLowerCase().includes(search);
        const matchFilter  = filter === 'ohne-ss' ? !a.stockswipeFotoUrl
                           : filter === 'mit-ss'  ?  !!a.stockswipeFotoUrl
                           : true;
        const matchBereich = !bereich || a.bereich === bereich;
        return matchSearch && matchFilter && matchBereich;
      });
      items.sort((a, b) => (a.name||'').localeCompare(b.name||''));

      document.getElementById('ss-foto-grid-label').textContent = `${items.length} Artikel`;

      grid.innerHTML = items.map(a => {
        const short    = a.name.length > 26 ? a.name.substring(0,23) + '…' : a.name;
        const hasSsFoto = !!a.stockswipeFotoUrl;
        const photoSlot = hasSsFoto
          ? `<img src="${esc(a.stockswipeFotoUrl)}" style="width:100%;height:120px;object-fit:cover;display:block;" loading="lazy">`
          : (a.fotoUrl
              ? `<div style="position:relative;"><img src="${esc(a.fotoUrl)}" style="width:100%;height:120px;object-fit:cover;display:block;filter:grayscale(0.4);opacity:0.7;" loading="lazy"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);font-size:0.6rem;color:white;font-family:'IBM Plex Mono',monospace;letter-spacing:0.05em;">STANDARD FOTO</div></div>`
              : `<div style="width:100%;height:120px;background:var(--surface2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;"><span style="font-size:2rem;">📦</span><span style="font-size:0.62rem;color:var(--muted);">Kein Foto</span></div>`
            );
        return `
          <div class="foto-card">
            ${photoSlot}
            <div class="foto-name">
              ${a.lp ? `<div style="font-size:0.6rem;color:var(--accent2);margin-bottom:2px;font-family:'IBM Plex Mono',monospace;">${esc(a.lp)}</div>` : ''}
              ${esc(short)}
              ${hasSsFoto ? '<div style="font-size:0.58rem;color:var(--green);margin-top:2px;">✓ StockSwipe-Foto</div>' : ''}
            </div>
            <div style="display:flex;align-items:center;border-top:1px solid var(--border);">
              <button class="foto-upload-btn" style="flex:1;border:none;text-align:left;" onclick="triggerSsFotoUpload('${esc(a.id)}')">
                🃏 ${hasSsFoto ? 'Ändern' : 'Hochladen'}
              </button>
              ${hasSsFoto ? `<button onclick="deleteSsFoto('${esc(a.id)}')" style="padding:6px 10px;background:none;border:none;color:var(--red);cursor:pointer;font-size:0.85rem;flex-shrink:0;" title="Löschen">🗑</button>` : ''}
            </div>
          </div>`;
      }).join('') || '<div class="empty-state">Keine Artikel gefunden</div>';
    };

    window.triggerSsFotoUpload = function(id) {
      ssFotoTargetId = id;
      const inp = document.getElementById('ss-foto-file-input');
      inp.value = '';
      inp.click();
    };

    window.uploadSsFoto = async function() {
      const file = document.getElementById('ss-foto-file-input').files[0];
      if (!file || !ssFotoTargetId) return;
      toast('StockSwipe-Foto wird hochgeladen…');
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_PRESET);
        formData.append('folder', 'lagerapp/stockswipe');
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Upload fehlgeschlagen');
        const data = await res.json();
        await updateDoc(doc(db, 'artikel', ssFotoTargetId), { stockswipeFotoUrl: data.secure_url });
        const idx = alleArtikel.findIndex(a => a.id === ssFotoTargetId);
        if (idx >= 0) alleArtikel[idx].stockswipeFotoUrl = data.secure_url;
        renderSsFotos();
        toast('StockSwipe-Foto gespeichert ✅');
      } catch(e) { toast(e.message, 'error'); }
    };

    window.deleteSsFoto = async function(id) {
      if (!confirm('StockSwipe-Foto wirklich löschen?')) return;
      try {
        await updateDoc(doc(db, 'artikel', id), { stockswipeFotoUrl: '' });
        const idx = alleArtikel.findIndex(a => a.id === id);
        if (idx >= 0) alleArtikel[idx].stockswipeFotoUrl = '';
        renderSsFotos();
        toast('Foto gelöscht');
      } catch(e) { toast(e.message, 'error'); }
    };

    // ── PIN ──
    window.togglePinVisibility = function() {
      pinVisible = !pinVisible;
      document.getElementById('current-pin-display').textContent = pinVisible ? currentPin : '****';
    };

    window.adminPinKey = function(d) {
      if (newPinValue.length >= 4) return;
      newPinValue += d;
      updatePinDots();
    };

    window.adminPinDel = function() {
      newPinValue = newPinValue.slice(0,-1);
      updatePinDots();
    };

    function updatePinDots() {
      for (let i=0; i<4; i++)
        document.getElementById(`pdot-${i}`).classList.toggle('filled', i < newPinValue.length);
    }

    window.savePIN = async function() {
      const msg = document.getElementById('pin-msg');
      if (newPinValue.length < 4) { msg.style.color='var(--red)'; msg.textContent='Bitte 4-stelligen PIN eingeben.'; return; }
      await updateDoc(doc(db, 'config', 'app'), { pin: newPinValue });
      currentPin  = newPinValue;
      newPinValue = '';
      updatePinDots();
      msg.style.color = 'var(--green)';
      msg.textContent = '✅ PIN gespeichert!';
      toast('PIN geändert!');
      setTimeout(() => msg.textContent = '', 3000);
    };

    // ── BESTELLUNG DETAIL MODAL ──
    window.openDetail = function(id) {
      const b = alleBestellungen.find(x => x.id === id);
      if (!b) return;
      currentBest = b;
      const d   = b.datum?.toDate ? b.datum.toDate() : new Date();
      const nb  = b.items || b.nachbestellungen || [];
      document.getElementById('detail-modal-title').textContent = `Lagercheck – ${b.mitarbeiter}`;
      document.getElementById('detail-modal-body').innerHTML = `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);font-size:0.82rem;"><span style="color:var(--muted);">Mitarbeiter</span><span style="font-family:'IBM Plex Mono',monospace;font-weight:600;">${b.mitarbeiter||'–'}</span></div>
          <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);font-size:0.82rem;"><span style="color:var(--muted);">Datum</span><span style="font-family:'IBM Plex Mono',monospace;font-weight:600;">${d.toLocaleDateString('de-DE')} · ${d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</span></div>
          <div style="display:flex;justify-content:space-between;padding:10px 16px;font-size:0.82rem;"><span style="color:var(--muted);">Nachbestellungen</span><span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:${nb.length>0?'var(--red)':'var(--green)'};">${nb.length} Artikel</span></div>
        </div>
        ${nb.length > 0 ? `
          <div>
            <div class="section-label mb-8">Nachbestellungen</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${nb.map(a=>`
                <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:0.78rem;font-weight:600;">${a.artikelName||a.name||'–'}</span>
                  <span style="font-size:0.7rem;font-family:'IBM Plex Mono',monospace;color:var(--red);">${a.menge||a.ist||'–'} ${a.einheit||a.minEinheit||''}</span>
                </div>`).join('')}
            </div>
          </div>` : '<div class="alert alert-success">✅ Alle Artikel ausreichend</div>'}
        ${b.unterschrift?`<div><div class="section-label mb-8">Unterschrift</div><img src="${b.unterschrift}" style="width:100%;border-radius:8px;border:1px solid var(--border);background:var(--surface2);"></div>`:''}`;
      document.getElementById('detail-modal').classList.remove('hidden');
    };

    window.closeDetailModal = () => document.getElementById('detail-modal').classList.add('hidden');

    // ── Bestellung löschen ──
    window.deleteBestellung = async function(id) {
      if (!confirm('Bestellung wirklich löschen?')) return;
      try {
        await deleteDoc(doc(db, 'bestellungen', id));
        alleBestellungen = alleBestellungen.filter(b => b.id !== id);
        renderDashboard();
        renderBestellungen();
        toast('Bestellung gelöscht');
      } catch(e) { toast(e.message, 'error'); }
    };

    // ── PDF ──
    window.quickPDF = function(id, btn) {
      const b = alleBestellungen.find(x => x.id === id);
      if (!b) return;
      currentBest = b;
      if (btn) { btn.disabled = true; btn.textContent = '…'; }
      generatePDF().catch(e => { console.error(e); alert('PDF-Fehler: ' + e.message); })
                   .finally(() => { if (btn) { btn.disabled = false; btn.textContent = '↓ PDF'; } });
    };

    // ── PDF-VORLAGE: Positionsmapping (auto-generiert aus Lagerbestellung_Vorlage.pdf) ──
    // Format: LP/Name → [seiteIndex(0-basiert), y-Koordinate(Punkte von unten)]
    const _LP_POS = {"R.1.2.1.":[0,670],"R.1.2.2.":[0,651],"R.1.2.3.":[0,633],"R.1.2.4.":[0,614],"R.1.2.5.":[0,596],"R.1.2.6.":[0,577],"R.1.2.7.":[0,559],"R.1.2.8.":[0,540],"R.1.2.9.":[0,522],"R.1.2.10.":[0,503],"R.1.2.11.":[0,485],"R.1.2.12.":[0,466],"R.2.1.1.":[0,429],"R.2.1.2.":[0,411],"R.2.2.1.":[0,392],"R.2.2.2.":[0,374],"R.2.2.3.":[0,355],"R.2.2.4.":[0,337],"R.2.2.5.":[0,318],"S.1.1.1.1.":[0,281],"S.1.1.1.2.":[0,263],"S.1.1.1.3.":[0,244],"S.1.1.1.4.":[0,226],"S.1.1.1.5.":[0,207],"S.1.1.2.1.":[0,189],"S.1.1.2.2.":[0,170],"S.1.1.3.":[0,152],"S.1.2.1.1.":[0,133],"S.1.2.1.2.":[0,115],"S.1.2.1.3.":[0,96],"S.1.2.1.4.":[0,78],"S.1.2.1.5.":[0,59],"S.1.2.2.1.":[1,735],"S.1.2.2.2.":[1,717],"S.1.2.2.3.":[1,698],"S.1.2.2.4.":[1,680],"S.1.2.2.5.":[1,661],"S.1.2.3.":[1,643],"S.1.2.4.":[1,624],"S.1.3.1.1.":[1,606],"S.1.3.1.2.":[1,587],"S.1.3.1.3.":[1,569],"S.1.3.1.4.":[1,550],"S.1.3.1.5.":[1,532],"S.1.3.2.":[1,513],"S.1.3.3.":[1,495],"S.1.3.4.":[1,476],"S.1.4.1.1.":[1,458],"S.1.4.1.2.":[1,439],"S.1.4.1.3.":[1,421],"S.1.4.1.4.":[1,402],"S.1.4.1.5.":[1,384],"S.1.4.2.":[1,365],"S.1.4.3.":[1,347],"S.1.4.4.":[1,328],"S.1.5.1.":[1,310],"S.1.5.2.":[1,291],"S.1.5.3.":[1,273],"S.1.5.4.":[1,250],"S.2.1.1.1.":[1,97],"S.2.1.1.2.":[1,78],"S.2.1.1.3.":[1,60],"S.2.1.1.4.":[2,735],"S.2.1.1.5.":[2,717],"S.2.1.2.1.":[2,698],"S.2.1.2.2.":[2,680],"S.2.1.2.3.":[2,661],"S.2.1.2.4.":[2,643],"S.2.1.3.":[2,624],"S.2.2.1.1.":[2,587],"S.2.2.2.":[2,495],"S.2.2.3.":[2,476],"S.2.2.4.":[2,458],"S.2.3.1.1.":[2,439],"S.2.3.1.2.":[2,421],"S.2.3.1.3.":[2,402],"S.2.3.1.4.":[2,384],"S.2.3.2.1.":[2,365],"S.2.3.2.2.":[2,347],"S.2.3.2.3.":[2,328],"S.2.3.2.4.":[2,310],"S.2.3.2.5.":[2,291],"S.2.3.3.":[2,273],"S.2.3.4.":[2,254],"S.2.4.1.":[2,236],"S.2.4.2.":[2,217],"S.2.4.3.":[2,199],"S.2.4.4.":[2,180],"S.2.4.5.":[2,162],"S.2.5.1.":[2,143],"S.2.5.2.":[2,125],"S.2.5.3.":[2,106],"S.2.5.4.":[2,88],"S.2.5.5.":[2,69],"S.2.6.1.":[3,735],"S.2.6.2.":[3,717],"S.2.6.3.":[3,698],"S.3.1.1.":[3,661],"S.3.1.2.":[3,643],"S.3.1.3.":[3,624],"S.3.1.4.":[3,606],"S.3.1.5.":[3,587],"S.3.2.1.":[3,569],"S.3.2.2.":[3,550],"S.3.2.3.":[3,532],"S.3.2.4.":[3,513],"S.3.2.5.":[3,495],"S.3.3.1.":[3,476],"S.3.3.2.":[3,458],"S.3.3.3.":[3,439],"S.3.3.4.":[3,421],"S.3.3.5.":[3,402],"S.3.4.1.":[3,384],"S.3.4.2.":[3,365],"S.3.5.1.":[3,347],"S.3.5.2.":[3,328],"S.3.5.3.":[3,310],"S.3.6.1.":[3,291],"S.3.6.2.":[3,273],"S.3.6.3.":[3,254],"S.4.1.1.":[3,217],"S.4.1.2.":[3,199],"S.4.1.3.":[3,180],"S.4.1.4.":[3,162],"S.4.1.5.":[3,143],"S.4.1.6.":[3,125],"S.4.2.1.":[3,106],"S.4.2.2.":[3,88],"S.4.2.3.":[3,69],"S.4.2.4.":[4,735],"S.4.2.5.":[4,717],"S.4.3.1.":[4,698],"S.4.3.2.":[4,680],"S.4.3.3.":[4,661],"S.4.4.1.":[4,643],"S.4.4.2.":[4,624],"S.4.4.3.":[4,606],"S.4.4.4.":[4,587],"S.4.5.1.":[4,569],"S.4.5.2.":[4,550],"S.4.6.1.":[4,532],"S.4.6.2.":[4,513],"S.5.1.1.":[4,476],"S.5.1.2.":[4,458],"S.5.1.3.":[4,439],"S.5.1.4.":[4,421],"S.5.2.1.":[4,402],"S.5.2.2.":[4,384],"S.5.2.3.":[4,365],"S.5.3.1.":[4,347],"S.5.4.1.":[4,328],"S.5.4.2.":[4,310],"S.5.4.3.":[4,291],"S.5.5.1.":[4,273],"S.5.5.2.":[4,254],"S.5.5.3.":[4,236],"S.5.5.4.":[4,219],"S.5.5.5.":[4,201],"S.5.5.6.":[4,182],"S.5.6.1.":[4,162],"S.5.7.1.":[4,143],"S.5.8.1.":[4,69],"S.5.8.2.":[5,735],"S.5.8.3.":[5,717],"S.6.1.1.":[5,680],"S.6.1.2.":[5,661],"S.6.1.3.":[5,643],"S.6.2.1.":[5,624],"S.6.2.2.":[5,606],"S.6.3.1.":[5,587],"S.6.3.2.":[5,569],"S.6.3.3.":[5,550],"S.6.3.4.":[5,532],"S.6.4.1.":[5,513],"S.6.4.2.":[5,495],"S.6.4.3.":[5,476],"S.6.4.4.":[5,458],"S.6.5.1.":[5,439],"S.6.5.2.":[5,421],"S.6.5.3.":[5,402],"S.6.5.4.":[5,384],"S.6.5.5.":[5,365],"S.6.5.6.":[5,347],"S.6.6.1.":[5,328],"S.6.6.2.":[5,310],"S.6.6.3.":[5,291],"S.6.6.4.":[5,273],"S.6.6.5.":[5,254],"S.6.6.6.":[5,236],"S.6.6.7.":[5,217],"S.6.6.8.":[5,199],"S.6.6.9.":[5,180],"S.6.7.1.":[5,162],"S.6.7.2.":[5,143],"S.6.8.1.":[5,125],"S.6.8.2.":[5,106],"S.6.8.3.":[5,88],"S.6.8.4.":[5,69],"S.6.9.1.":[6,735],"S.6.10.1.":[6,717],"S.6.11.1.":[6,698],"M.1.1.":[6,661],"M.1.2.":[6,643],"M.1.3.":[6,624],"S.7.2.2.1.":[6,532],"S.7.2.2.2.":[6,513],"S.7.2.2.3.":[6,495],"S.7.2.3.1.":[6,476],"S.7.2.3.2.":[6,458],"S.7.2.3.3.":[6,439],"S.7.2.4.":[6,421],"S.7.2.5.":[6,402],"S.7.2.6.":[6,384],"S.1.1.1.":[6,347],"S.1.1.2.":[6,328],"S.1.2.1.":[6,310],"S.1.2.2.":[6,291],"L.1.":[6,236],"L.2.":[6,217],"S.1.3.2.1.":[6,106],"S.1.3.2.2.":[6,88],"S.1.3.2.3.":[6,69],"S.1.3.2.4.":[7,735]};
    const _NAME_POS = {"Handschuhe Gr. S":[0,670],"Handschuhe Gr. M":[0,651],"Handschuhe Gr. L":[0,633],"Handschuhe Gr. XL":[0,614],"Nierenschalen":[0,596],"Infektionsbeutel (Gelb)":[0,577],"Müllbeutel (Blau)":[0,559],"Müllbeutel 15L RTW":[0,540],"Kältekompresse":[0,522],"Kanülen Entsorgungsbox klein":[0,503],"Kanülen Entsorgungsbox groß":[0,485],"Tragetasche Patienteneigentum":[0,466],"Decken":[0,429],"Einmallaken":[0,411],"Papiertücher":[0,392],"Toilettenpapier":[0,374],"Regenschutz Trage":[0,355],"Teddybär":[0,337],"Saugunterlage":[0,318],"Spatel Macintosh Gr. 0":[0,281],"Spatel Miller Gr. 0":[0,263],"Spatel Macintosh Gr. 1":[0,244],"Spatel Miller Gr. 1":[0,226],"Spatel Macintosh Gr. 2":[0,207],"Spatel Macintosh Gr. 3":[0,189],"Spatel Macintosh Gr. 4":[0,170],"Spatel Macintosh Gr. 5":[0,152],"Videolaryngoskop Spatel Gr. 1":[0,133],"Videolaryngoskop Spatel Gr. 2":[0,115],"Videolaryngoskop Spatel Gr. 3":[0,96],"Videolaryngoskop Spatel Gr. 4":[0,78],"Videolaryngoskop Spatel XBlade":[0,59],"Wendel Tubus CH 12":[1,735],"Wendel Tubus CH 14":[1,717],"Wendel Tubus CH 16":[1,698],"Wendel Tubus CH 18":[1,680],"Wendel Tubus CH 20":[1,661],"Wendel Tubus CH 28":[1,643],"Chest Seal":[1,624],"Guedel Tubus Gr. 000 / 4cm":[1,606],"Guedel Tubus Gr. 00 / 5cm":[1,587],"Guedel Tubus Gr. 0 / 6cm":[1,569],"Guedel Tubus Gr. 1 / 7cm":[1,550],"Guedel Tubus Gr. 2 / 8cm":[1,532],"Guedel Tubus Gr. 3 / 9cm":[1,513],"Guedel Tubus Gr. 4 / 10cm":[1,495],"Guedel Tubus Gr. 5 / 11cm":[1,476],"Magenkatherspritze":[1,458],"Magensondenbeutel":[1,439],"Magensonde CH 10":[1,421],"Magensonde CH 16":[1,402],"Oro Sauger":[1,384],"Absaugschlauch mit Fingertip":[1,365],"Absaugbeutel":[1,347],"Fingertip":[1,328],"Handabsauge + Zubehör":[1,310],"Chirurgisches Besteck":[1,291],"Surgicric II (Koniotomie)":[1,273],"ET ohne Cuff Gr. 2,5":[1,97],"ET Mircocuff Gr. 3,0":[1,78],"ET ohne Cuff Gr. 3,5":[1,60],"ET Mircocuff Gr. 3,5":[2,735],"ET Mircocuff Gr. 4,0":[2,717],"ET Mircocuff Gr. 4,5":[2,698],"ET Mircocuff Gr. 5,0":[2,680],"ET Mircocuff Gr. 5,5":[2,661],"ET Mircocuff Gr. 6,0":[2,643],"ET Mircocuff Gr. 7,0":[2,624],"ET Mircocuff Gr. 8,0":[2,606],"iGel Gr. 1":[2,587],"iGel Gr. 1,5":[2,569],"iGel Gr. 2":[2,550],"iGel Gr. 2,5":[2,532],"iGel Gr. 3":[2,513],"iGel Gr. 4":[2,495],"iGel Gr. 5":[2,476],"Peep Einmalventil":[2,458],"Larynxtubus SET Gr.2,5":[2,439],"Larynxtubus SET Gr. 3":[2,421],"Larynxtubus SET Gr. 4":[2,402],"Larynxtubus SET Gr. 5":[2,384],"LAMA Gr. 1":[2,365],"LAMA Gr. 1,5":[2,347],"LAMA Gr. 2":[2,328],"LAMA Gr. 2,5":[2,310],"LAMA Gr. 3":[2,291],"Fixationsband CPAP Erw.":[2,273],"Fixationsband CPAP Kind":[2,254],"Beatmungsfilter Erw.":[2,236],"Thomas Holder Select Erw.":[2,217],"Gänsegurgel":[2,199],"Thomas Holder Select Kind":[2,180],"Beatmungsfilter Kind":[2,162],"Beatmungsmaske CPAP Adult L":[2,143],"Beatmungsmaske CPAP Adult M":[2,125],"Beatmungsmaske CPAP Adult S":[2,106],"Beatmungsmaske CPAP Neo":[2,88],"Beatmungsmaske CPAP Toddler":[2,69],"Beatmungsbeutel Erw.":[3,735],"Beatmungsschlauch Medumat":[3,717],"Beatmungsbeutel Kind":[3,698],"Mini Spike":[3,661],"Aufziehkanüle mit 5 μm Filter":[3,643],"Perfusor Leitung":[3,624],"Rückschlagventil":[3,606],"Sterican Safety Needle 22G":[3,587],"Perfusor Spritze mit Kanüle":[3,569],"Kombistopfen":[3,550],"Dreiwegehahn":[3,532],"Nasalzerstäuber mit 3ml Spritze":[3,513],"Spritze 1ml":[3,495],"Spritze 20ml":[3,476],"Spritze 10ml":[3,458],"Spritze 5ml":[3,439],"Spritze 2ml":[3,421],"Spritze 10ml Luer-Lock-Ansatz":[3,402],"O² Maske Kind":[3,384],"O² Maske Erw.":[3,365],"O² Sicherheitsschlauch":[3,347],"Vernebler T-Stk.":[3,328],"O² Brille":[3,310],"Aerosol-Set Vernebler Kind.":[3,291],"Aerosol-Set Vernebler":[3,273],"Hyperventilationsmaske":[3,254],"Viggo gelb 24G":[3,217],"Viggo blau 22G":[3,199],"Viggo rosa 20G":[3,180],"Viggo grün 18G":[3,162],"Viggo grau 16G":[3,143],"Viggo orange 14G":[3,125],"EZ-IO Nadel Rosa":[3,106],"EZ-IO Nadel Blau":[3,88],"EZ-IO Nadel Gelb":[3,69],"Portnadel 22G":[4,735],"Tourniquet":[4,717],"Viggo Pflaster Leukomed":[4,698],"Wundverband (Pflaster)":[4,680],"Tupfer Mullkompresse":[4,661],"Dreieckstuch":[4,643],"Rettungsdecke":[4,624],"Fixierbinden 4cm x 4cm":[4,606],"Universalbinde":[4,587],"Fixierbinde 10cm x 4cm":[4,569],"Verbandspäckchen":[4,550],"Verbandstuch":[4,532],"Zellstoff-Vlies-Kompresse":[4,513],"Waschlotion C45":[4,476],"Händedesinfektion C22":[4,458],"Sterillium Virugard":[4,439],"Cutasept® 50ml":[4,421],"Desinfektionstücher B45":[4,402],"Hautschutz Creme Lindesa":[4,384],"B4-Konzentrat":[4,365],"Einweg Eimer + Vließtücher":[4,347],"FFP3 Masken (mit Ventil)":[4,328],"FFP2 Masken":[4,310],"MNS Masken":[4,291],"Desinfektionshandschuhe Gr. S":[4,273],"Desinfektionshandschuhe Gr. M":[4,254],"Desinfektionshandschuhe Gr. L":[4,236],"Desinfektionshandschuhe Gr. XL":[4,219],"Sterile Handschuhe Gr. 6,5":[4,201],"Sterile Handschuhe Gr. 8,5":[4,182],"SIC SAC-Brechbeutel":[4,162],"Zahnprothesen Set":[4,143],"Schutzbrille":[4,125],"Einmalurinal (3er Set)":[4,106],"Venenstauer":[4,88],"Schutzoverall Gr. XL":[4,69],"Schutzoverall Gr. XXL":[5,735],"Schutzkittel":[5,717],"Augenspülung (0,9%) grün":[5,680],"Augenspülung (4,9 %) blau":[5,661],"Wasser 0,5l":[5,643],"Infusionsbesteck":[5,624],"Sterofundin 500ml":[5,606],"EKG-Klebeelektroden":[5,587],"C3 EKG Druckerpapier":[5,569],"Defi-Elektroden Erw.":[5,550],"Defi-Elektroden Kind":[5,532],"Kapnometrieadapter":[5,513],"Thermopapier":[5,495],"Leukoplast Hospital":[5,476],"Leukosilk":[5,458],"Ohrthermometer Schutzkappe":[5,439],"BZ-Teststreifen":[5,421],"BZ-Testlösung":[5,402],"BZ-Sicherheitslanzetten":[5,384],"Rasierer Einweg":[5,365],"Elektrogel (Sono)":[5,347],"SpO² Sensor Kind":[5,328],"Celox RAPID Gauze":[5,310],"Thoraxentlastungsnadel 14G":[5,291],"Sterile Mundspatel":[5,273],"Sterile Pinzette":[5,254],"Sterile Chir. Schere":[5,236],"Skalpell Gr. 10":[5,217],"Skalpell Gr. 11":[5,199],"Abnabelungsset":[5,180],"T-POD Beckenschlinge":[5,162],"Heizdecke":[5,143],"Replantat Notfallset Hand":[5,125],"Replantat Notfallset Bein":[5,106],"Verbrennungstuch Metaline kl.":[5,88],"Verbrennungstuch Metaline gr.":[5,69],"Sam Splint":[6,735],"HWS Orthese Erw.":[6,717],"HWS Orthese Kind":[6,698],"Batterien CR2025":[6,532],"Batterien AA":[6,513],"Batterien A23":[6,495],"Öl Pressluftkompressor":[6,476],"CO-Warnmelder":[6,458],"CF-Speicherkarte EKG":[6,439],"A6 Notizblock":[6,421],"Kugelschreiber":[6,402],"Permanentmarker":[6,384],"Scheibenfrostschutz":[6,347],"KÄRCHER Aktivreiniger":[6,328],"B20-Kanister":[6,310],"Staubsauger Zubehör":[6,291],"KÄRCHER Entkalker":[6,273],"Sauerstoffflasche 10l":[6,236],"Sauerstoffflasche 2l":[6,217]};
    // LP-Nummern die in mehreren Bereichen vorkommen → Name-Lookup bevorzugen
    const _LP_DUPE = new Set(['S.1.2.3.','S.1.3.1.1.','S.1.3.1.2.','S.1.3.1.3.','S.1.3.1.4.','S.2.1.3.','S.2.2.1.1.','S.5.7.1.']);
    let _pdfTemplateCache = null;

    function _getArtikelPos(artikel) {
      if (!_LP_DUPE.has(artikel.lp)) {
        const p = _LP_POS[artikel.lp];
        if (p) return p;
      }
      return _NAME_POS[artikel.name] || _LP_POS[artikel.lp] || null;
    }

    window.generatePDF = async function() {
      if (!currentBest) return;
      const b       = currentBest;
      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const datum   = b.datum?.toDate ? b.datum.toDate() : new Date();
      const dateStr = datum.toLocaleDateString('de-DE');
      const timeStr = datum.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' });
      const nachbest = b.items || b.nachbestellungen || [];

      // Template laden (nach erstem Abruf gecached)
      // Direkt von Firebase Hosting (gleiche Origin) → kein CORS, kein Safari-Problem
      if (!_pdfTemplateCache) {
        const resp = await fetch('../vorlagen/lagerbestellung_vorlage.pdf');
        if (!resp.ok) throw new Error(`Vorlage nicht gefunden (${resp.status})`);
        _pdfTemplateCache = await resp.arrayBuffer();
      }
      const pdfDoc = await PDFDocument.load(_pdfTemplateCache, { ignoreEncryption: true });
      const font   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages  = pdfDoc.getPages();
      const red    = rgb(0.72, 0, 0);
      const black  = rgb(0, 0, 0);

      // Bestellmengen in "Bestellen"-Spalte einschreiben
      for (const artikel of alleArtikel) {
        const pos = _getArtikelPos(artikel);
        if (!pos) continue;
        const nb = nachbest.find(x =>
          x.id === artikel.id || x.artikelId === artikel.id ||
          x.name === artikel.name || x.artikelName === artikel.name
        );
        const bestellt = nb ? true : (b.bestellungen?.[artikel.id]?.bestellen === true);
        const menge    = nb?.menge ?? b.bestellungen?.[artikel.id]?.menge ?? '';
        const einheit  = nb?.einheit || artikel.minEinheit || '';
        if (!bestellt || !menge) continue;
        const page = pages[pos[0]];
        if (!page) continue;
        page.drawText(`${menge} ${einheit}`.trim(), {
          x: 503,
          y: pos[1] + 2,
          size: 8.5,
          font,
          color: red,
        });
      }

      // Letzte Seite: Datum, Name, Unterschrift eintragen
      const last = pages[pages.length - 1];
      last.drawText(`${dateStr}  ·  ${timeStr} Uhr`, { x: 130, y: 645, size: 9, font, color: black });
      last.drawText(b.mitarbeiter || '', { x: 165, y: 618, size: 9, font, color: black });
      if (b.unterschrift) {
        const pngBytes = Uint8Array.from(atob(b.unterschrift.split(',')[1]), c => c.charCodeAt(0));
        const img = await pdfDoc.embedPng(pngBytes);
        last.drawImage(img, { x: 205, y: 577, width: 130, height: 28 });
      }

      // Download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Lagerbestellung_${(b.mitarbeiter||'').replace(/\s/g,'_')}_${dateStr.replace(/\./g,'-')}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    };


    // ── STATISTIK ──

    async function renderStatistik() {
      // Bereits geladene Bestellungen nutzen
      const alle = alleBestellungen;

      if (alle.length === 0) {
        document.getElementById('stat-total').textContent  = '0';
        document.getElementById('stat-orders').textContent = '0';
        document.getElementById('stat-avg').textContent    = '0';
        document.getElementById('stat-top-artikel').innerHTML   = '<div class="empty-state">Noch keine Daten</div>';
        document.getElementById('stat-empfehlungen').innerHTML  = '<div class="empty-state">Noch keine Daten</div>';
        return;
      }

      // ── Artikel-Häufigkeit berechnen ──
      const artikelCount = {};
      let totalNachbest = 0;

      for (const b of alle) {
        const nb = b.items || b.nachbestellungen || [];
        totalNachbest += nb.length;
        for (const a of nb) {
          const key = a.artikelName || a.name || a.artikelId || a.id;
          artikelCount[key] = (artikelCount[key] || 0) + 1;
        }
      }

      // ── KPIs ──
      document.getElementById('stat-total').textContent  = alle.length;
      document.getElementById('stat-orders').textContent = totalNachbest;
      document.getElementById('stat-avg').textContent    = (totalNachbest / alle.length).toFixed(1);

      // ── Mitarbeiter-Häufigkeit ──
      const mitarbeiterCount = {};
      for (const b of alle) {
        const namen = b.mitarbeiterListe || [b.mitarbeiter || '–'];
        for (const n of namen) {
          if (n) mitarbeiterCount[n] = (mitarbeiterCount[n] || 0) + 1;
        }
      }

      const topMitarbeiter = Object.entries(mitarbeiterCount)
        .sort((a, b) => b[1] - a[1]);



      // ── Top Artikel ──
      const topArtikel = Object.entries(artikelCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const maxCount = topArtikel[0]?.[1] || 1;

      document.getElementById('stat-top-artikel').innerHTML = topArtikel.length === 0
        ? '<div class="empty-state">Keine Nachbestellungen</div>'
        : topArtikel.map(([name, count], i) => {
            const pct = Math.round((count / maxCount) * 100);
            const color = i < 3 ? 'var(--red)' : i < 6 ? 'var(--yellow)' : 'var(--accent2)';
            return `
              <div style="padding:8px 16px;border-bottom:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span style="font-size:0.78rem;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span>
                  <span style="font-size:0.72rem;font-family:'IBM Plex Mono',monospace;color:${color};flex-shrink:0;margin-left:8px;">${count}×</span>
                </div>
                <div style="background:var(--surface2);border-radius:4px;height:4px;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width 0.5s ease;"></div>
                </div>
              </div>`;
          }).join('');



      // ── Wochenverlauf (letzte 12 Wochen) ──
      const wochen = {};
      const jetzt  = new Date();

      for (let i = 11; i >= 0; i--) {
        const d = new Date(jetzt);
        d.setDate(d.getDate() - i * 7);
        const key = `KW${getWeek(d)}`;
        wochen[key] = { label: key, count: 0, nb: 0 };
      }

      for (const b of alle) {
        const d = b.datum?.toDate ? b.datum.toDate() : new Date(b.datum);
        const key = `KW${getWeek(d)}`;
        if (wochen[key]) {
          wochen[key].count++;
          wochen[key].nb += (b.items || b.nachbestellungen || []).length;
        }
      }

      drawChart(Object.values(wochen));

      // ── MIN/MAX Empfehlungen ──
      // Artikel die in mehr als 30% aller Bestellungen nachbestellt wurden
      const threshold = alle.length * 0.3;
      const empf = Object.entries(artikelCount)
        .filter(([, count]) => count >= threshold && count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      document.getElementById('stat-empfehlungen').innerHTML = empf.length === 0
        ? '<div class="empty-state" style="padding:20px;">✅ Alle Artikel scheinen gut bestandsmäßig versorgt</div>'
        : empf.map(([name, count]) => {
            const pct = Math.round((count / alle.length) * 100);
            const artikel = alleArtikel.find(a => a.name === name);
            return `
              <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
                <div style="flex:1;min-width:0;">
                  <div style="font-size:0.8rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
                  <div style="font-size:0.65rem;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-top:2px;">
                    In ${pct}% aller Bestellungen nachbestellt · ${count}× total
                    ${artikel ? ` · MIN: ${artikel.min||'–'} ${artikel.minEinheit||''}` : ''}
                  </div>
                </div>
                <div style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:6px;padding:3px 8px;font-size:0.65rem;color:var(--accent);font-family:'IBM Plex Mono',monospace;white-space:nowrap;flex-shrink:0;">
                  MIN erhöhen?
                </div>
              </div>`;
          }).join('');
    }

    function getWeek(d) {
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    }

    function drawChart(wochen) {
      const canvas = document.getElementById('stat-chart');
      if (!canvas) return;
      const ctx    = canvas.getContext('2d');
      const W      = canvas.offsetWidth || 600;
      const H      = 80;
      canvas.width  = W;
      canvas.height = H;

      const max    = Math.max(...wochen.map(w => w.count), 1);
      const barW   = (W - 40) / wochen.length;
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const barColor  = '#f97316';
      const textColor = isDark ? '#6b7280' : '#9ca3af';

      ctx.clearRect(0, 0, W, H);

      wochen.forEach((w, i) => {
        const x   = 20 + i * barW;
        const pct = w.count / max;
        const bh  = Math.max(pct * (H - 24), w.count > 0 ? 4 : 0);
        const y   = H - 16 - bh;

        // Bar
        ctx.fillStyle = w.count > 0 ? barColor : (isDark ? '#1f2937' : '#f3f4f6');
        const r = 3;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + barW - 4 - r, y);
        ctx.arcTo(x + barW - 4, y, x + barW - 4, y + r, r);
        ctx.lineTo(x + barW - 4, y + bh);
        ctx.lineTo(x, y + bh);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        ctx.fill();

        // Count label
        if (w.count > 0) {
          ctx.fillStyle = barColor;
          ctx.font      = `bold 9px 'IBM Plex Mono'`;
          ctx.textAlign = 'center';
          ctx.fillText(w.count, x + (barW - 4) / 2, y - 3);
        }

        // Week label
        ctx.fillStyle = textColor;
        ctx.font      = '8px IBM Plex Mono';
        ctx.textAlign = 'center';
        ctx.fillText(w.label, x + (barW - 4) / 2, H - 3);
      });
    }

    // ══════════════════════════════════════════
    // MITARBEITER VERWALTUNG
    // ══════════════════════════════════════════
    async function sha256(str) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    let _maPinVal = '', _maPinFirst = '', _maPinConfirming = false, _maEditId = null;

    function updateMaPinDots() {
      for (let i = 0; i < 4; i++)
        document.getElementById(`ma-pdot-${i}`)?.classList.toggle('filled', i < _maPinVal.length);
    }

    window.maPinKey = function(d) {
      if (_maPinVal.length >= 4) return;
      _maPinVal += d;
      updateMaPinDots();
      if (_maPinVal.length === 4) setTimeout(handleMaPinFull, 150);
    };

    window.maPinDel = function() {
      _maPinVal = _maPinVal.slice(0, -1);
      updateMaPinDots();
    };

    function handleMaPinFull() {
      if (!_maPinConfirming) {
        _maPinFirst = _maPinVal;
        _maPinConfirming = true;
        _maPinVal = '';
        updateMaPinDots();
        document.getElementById('ma-pin-label').textContent = 'PIN bestätigen';
        document.getElementById('ma-pin-sub').textContent = 'PIN erneut eingeben';
        document.getElementById('ma-modal-error').textContent = '';
      }
    }

    window.openMaModal = function(empId) {
      _maEditId = empId || null;
      _maPinVal = ''; _maPinFirst = ''; _maPinConfirming = false;
      updateMaPinDots();
      document.getElementById('ma-modal-error').textContent = '';
      document.getElementById('ma-pin-sub').textContent = 'PIN eingeben';
      if (empId) {
        document.getElementById('ma-modal-title').textContent = 'PIN zurücksetzen';
        document.getElementById('ma-modal-fields').style.display = 'none';
        document.getElementById('ma-pin-label').textContent = 'Neuer PIN (4 Stellen)';
      } else {
        document.getElementById('ma-modal-title').textContent = 'Mitarbeiter anlegen';
        document.getElementById('ma-modal-fields').style.display = '';
        document.getElementById('ma-vorname').value = '';
        document.getElementById('ma-nachname').value = '';
        document.getElementById('ma-pin-label').textContent = 'PIN (4 Stellen)';
      }
      document.getElementById('ma-modal').classList.remove('hidden');
    };

    window.closeMaModal = function() {
      document.getElementById('ma-modal').classList.add('hidden');
    };

    window.saveMitarbeiter = async function() {
      const errEl = document.getElementById('ma-modal-error');
      if (!_maPinConfirming || _maPinVal.length < 4) {
        errEl.textContent = 'Bitte PIN zweimal vollständig eingeben';
        return;
      }
      if (_maPinVal !== _maPinFirst) {
        errEl.textContent = 'PINs stimmen nicht überein';
        _maPinConfirming = false; _maPinFirst = ''; _maPinVal = '';
        updateMaPinDots();
        document.getElementById('ma-pin-label').textContent = _maEditId ? 'Neuer PIN (4 Stellen)' : 'PIN (4 Stellen)';
        document.getElementById('ma-pin-sub').textContent = 'PIN eingeben';
        return;
      }
      const btn = document.getElementById('ma-save-btn');
      btn.disabled = true; btn.textContent = '…';
      try {
        const pinHash = await sha256(_maPinVal);
        if (_maEditId) {
          // Check whether this mitarbeiter already has a Firebase Auth account
          const maSnap = await getDoc(doc(db, 'mitarbeiter', _maEditId));
          const updateData = { pinHash };

          if (!maSnap.data()?.fbEmail) {
            // First-time migration: create Firebase Auth account for existing mitarbeiter
            const fbEmail    = `${_maEditId}@drk.local`;
            const fbPassword = [...crypto.getRandomValues(new Uint8Array(9))]
              .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
            const secondaryApp = initializeApp(firebaseConfig, 'ma-reset-' + _maEditId);
            try {
              await createUserWithEmailAndPassword(getAuth(secondaryApp), fbEmail, fbPassword);
            } finally {
              await deleteApp(secondaryApp);
            }
            updateData.fbEmail    = fbEmail;
            updateData.fbPassword = fbPassword;
          }

          await updateDoc(doc(db, 'mitarbeiter', _maEditId), updateData);
          showPortalToast('PIN erfolgreich zurückgesetzt', 'success');
        } else {
          const vorname  = document.getElementById('ma-vorname').value.trim();
          const nachname = document.getElementById('ma-nachname').value.trim();
          if (!vorname || !nachname) {
            errEl.textContent = 'Bitte Vor- und Nachname eingeben';
            btn.disabled = false; btn.textContent = 'Speichern'; return;
          }
          const nameKey = (vorname + ' ' + nachname).toLowerCase().replace(/\s+/g, ' ');

          // Pre-generate Firestore doc ID so we can derive the Firebase Auth email from it
          const newDocRef = doc(collection(db, 'mitarbeiter'));
          const fbEmail   = `${newDocRef.id}@drk.local`;
          const fbPassword = [...crypto.getRandomValues(new Uint8Array(9))]
            .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 12);

          // Create Firebase Auth user via secondary app — avoids logging out the current WL session
          const secondaryApp = initializeApp(firebaseConfig, 'ma-create-' + newDocRef.id);
          try {
            await createUserWithEmailAndPassword(getAuth(secondaryApp), fbEmail, fbPassword);
          } finally {
            await deleteApp(secondaryApp);
          }

          await setDoc(newDocRef, {
            vorname, nachname, nameKey, pinHash,
            fbEmail, fbPassword,
            createdAt: new Date().toISOString(),
          });
          showPortalToast('Mitarbeiter angelegt', 'success');
        }
        closeMaModal();
        loadMitarbeiter();
      } catch(e) {
        errEl.textContent = 'Fehler: ' + e.message;
      } finally {
        btn.disabled = false; btn.textContent = 'Speichern';
      }
    };

    window.deleteMitarbeiter = async function(id, name) {
      if (!confirm(`${name} wirklich löschen?`)) return;
      try {
        await deleteDoc(doc(db, 'mitarbeiter', id));
        showPortalToast('Mitarbeiter gelöscht', 'success');
        loadMitarbeiter();
      } catch(e) {
        showPortalToast('Fehler: ' + e.message, 'error');
      }
    };

    async function loadMitarbeiter() {
      const tbody = document.getElementById('ma-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="3"><div class="loading-state"><div class="spinner"></div></div></td></tr>';
      try {
        const snap = await getDocs(query(collection(db, 'mitarbeiter'), orderBy('nachname')));
        if (snap.empty) {
          tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state">Noch keine Mitarbeiter angelegt.</div></td></tr>';
          return;
        }
        tbody.innerHTML = snap.docs.map(d => {
          const ma      = d.data();
          const created = ma.createdAt ? new Date(ma.createdAt).toLocaleDateString('de-DE') : '–';
          const name    = esc(ma.vorname + ' ' + ma.nachname);
          return `<tr>
            <td><strong>${name}</strong></td>
            <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--ink-3);">${created}</td>
            <td style="white-space:nowrap;">
              <button class="tbl-btn" onclick="window.openMaModal('${d.id}')">PIN zurücksetzen</button>
              <button class="tbl-btn del" onclick="window.deleteMitarbeiter('${d.id}','${name}')" style="margin-left:6px;">Löschen</button>
            </td>
          </tr>`;
        }).join('');
      } catch(e) {
        tbody.innerHTML = `<tr><td colspan="3" style="color:var(--crit);padding:16px;">${e.message}</td></tr>`;
      }
    }

    function showPortalToast(msg, type = 'success') {
      const t = document.createElement('div');
      t.className = `toast-msg ${type}`;
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    }

    // ── ANLEITUNGEN ──
    const HELP_ITEMS = [
      { id: 'lagersuche',      icon: '🔍', title: 'Lagersuche',                   sub: 'Artikel, Bestände und Lagerorte durchsuchen' },
      { id: 'verfallsmonitor', icon: '⏳', title: 'Verfallsmonitor',               sub: 'Ablaufdaten aller Chargen im Überblick' },
      { id: 'lagerbestellung', icon: '📋', title: 'Lagerbestellung (Multi)',        sub: 'Artikel mit Ja/Nein und Menge bestellen' },
      { id: 'stockswipe',      icon: '👆', title: 'Lagerbestellung (StockSwipe)',   sub: 'Karten swipen – rechts bestellen, links OK' },
      { id: 'verfallscan',     icon: '📷', title: 'Verfallsscan',                  sub: 'Chargen per Barcode scannen und Verfall erfassen' },
      { id: 'pin',             icon: '🔑', title: 'PIN ändern',                    sub: 'Persönlichen 4-stelligen PIN aktualisieren' },
    ];

    let helpImagesPortal  = {};
    let helpContentPortal = {};
    let helpFotoTargetId  = null;

    async function renderAnleitung() {
      try {
        const [snapImg, snapTxt] = await Promise.all([
          getDoc(doc(db, 'config', 'help_images')),
          getDoc(doc(db, 'config', 'help_content')),
        ]);
        if (snapImg.exists()) helpImagesPortal  = snapImg.data();
        if (snapTxt.exists()) helpContentPortal = snapTxt.data();
      } catch(e) {}

      const list = document.getElementById('anleitung-list');
      list.innerHTML = HELP_ITEMS.map(item => {
        const imgUrl = helpImagesPortal[item.id];
        const steps  = helpContentPortal[item.id] || [];
        const stepsHtml = steps.map((s, i) => stepRowHTML(item.id, i, s)).join('');
        return `
          <div style="background:var(--surface);border:1px solid var(--hairline);border-radius:14px;padding:14px 16px;">
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
              <div style="font-size:1.6rem;flex-shrink:0;width:36px;text-align:center;">${item.icon}</div>
              <div style="flex:1;min-width:120px;">
                <div style="font-size:0.88rem;font-weight:600;">${esc(item.title)}</div>
                <div style="font-size:0.7rem;color:var(--ink-3);margin-top:2px;">${esc(item.sub)}</div>
                ${steps.length
                  ? `<div style="font-size:0.65rem;color:var(--ok);font-family:var(--font-mono);margin-top:3px;">${steps.length} eigene Schritt${steps.length !== 1 ? 'e' : ''}</div>`
                  : `<div style="font-size:0.65rem;color:var(--ink-4);font-family:var(--font-mono);margin-top:3px;">Standard-Text</div>`}
              </div>
              ${imgUrl ? `
                <img src="${esc(imgUrl)}" alt="${esc(item.title)}"
                  style="width:60px;height:60px;object-fit:cover;border-radius:10px;
                    border:1px solid var(--hairline);flex-shrink:0;">
              ` : `
                <div style="width:60px;height:60px;border-radius:10px;border:1.5px dashed var(--hairline-2);
                  background:var(--surface-2);display:flex;align-items:center;justify-content:center;
                  font-size:1.2rem;flex-shrink:0;color:var(--ink-4);">📷</div>
              `}
              <div style="display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0;">
                <button onclick="triggerHelpFotoUpload('${item.id}')" class="tbl-btn">${imgUrl ? '↺ Bild' : '+ Bild'}</button>
                ${imgUrl ? `<button onclick="deleteHelpFoto('${item.id}')" class="tbl-btn del">🗑</button>` : ''}
                <button onclick="toggleStepEditor('${item.id}')" class="tbl-btn">✏️ Schritte</button>
              </div>
            </div>
            <div id="step-editor-${item.id}" style="display:none;margin-top:14px;border-top:1px solid var(--hairline);padding-top:14px;">
              <div style="font-size:0.7rem;font-weight:600;color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Schritte bearbeiten</div>
              <div id="steps-list-${item.id}">${stepsHtml}</div>
              <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                <button onclick="addStep('${item.id}')" class="tbl-btn">+ Schritt</button>
                <button onclick="saveSteps('${item.id}')" class="tbl-btn" style="color:var(--ok);border-color:var(--ok);">💾 Speichern</button>
                ${steps.length ? `<button onclick="resetSteps('${item.id}')" class="tbl-btn del" style="margin-left:auto;">↩ Standard</button>` : ''}
              </div>
            </div>
          </div>`;
      }).join('');
    }

    function stepRowHTML(id, idx, text) {
      const rowId = 'step-row-' + id + '-' + idx;
      return `<div id="${rowId}" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;">
        <textarea rows="2" style="flex:1;background:var(--surface-2);border:1.5px solid var(--hairline-2);
          border-radius:8px;padding:7px 10px;font-family:var(--font-ui);font-size:0.82rem;color:var(--ink);
          resize:vertical;outline:none;min-height:38px;" placeholder="Schritt beschreiben…"
          onfocus="this.style.borderColor='var(--brand)'" onblur="this.style.borderColor='var(--hairline-2)'">${esc(text)}</textarea>
        <button onclick="document.getElementById('${rowId}').remove()" class="tbl-btn del" style="flex-shrink:0;margin-top:2px;">✕</button>
      </div>`;
    }

    window.toggleStepEditor = function(id) {
      const el = document.getElementById('step-editor-' + id);
      el.style.display = el.style.display === 'none' ? '' : 'none';
    };

    window.addStep = function(id) {
      const list = document.getElementById('steps-list-' + id);
      list.insertAdjacentHTML('beforeend', stepRowHTML(id, Date.now(), ''));
      list.lastElementChild?.querySelector('textarea')?.focus();
    };

    window.saveSteps = async function(id) {
      const list  = document.getElementById('steps-list-' + id);
      const steps = [...list.querySelectorAll('textarea')].map(t => t.value.trim()).filter(Boolean);
      try {
        await setDoc(doc(db, 'config', 'help_content'), { [id]: steps }, { merge: true });
        helpContentPortal[id] = steps;
        showPortalToast('Schritte gespeichert', 'success');
        renderAnleitung();
      } catch(e) {
        showPortalToast('Fehler: ' + e.message, 'error');
      }
    };

    window.resetSteps = async function(id) {
      const item = HELP_ITEMS.find(x => x.id === id);
      if (!confirm('Standard-Schritte für „' + (item?.title || id) + '" wiederherstellen? Eigene Änderungen gehen verloren.')) return;
      try {
        await setDoc(doc(db, 'config', 'help_content'), { [id]: [] }, { merge: true });
        helpContentPortal[id] = [];
        showPortalToast('Standard wiederhergestellt', 'success');
        renderAnleitung();
      } catch(e) {
        showPortalToast('Fehler: ' + e.message, 'error');
      }
    };

    window.triggerHelpFotoUpload = function(id) {
      helpFotoTargetId = id;
      document.getElementById('help-foto-input').value = '';
      document.getElementById('help-foto-input').click();
    };

    window.uploadHelpFoto = async function(input) {
      const file = input.files[0];
      if (!file || !helpFotoTargetId) return;
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_PRESET);
        fd.append('folder', 'lagerapp/help');
        const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        if (!data.secure_url) throw new Error('Upload fehlgeschlagen');
        await setDoc(doc(db, 'config', 'help_images'), { [helpFotoTargetId]: data.secure_url }, { merge: true });
        helpImagesPortal[helpFotoTargetId] = data.secure_url;
        showPortalToast('Bild gespeichert', 'success');
        renderAnleitung();
      } catch(e) {
        showPortalToast('Fehler: ' + e.message, 'error');
      }
    };

    window.deleteHelpFoto = async function(id) {
      const item = HELP_ITEMS.find(x => x.id === id);
      if (!confirm('Bild für „' + (item?.title || id) + '" löschen?')) return;
      try {
        await setDoc(doc(db, 'config', 'help_images'), { [id]: null }, { merge: true });
        delete helpImagesPortal[id];
        showPortalToast('Bild gelöscht', 'success');
        renderAnleitung();
      } catch(e) {
        showPortalToast('Fehler: ' + e.message, 'error');
      }
    };

