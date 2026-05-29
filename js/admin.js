import { app } from '../js/firebase-config.js';
import { initTheme, toggleTheme } from '../js/theme.js';
import { getAuth, onAuthStateChanged, signOut }
                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, limit }
                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Theme ──
initTheme();

// ── Firebase ──
const auth = getAuth(app);
const db   = getFirestore(app);

// Cloudinary config
const CLOUDINARY_CLOUD  = 'dvqug2dcx';
const CLOUDINARY_PRESET = 'lagerapp_unsigned';

let alleArtikel  = [];
let alleBereiche = [];
let alleUsers    = [];
let currentPin   = '1234';
let newPinValue  = '';
let pinVisible   = false;

// ── Escape helper (XSS) ──
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function prettyBereich(name) {
  return String(name ?? '').replace(/^Lager\s*[-–]\s*/i, '').trim();
}

// ── Toast ──
function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Auth ──
onAuthStateChanged(auth, async user => {
  if (!user || user.isAnonymous) { window.location.href = 'login.html?tab=wachenleiter'; return; }
  const userSnap = await getDoc(doc(db, 'users', user.uid));
  const role     = userSnap.exists() ? userSnap.data().role : null;
  if (role !== 'admin' && role !== 'wachenleiter') { window.location.href = 'login.html?tab=wachenleiter'; return; }
  const displayName = userSnap.data()?.name || user.email;
  window._adminDisplayName = displayName;
  document.getElementById('nav-user').textContent = user.email;
  document.getElementById('auth-loading').classList.add('hidden');
  document.getElementById('admin-layout').classList.remove('hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');
  const sidebarName = document.getElementById('sidebar-user-name');
  if (sidebarName) sidebarName.textContent = displayName;
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  if (sidebarAvatar) sidebarAvatar.textContent = (displayName[0] || 'A').toUpperCase();

  // Benutzer-Bereich nur für Admin sichtbar
  if (role !== 'admin') {
    const navUsers = document.getElementById('nav-users');
    if (navUsers) navUsers.style.display = 'none';
    const usersSection = document.getElementById('section-users');
    if (usersSection) {
      const addForm = usersSection.querySelector('div[style*="border-radius:12px"]');
      if (addForm) addForm.style.display = 'none';
    }
  }

  await loadAll();
});

async function doLogout() {
  await signOut(auth);
  window.location.href = 'login.html';
}

function goToMitarbeiter() {
  const name = window._adminDisplayName || document.getElementById('nav-user').textContent;
  sessionStorage.setItem('lager-pin-auth', 'true');
  sessionStorage.setItem('lager-portal-role', 'admin');
  if (name) sessionStorage.setItem('lager-pin-name', name);
  window.location.href = 'mitarbeiter.html';
}

// ── Neuen Benutzer anlegen ──
async function createNewUser() {
  const name     = document.getElementById('new-user-name').value.trim();
  const email    = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const role     = document.getElementById('new-user-role').value;
  const msg      = document.getElementById('new-user-msg');

  if (!name || !email || !password) {
    msg.style.color = 'var(--red)';
    msg.textContent = '❌ Bitte alle Felder ausfüllen.';
    return;
  }

  if (password.length < 6) {
    msg.style.color = 'var(--red)';
    msg.textContent = '❌ Passwort muss mindestens 6 Zeichen haben.';
    return;
  }

  msg.style.color = 'var(--accent2)';
  msg.textContent = '⏳ Benutzer wird angelegt...';

  try {
    const apiKey = 'AIzaSyD1YY-cFQxyykfYQYPORwulzuF8t6Wgid4';
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    const data = await res.json();

    if (data.error) {
      const msgs = {
        'EMAIL_EXISTS':           'Diese E-Mail ist bereits registriert.',
        'INVALID_EMAIL':          'Ungültige E-Mail-Adresse.',
        'WEAK_PASSWORD':          'Passwort zu schwach (min. 6 Zeichen).',
        'OPERATION_NOT_ALLOWED':  'E-Mail/Passwort Login ist nicht aktiviert.',
      };
      throw new Error(msgs[data.error.message] || data.error.message);
    }

    const uid = data.localId;

    await setDoc(doc(db, 'users', uid), {
      name, email, role,
      createdAt: new Date().toISOString(),
    });

    alleUsers.push({ id: uid, name, email, role });
    renderUsers();

    ['new-user-name', 'new-user-email', 'new-user-password'].forEach(id => {
      document.getElementById(id).value = '';
    });

    msg.style.color = 'var(--green)';
    msg.textContent = `✅ ${name} wurde erfolgreich angelegt!`;
    toast(`${name} angelegt!`);
    setTimeout(() => msg.textContent = '', 4000);

  } catch (e) {
    msg.style.color = 'var(--red)';
    msg.textContent = '❌ ' + e.message;
  }
}

// ── Load All ──
async function loadAll() {
  const [bSnap, aSnap, bestSnap, uSnap, configSnap] = await Promise.all([
    getDocs(query(collection(db, 'bereiche'), orderBy('reihenfolge'))),
    getDocs(collection(db, 'artikel')),
    getDocs(query(collection(db, 'bestellungen'), orderBy('datum', 'desc'), limit(5))),
    getDocs(collection(db, 'users')),
    getDoc(doc(db, 'config', 'app')),
  ]);

  alleBereiche = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  alleArtikel  = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  alleUsers    = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (configSnap.exists()) currentPin = configSnap.data().pin || '1234';

  const bestellungen = bestSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderDashboard(bestellungen);
  renderArtikelTable(alleArtikel);
  renderBereiche();
  renderUsers();
  renderFotoSection();
  populateBereichFilter();
  populateFotoArtikelSelect();
  populateSsBereichFilter();
}

// ── Navigation ──
const moreSheetSections = ['bereiche', 'fotos', 'ss-fotos', 'pin', 'backup', 'laufband', 'lieferanten'];

function showSection(name) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bottom-tab').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bottom-sheet-item').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  if (name === 'ss-fotos') renderSsFotos();
  if (name === 'lieferanten') renderLieferantenTabelle();
  const navItem = document.getElementById(`nav-${name}`);
  if (navItem) navItem.classList.add('active');
  const bottomTab = document.querySelector(`.bottom-tab[data-section="${name}"]`);
  if (bottomTab) {
    bottomTab.classList.add('active');
  } else if (moreSheetSections.includes(name)) {
    document.getElementById('bottom-more-tab').classList.add('active');
    const sheetItem = document.querySelector(`.bottom-sheet-item[data-section="${name}"]`);
    if (sheetItem) sheetItem.classList.add('active');
  }
}

function openBottomSheet() {
  document.getElementById('bottom-sheet-backdrop').classList.remove('hidden');
  document.getElementById('bottom-sheet-backdrop').classList.add('open');
  document.getElementById('bottom-sheet').classList.add('open');
}

function closeBottomSheet() {
  document.getElementById('bottom-sheet-backdrop').classList.remove('open');
  document.getElementById('bottom-sheet').classList.remove('open');
  setTimeout(() => document.getElementById('bottom-sheet-backdrop').classList.add('hidden'), 300);
}

// ── DASHBOARD ──
function renderDashboard(bestellungen) {
  document.getElementById('stat-artikel').textContent      = alleArtikel.length;
  document.getElementById('stat-bereiche').textContent     = alleBereiche.length;
  document.getElementById('stat-bestellungen').textContent = bestellungen.length;
  document.getElementById('stat-ohne-foto').textContent    = alleArtikel.filter(a => !a.fotoUrl).length;

  const tbody = document.getElementById('dashboard-bestellungen');
  if (bestellungen.length === 0) {
    tbody.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:0.82rem;">Noch keine Lagerchecks</div>';
    return;
  }
  tbody.innerHTML = `<table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="padding:8px 14px;text-align:left;font-size:0.62rem;color:var(--muted);text-transform:uppercase;font-family:'IBM Plex Mono',monospace;background:var(--surface2);border-bottom:1px solid var(--border);">Mitarbeiter</th>
      <th style="padding:8px 14px;text-align:left;font-size:0.62rem;color:var(--muted);text-transform:uppercase;font-family:'IBM Plex Mono',monospace;background:var(--surface2);border-bottom:1px solid var(--border);">Datum</th>
      <th style="padding:8px 14px;text-align:left;font-size:0.62rem;color:var(--muted);text-transform:uppercase;font-family:'IBM Plex Mono',monospace;background:var(--surface2);border-bottom:1px solid var(--border);">Nachbestell.</th>
    </tr></thead>
    <tbody>${bestellungen.map(b => {
      const d  = b.datum?.toDate ? b.datum.toDate() : new Date();
      const nb = b.nachbestellungen?.length || 0;
      return `<tr>
        <td style="padding:10px 14px;font-size:0.82rem;font-weight:600;border-bottom:1px solid var(--border);">${b.mitarbeiter || '–'}</td>
        <td style="padding:10px 14px;font-size:0.75rem;font-family:'IBM Plex Mono',monospace;color:var(--muted);border-bottom:1px solid var(--border);">${d.toLocaleDateString('de-DE')}</td>
        <td style="padding:10px 14px;font-size:0.75rem;border-bottom:1px solid var(--border);color:${nb > 0 ? 'var(--red)' : 'var(--green)'};">${nb > 0 ? `⚠️ ${nb}` : '✅ Keine'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ── ARTIKEL TABLE ──
function renderArtikelTable(data) {
  const tbody = document.getElementById('artikel-tbody');
  tbody.innerHTML = data.map(a => {
    const b = alleBereiche.find(x => x.id === a.bereich);
    return `<tr>
      <td data-label="Artikel" class="td-name">${esc(a.name)}</td>
      <td data-label="Standort" class="td-loc">${esc(a.location || '–')}<br><span style="color:var(--muted);font-size:0.62rem;">${esc(b?.name || a.bereich || '–')}</span></td>
      <td data-label="MIN / MAX" class="td-minmax">${a.min ?? '–'} ${esc(a.minEinheit || '')} / ${a.max ?? '–'} ${esc(a.maxEinheit || '')}</td>
      <td data-label="Foto">${a.fotoUrl ? '<span style="color:var(--green);font-size:0.75rem;">✅ Foto</span>' : '<span style="color:var(--muted);font-size:0.75rem;">Kein Foto</span>'}</td>
      <td data-label="Aktionen" class="td-actions">
        <button class="tbl-btn" data-action="edit-artikel" data-id="${esc(a.id)}">✏️ Edit</button>
        <button class="tbl-btn del" data-action="delete-artikel" data-id="${esc(a.id)}" data-name="${esc(a.name)}">🗑️</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--muted);">Keine Artikel gefunden</td></tr>';
}

function filterArtikel(val) {
  const q       = (val !== undefined ? val : (document.getElementById('artikel-search').value || '')).toLowerCase();
  const bereich = document.getElementById('bereich-filter').value;
  const filtered = alleArtikel.filter(a =>
    (!q || a.name?.toLowerCase().includes(q) || a.lp?.toLowerCase().includes(q)) &&
    (!bereich || a.bereich === bereich)
  );
  renderArtikelTable(filtered);
}

function populateBereichFilter() {
  const sel = document.getElementById('bereich-filter');
  alleBereiche.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id; opt.textContent = prettyBereich(b.name);
    sel.appendChild(opt);
  });
}

// ── ARTIKEL MODAL ──
function openArtikelModal(id) {
  const modal = document.getElementById('artikel-modal');
  const sel   = document.getElementById('edit-bereich');
  sel.innerHTML = '';
  alleBereiche.forEach(b => {
    const o = document.createElement('option'); o.value = b.id; o.textContent = prettyBereich(b.name);
    sel.appendChild(o);
  });

  if (id) {
    const a = alleArtikel.find(x => x.id === id);
    document.getElementById('artikel-modal-title').textContent = 'Artikel bearbeiten';
    document.getElementById('edit-id').value         = a.id;
    document.getElementById('edit-name').value       = a.name || '';
    document.getElementById('edit-lp').value         = a.lp || '';
    document.getElementById('edit-location').value   = a.location || '';
    document.getElementById('edit-bereich').value    = a.bereich || '';
    document.getElementById('edit-min').value        = a.min ?? '';
    document.getElementById('edit-minE').value       = a.minEinheit || '';
    document.getElementById('edit-max').value        = a.max ?? '';
    document.getElementById('edit-maxE').value       = a.maxEinheit || '';
    document.getElementById('edit-aliases').value    = (a.aliases || []).join(', ');
    document.getElementById('edit-hinweis').value    = a.hinweis || '';
    document.getElementById('edit-lieferant').value  = a.lieferant || '';
    document.getElementById('edit-formularfeld').value = a.formularFeld || '';
  } else {
    document.getElementById('artikel-modal-title').textContent = 'Neuer Artikel';
    ['edit-id', 'edit-name', 'edit-lp', 'edit-location', 'edit-min', 'edit-minE', 'edit-max', 'edit-maxE', 'edit-aliases', 'edit-hinweis', 'edit-formularfeld'].forEach(fid => { document.getElementById(fid).value = ''; });
    document.getElementById('edit-lieferant').value = '';
  }
  modal.classList.remove('hidden');
}

function closeArtikelModal() {
  document.getElementById('artikel-modal').classList.add('hidden');
}

async function saveArtikel() {
  const id   = document.getElementById('edit-id').value;
  const name = document.getElementById('edit-name').value.trim();
  if (!name) { toast('Name ist Pflichtfeld', 'error'); return; }

  const data = {
    name,
    lp:          document.getElementById('edit-lp').value.trim(),
    location:    document.getElementById('edit-location').value.trim(),
    bereich:     document.getElementById('edit-bereich').value,
    min:         parseFloat(document.getElementById('edit-min').value) || null,
    minEinheit:  document.getElementById('edit-minE').value.trim(),
    max:         parseFloat(document.getElementById('edit-max').value) || null,
    maxEinheit:  document.getElementById('edit-maxE').value.trim(),
    aliases:     document.getElementById('edit-aliases').value.split(',').map(s => s.trim()).filter(Boolean),
    hinweis:     document.getElementById('edit-hinweis').value.trim(),
    lieferant:   document.getElementById('edit-lieferant').value || '',
    formularFeld: document.getElementById('edit-formularfeld').value.trim(),
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'artikel', id), data);
      const idx = alleArtikel.findIndex(a => a.id === id);
      if (idx >= 0) alleArtikel[idx] = { ...alleArtikel[idx], ...data };
      toast('Artikel aktualisiert');
    } else {
      const ref = await addDoc(collection(db, 'artikel'), { ...data, fotoUrl: '', chargen: [], aktiv: true });
      alleArtikel.push({ id: ref.id, ...data, fotoUrl: '', chargen: [] });
      toast('Artikel hinzugefügt');
    }
    closeArtikelModal();
    filterArtikel();
    document.getElementById('stat-artikel').textContent = alleArtikel.length;
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteArtikel(id, name) {
  if (!confirm(`„${name}" wirklich löschen?`)) return;
  try {
    await deleteDoc(doc(db, 'artikel', id));
    alleArtikel = alleArtikel.filter(a => a.id !== id);
    filterArtikel();
    toast('Artikel gelöscht');
    document.getElementById('stat-artikel').textContent = alleArtikel.length;
  } catch (e) { toast(e.message, 'error'); }
}

// ── BEREICHE ──
function renderBereiche() {
  const list = document.getElementById('bereich-list');
  list.innerHTML = alleBereiche.map(b => {
    const count = alleArtikel.filter(a => a.bereich === b.id).length;
    return `
      <div class="bereich-item">
        <div class="bereich-icon">${getBereichIcon(b.name)}</div>
        <div style="flex:1;">
          <div class="bereich-name">${esc(prettyBereich(b.name))}</div>
          <div class="bereich-count">${count} Artikel · Reihenfolge: ${b.reihenfolge}</div>
        </div>
        <button class="tbl-btn" data-action="edit-bereich" data-id="${esc(b.id)}">✏️ Edit</button>
      </div>`;
  }).join('');
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

function openBereichModal(id) {
  if (id) {
    const b = alleBereiche.find(x => x.id === id);
    document.getElementById('bereich-modal-title').textContent        = 'Bereich bearbeiten';
    document.getElementById('bereich-edit-id').value                  = b.id;
    document.getElementById('bereich-edit-name').value                = b.name;
    document.getElementById('bereich-edit-reihenfolge').value         = b.reihenfolge;
  } else {
    document.getElementById('bereich-modal-title').textContent        = 'Neuer Bereich';
    document.getElementById('bereich-edit-id').value                  = '';
    document.getElementById('bereich-edit-name').value                = '';
    document.getElementById('bereich-edit-reihenfolge').value         = alleBereiche.length + 1;
  }
  document.getElementById('bereich-modal').classList.remove('hidden');
}

function closeBereichModal() {
  document.getElementById('bereich-modal').classList.add('hidden');
}

async function saveBereich() {
  const id          = document.getElementById('bereich-edit-id').value;
  const name        = document.getElementById('bereich-edit-name').value.trim();
  const reihenfolge = parseInt(document.getElementById('bereich-edit-reihenfolge').value) || 99;
  if (!name) { toast('Name ist Pflichtfeld', 'error'); return; }

  try {
    if (id) {
      await updateDoc(doc(db, 'bereiche', id), { name, reihenfolge });
      const idx = alleBereiche.findIndex(b => b.id === id);
      if (idx >= 0) alleBereiche[idx] = { ...alleBereiche[idx], name, reihenfolge };
      toast('Bereich aktualisiert');
    } else {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c])).replace(/[^a-z0-9-]/g, '');
      await setDoc(doc(db, 'bereiche', slug), { name, reihenfolge, aktiv: true });
      alleBereiche.push({ id: slug, name, reihenfolge, aktiv: true });
      toast('Bereich hinzugefügt');
    }
    closeBereichModal();
    alleBereiche.sort((a, b) => a.reihenfolge - b.reihenfolge);
    renderBereiche();
  } catch (e) { toast(e.message, 'error'); }
}

// ── FOTOS ──
function populateFotoArtikelSelect() {
  const sel = document.getElementById('foto-artikel-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Artikel wählen --</option>';
  [...alleArtikel].sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.lp ? `${a.lp} – ${a.name}` : a.name;
    sel.appendChild(opt);
  });
}

function naturalSort(a, b) {
  const seg = s => s.split(/[\.\-]/).map(x => isNaN(x) ? x : parseInt(x, 10));
  const sa = seg(a), sb = seg(b);
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    const x = sa[i] ?? '', y = sb[i] ?? '';
    if (x < y) return -1;
    if (x > y) return  1;
  }
  return 0;
}

let fotoUploadTargetId = null;
let fotoUploadType     = 'produkt';

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

function triggerFotoUpload(id, type) {
  fotoUploadTargetId = id;
  fotoUploadType     = type;
  const inp = document.getElementById('foto-file-input');
  inp.value = '';
  inp.click();
}

async function uploadFotoFromGrid() {
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
    const data  = await res.json();
    const field = fotoUploadType === 'lager' ? 'lagerFotoUrl' : 'fotoUrl';
    await updateDoc(doc(db, 'artikel', fotoUploadTargetId), { [field]: data.secure_url });
    const idx = alleArtikel.findIndex(a => a.id === fotoUploadTargetId);
    if (idx >= 0) alleArtikel[idx][field] = data.secure_url;
    renderFotoSection();
    toast('Foto gespeichert ✅');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteFotoFromGrid(id, type) {
  if (!confirm('Foto wirklich löschen?')) return;
  const field = type === 'lager' ? 'lagerFotoUrl' : 'fotoUrl';
  try {
    await updateDoc(doc(db, 'artikel', id), { [field]: '' });
    const idx = alleArtikel.findIndex(a => a.id === id);
    if (idx >= 0) alleArtikel[idx][field] = '';
    renderFotoSection();
    toast('Foto gelöscht');
  } catch (e) { toast(e.message, 'error'); }
}

async function updateArtikelLP(id, lp) {
  try {
    await updateDoc(doc(db, 'artikel', id), { lp });
    const idx = alleArtikel.findIndex(a => a.id === id);
    if (idx >= 0) alleArtikel[idx].lp = lp;
    toast('LP gespeichert');
  } catch (e) { toast(e.message, 'error'); }
}

function getLpOptions(currentLp) {
  const lps = [...new Set(alleArtikel.map(a => a.lp).filter(Boolean))].sort((a, b) => naturalSort(a, b));
  return lps.map(lp => `<option value="${esc(lp)}"${lp === currentLp ? ' selected' : ''}>${esc(lp)}</option>`).join('');
}

function renderFotoSection() {
  const grid    = document.getElementById('foto-grid');
  const search  = (document.getElementById('foto-search')?.value  || '').toLowerCase();
  const filter  = document.getElementById('foto-filter')?.value   || 'alle';
  const bereich = document.getElementById('foto-bereich')?.value  || '';
  const sort    = document.getElementById('foto-sort')?.value     || 'name';

  let items = alleArtikel.filter(a => {
    const matchSearch  = !search || (a.name || '').toLowerCase().includes(search) || (a.lp || '').toLowerCase().includes(search);
    const matchFilter  = filter === 'ohne-produkt' ? !a.fotoUrl
                       : filter === 'ohne-lager'   ? !a.lagerFotoUrl
                       : filter === 'ohne-beide'   ? !a.fotoUrl && !a.lagerFotoUrl
                       : filter === 'vollstaendig' ? !!a.fotoUrl && !!a.lagerFotoUrl
                       : true;
    const matchBereich = !bereich || a.bereich === bereich;
    return matchSearch && matchFilter && matchBereich;
  });

  if (sort === 'lp') items.sort((a, b) => naturalSort(a.lp || '', b.lp || ''));
  else               items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  document.getElementById('stat-ohne-foto').textContent    = alleArtikel.filter(a => !a.fotoUrl).length;
  document.getElementById('foto-grid-label').textContent   = `${items.length} Artikel`;
  items = items.slice(0, 60);

  grid.innerHTML = items.map(a => {
    const short = a.name.length > 24 ? a.name.substring(0, 21) + '…' : a.name;
    const slotP = a.fotoUrl
      ? `<img src="${esc(a.fotoUrl)}" style="width:100%;height:110px;object-fit:cover;display:block;" loading="lazy">`
      : `<div style="width:100%;height:110px;background:var(--surface2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;"><span style="font-size:1.8rem;">📦</span><span style="font-size:0.58rem;color:var(--muted);">Kein Produktfoto</span></div>`;
    const slotL = a.lagerFotoUrl
      ? `<img src="${esc(a.lagerFotoUrl)}" style="width:100%;height:110px;object-fit:cover;display:block;" loading="lazy">`
      : `<div style="width:100%;height:110px;background:var(--surface3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;"><span style="font-size:1.8rem;">🗄️</span><span style="font-size:0.58rem;color:var(--muted);">Kein Lagerortfoto</span></div>`;
    const delP = a.fotoUrl
      ? `<button data-action="delete-foto" data-id="${esc(a.id)}" data-type="produkt" style="padding:6px 10px;background:none;border:none;color:var(--red);cursor:pointer;font-size:0.85rem;flex-shrink:0;" title="Löschen">🗑</button>`
      : '';
    const delL = a.lagerFotoUrl
      ? `<button data-action="delete-foto" data-id="${esc(a.id)}" data-type="lager" style="padding:6px 10px;background:none;border:none;color:var(--red);cursor:pointer;font-size:0.85rem;flex-shrink:0;" title="Löschen">🗑</button>`
      : '';
    return `
      <div class="foto-card">
        ${slotP}
        <div style="display:flex;align-items:center;border-top:1px solid var(--border);">
          <button class="foto-upload-btn" data-action="upload-foto" data-id="${esc(a.id)}" data-type="produkt" style="flex:1;border:none;text-align:left;">📸 Produktfoto</button>
          ${delP}
        </div>
        <div style="border-top:1px solid var(--border);">${slotL}</div>
        <div style="display:flex;align-items:center;border-top:1px solid var(--border);">
          <button class="foto-upload-btn" data-action="upload-foto" data-id="${esc(a.id)}" data-type="lager" style="flex:1;border:none;text-align:left;">🗄️ Lagerortfoto</button>
          ${delL}
        </div>
        <div class="foto-name" style="padding-bottom:4px;">
          ${esc(short)}
        </div>
        <div style="padding:0 8px 8px;">
          <select data-action="update-lp" data-id="${esc(a.id)}"
            style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:0.68rem;color:var(--accent2);font-family:'IBM Plex Mono',monospace;cursor:pointer;">
            <option value="">— kein LP —</option>
            ${getLpOptions(a.lp)}
          </select>
        </div>
      </div>`;
  }).join('') || '<div class="empty-state">Keine Artikel gefunden</div>';
}

// ── STOCKSWIPE FOTOS ──
let ssFotoTargetId = null;

function populateSsBereichFilter() {
  const sel = document.getElementById('ss-foto-bereich');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  alleBereiche.forEach(b => {
    const o = document.createElement('option');
    o.value = b.id; o.textContent = prettyBereich(b.name);
    sel.appendChild(o);
  });
}

function renderSsFotos() {
  const grid    = document.getElementById('ss-foto-grid');
  if (!grid) return;
  const search  = (document.getElementById('ss-foto-search')?.value || '').toLowerCase();
  const filter  = document.getElementById('ss-foto-filter')?.value  || 'alle';
  const bereich = document.getElementById('ss-foto-bereich')?.value || '';

  let items = alleArtikel.filter(a => {
    const matchSearch  = !search || (a.name || '').toLowerCase().includes(search) || (a.lp || '').toLowerCase().includes(search);
    const matchFilter  = filter === 'ohne-ss' ? !a.stockswipeFotoUrl
                       : filter === 'mit-ss'  ? !!a.stockswipeFotoUrl
                       : true;
    const matchBereich = !bereich || a.bereich === bereich;
    return matchSearch && matchFilter && matchBereich;
  });
  items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  document.getElementById('ss-foto-grid-label').textContent = `${items.length} Artikel`;

  grid.innerHTML = items.map(a => {
    const short     = a.name.length > 26 ? a.name.substring(0, 23) + '…' : a.name;
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
        <button class="foto-upload-btn" data-action="upload-ss-foto" data-id="${esc(a.id)}">
          🃏 StockSwipe-Foto ${hasSsFoto ? 'ändern' : 'hochladen'}
        </button>
      </div>`;
  }).join('') || '<div class="empty-state">Keine Artikel gefunden</div>';
}

function triggerSsFotoUpload(id) {
  ssFotoTargetId = id;
  const inp = document.getElementById('ss-foto-file-input');
  inp.value = '';
  inp.click();
}

async function uploadSsFoto() {
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
  } catch (e) { toast(e.message, 'error'); }
}

// ── PIN ──
function togglePinVisibility() {
  pinVisible = !pinVisible;
  document.getElementById('current-pin-display').textContent = pinVisible ? currentPin : '****';
}

function adminPinKey(digit) {
  if (newPinValue.length >= 4) return;
  newPinValue += digit;
  updatePinDots();
}

function adminPinDel() {
  newPinValue = newPinValue.slice(0, -1);
  updatePinDots();
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    document.getElementById(`pdot-${i}`).classList.toggle('filled', i < newPinValue.length);
  }
}

async function savePIN() {
  const msg = document.getElementById('pin-msg');
  if (newPinValue.length < 4) {
    msg.style.color = 'var(--red)';
    msg.textContent = 'Bitte 4-stelligen PIN eingeben.';
    return;
  }
  try {
    await updateDoc(doc(db, 'config', 'app'), { pin: newPinValue });
    currentPin  = newPinValue;
    newPinValue = '';
    updatePinDots();
    msg.style.color = 'var(--green)';
    msg.textContent = '✅ PIN gespeichert!';
    toast('PIN geändert!');
    setTimeout(() => msg.textContent = '', 3000);
  } catch (e) { toast(e.message, 'error'); }
}

// ── LAUFBAND ──
async function saveLaufband() {
  const text = (document.getElementById('laufband-input').value || '').trim();
  const msg  = document.getElementById('laufband-msg');
  try {
    await setDoc(doc(db, 'config', 'app'), { laufband: text }, { merge: true });
    msg.style.color = 'var(--green)';
    msg.textContent = text ? '✅ Laufband gespeichert!' : '✅ Laufband geleert.';
    toast(text ? 'Laufband gespeichert!' : 'Laufband geleert.');
    setTimeout(() => msg.textContent = '', 3000);
  } catch (e) { toast(e.message, 'error'); }
}

async function clearLaufband() {
  document.getElementById('laufband-input').value = '';
  updateLaufbandPreview();
  await saveLaufband();
}

function updateLaufbandPreview() {
  const text    = (document.getElementById('laufband-input').value || '').trim();
  const wrap    = document.getElementById('laufband-preview-wrap');
  const preview = document.getElementById('laufband-preview-text');
  if (text) {
    preview.textContent = text;
    wrap.style.display = '';
  } else {
    wrap.style.display = 'none';
  }
}

document.getElementById('laufband-input').addEventListener('input', updateLaufbandPreview);

// Aktuellen Laufband-Text beim Laden einmalig aus Firestore holen
getDoc(doc(db, 'config', 'app')).then(snap => {
  const text = snap.exists() ? (snap.data().laufband || '') : '';
  document.getElementById('laufband-input').value = text;
  updateLaufbandPreview();
}).catch(() => {});

// ── USERS ──
function renderUsers() {
  const list = document.getElementById('user-list');
  const roleLabels = { admin: 'ADMIN', wachenleiter: 'WACHENLEITER' };
  const roleColors = { admin: 'badge-orange', wachenleiter: 'badge-blue' };

  list.innerHTML = alleUsers.map(u => `
    <div class="user-item">
      <div class="user-avatar">${u.role === 'admin' ? '👑' : '🧑‍💼'}</div>
      <div class="user-info">
        <div class="user-email">${esc(u.email)}</div>
        <div class="user-name">${esc(u.name || '')}</div>
      </div>
      <span class="badge ${roleColors[u.role] || 'badge-blue'}">${roleLabels[u.role] || esc(u.role)}</span>
      <select class="form-input" style="max-width:160px;font-size:0.78rem;" data-action="change-role" data-uid="${esc(u.id)}">
        <option value="wachenleiter" ${u.role === 'wachenleiter' ? 'selected' : ''}>Wachenleiter</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
      </select>
    </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--muted);">Keine Accounts gefunden</div>';
}

async function changeRole(uid, role) {
  try {
    await updateDoc(doc(db, 'users', uid), { role });
    const idx = alleUsers.findIndex(u => u.id === uid);
    if (idx >= 0) alleUsers[idx].role = role;
    toast('Rolle geändert');
    renderUsers();
  } catch (e) { toast(e.message, 'error'); }
}

// ── BACKUP ──
async function exportDB(typ) {
  toast('Export wird erstellt...');
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    let exportObj = { exportiert: new Date().toISOString(), typ, version: '1.0' };
    let filename  = '';

    if (typ === 'komplett' || typ === 'artikel') {
      const aSnap = await getDocs(collection(db, 'artikel'));
      exportObj.artikel = aSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
      document.getElementById('export-artikel-count').textContent = exportObj.artikel.length;
    }
    if (typ === 'komplett') {
      const bSnap = await getDocs(query(collection(db, 'bereiche'), orderBy('reihenfolge')));
      exportObj.bereiche = bSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
      document.getElementById('export-bereiche-count').textContent = exportObj.bereiche.length;
      const cSnap = await getDoc(doc(db, 'config', 'app'));
      if (cSnap.exists()) exportObj.config = cSnap.data();
      const bestSnap = await getDocs(query(collection(db, 'bestellungen'), orderBy('datum', 'desc')));
      exportObj.bestellungen = bestSnap.docs.map(d => ({
        _id: d.id, ...d.data(),
        datum: d.data().datum?.toDate?.().toISOString() || d.data().datum,
      }));
      document.getElementById('export-bestellungen-count').textContent = exportObj.bestellungen.length;
      filename = `lagerapp_backup_${timestamp}.json`;
    } else if (typ === 'artikel') {
      filename = `lagerapp_artikel_${timestamp}.json`;
    } else if (typ === 'chargen') {
      const aSnap = await getDocs(collection(db, 'artikel'));
      exportObj.artikel = aSnap.docs.map(d => ({ _id: d.id, ...d.data() }))
        .filter(a => a.chargen && a.chargen.length > 0)
        .map(a => ({ _id: a._id, name: a.name, gtin: a.gtin, gtins: a.gtins, chargen: a.chargen }));
      filename = `lagerapp_chargen_${timestamp}.json`;
    }

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);

    const hist = JSON.parse(localStorage.getItem('lagerapp-backups') || '[]');
    hist.unshift({ datum: new Date().toISOString(), filename });
    localStorage.setItem('lagerapp-backups', JSON.stringify(hist.slice(0, 5)));
    renderBackupHistory();
    toast('✅ ' + filename);
  } catch (e) { toast(e.message, 'error'); }
}

function sanitizeLP(lp) {
  return (lp || 'unbekannt').replace(/\./g, '-').replace(/\//g, '_').replace(/\s+/g, '_');
}

function extFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
    return m ? m[1].toLowerCase() : 'jpg';
  } catch { return 'jpg'; }
}

async function exportBilder() {
  if (typeof JSZip === 'undefined') { toast('JSZip nicht geladen', 'error'); return; }
  const logEl   = document.getElementById('bilder-export-log');
  const progEl  = document.getElementById('bilder-export-progress-fill');
  const textEl  = document.getElementById('bilder-export-progress-text');
  const progBox = document.getElementById('bilder-export-progress');
  progBox.classList.remove('hidden');
  logEl.innerHTML = '';

  function log(msg, color = 'var(--text2)') {
    const d = document.createElement('div');
    d.style.color = color; d.textContent = msg;
    logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight;
  }
  function setProgress(pct) {
    progEl.style.width = pct + '%';
    textEl.textContent = Math.round(pct) + '%';
  }

  try {
    log('📦 Lade Artikel aus Firestore...');
    const snap   = await getDocs(collection(db, 'artikel'));
    const artikel = snap.docs.map(d => ({ _id: d.id, ...d.data() }));

    const withFoto  = artikel.filter(a => a.fotoUrl);
    const withLager = artikel.filter(a => a.lagerFotoUrl);
    document.getElementById('bilder-export-produkt-count').textContent = withFoto.length;
    document.getElementById('bilder-export-lager-count').textContent   = withLager.length;

    const totalImages = withFoto.length + withLager.length;
    if (totalImages === 0) { toast('Keine Bilder vorhanden', 'error'); return; }

    log(`🖼️ ${totalImages} Bilder werden heruntergeladen...`);
    const zip      = new JSZip();
    const manifest = [];
    let done = 0;

    for (const a of artikel) {
      const lpSafe = sanitizeLP(a.lp);

      for (const typ of ['produkt', 'lager']) {
        const url = typ === 'produkt' ? a.fotoUrl : a.lagerFotoUrl;
        if (!url) continue;
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob     = await resp.blob();
          const ext      = extFromUrl(url);
          const filename = `${lpSafe}_${typ}.${ext}`;
          zip.file(filename, blob);
          manifest.push({ filename, lp: a.lp, artikelId: a._id, name: a.name, typ });
          done++;
          setProgress(done / totalImages * 95);
          log(`   ✅ ${filename}`, 'var(--green)');
        } catch (e) {
          log(`   ⚠️ ${a.name} (${typ}): ${e.message}`, 'var(--yellow)');
          done++;
          setProgress(done / totalImages * 95);
        }
      }
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    log('🗜️ ZIP wird erstellt...');
    const blob      = await zip.generateAsync({ type: 'blob' }, meta => setProgress(95 + meta.percent * 0.05));
    const timestamp = new Date().toISOString().split('T')[0];
    const filename  = `lagerapp_bilder_${timestamp}.zip`;
    const url       = URL.createObjectURL(blob);
    const a         = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setProgress(100);
    log(`🎉 ${filename} (${manifest.length} Bilder)`, 'var(--green)');
    toast('✅ ' + filename);
  } catch (e) { log('❌ ' + e.message, 'var(--red)'); toast(e.message, 'error'); }
}

function renderBackupHistory() {
  const el = document.getElementById('backup-history');
  if (!el) return;
  const hist = JSON.parse(localStorage.getItem('lagerapp-backups') || '[]');
  if (hist.length === 0) { el.textContent = 'Noch keine Backups erstellt'; return; }
  el.innerHTML = hist.map(h => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.78rem;">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;">${esc(h.filename)}</span>
      <span style="color:var(--muted);">${new Date(h.datum).toLocaleDateString('de-DE')}</span>
    </div>`).join('');
}

function loadImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      window._importData = JSON.parse(e.target.result);
      const infos = [];
      if (window._importData.artikel)      infos.push(`📦 ${window._importData.artikel.length} Artikel`);
      if (window._importData.bereiche)     infos.push(`🏠 ${window._importData.bereiche.length} Bereiche`);
      if (window._importData.bestellungen) infos.push(`📋 ${window._importData.bestellungen.length} Bestellungen`);
      if (window._importData.config)       infos.push(`⚙️ Config`);
      document.getElementById('import-preview').classList.remove('hidden');
      document.getElementById('import-preview-content').innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          ${infos.map(i => `<span class="badge badge-blue">${esc(i)}</span>`).join('')}
        </div>
        <div style="font-size:0.72rem;color:var(--muted);">
          Exportiert: ${window._importData.exportiert ? new Date(window._importData.exportiert).toLocaleString('de-DE') : 'Unbekannt'}
        </div>`;
      const btn = document.getElementById('btn-import-start');
      btn.disabled = false; btn.style.opacity = '1';
      document.getElementById('drop-zone').style.borderColor = 'var(--green)';
    } catch (e) { toast('Ungültige Datei: ' + e.message, 'error'); }
  };
  reader.readAsText(file);
}

async function startImport() {
  const importData = window._importData;
  if (!importData) return;
  const mode   = document.querySelector('input[name="import-mode"]:checked').value;
  const logEl  = document.getElementById('import-log');
  const progEl = document.getElementById('import-progress-fill');
  const textEl = document.getElementById('import-progress-text');
  document.getElementById('import-progress').classList.remove('hidden');
  document.getElementById('btn-import-start').disabled = true;
  logEl.innerHTML = '';

  function log(msg, color = 'var(--text2)') {
    const d = document.createElement('div');
    d.style.color = color; d.textContent = msg;
    logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight;
  }
  function setProgress(pct) {
    progEl.style.width = pct + '%';
    textEl.textContent = Math.round(pct) + '%';
  }

  try {
    if (mode === 'replace') {
      log('🗑️ Lösche bestehende Daten...');
      if (importData.artikel) {
        const aSnap = await getDocs(collection(db, 'artikel'));
        if (aSnap.size > 0) {
          const b = writeBatch(db);
          aSnap.docs.forEach(d => b.delete(d.ref));
          await b.commit();
        }
        log(`   ✅ ${aSnap.size} Artikel gelöscht`, 'var(--yellow)');
      }
      if (importData.bereiche) {
        const bSnap = await getDocs(collection(db, 'bereiche'));
        if (bSnap.size > 0) {
          const b = writeBatch(db);
          bSnap.docs.forEach(d => b.delete(d.ref));
          await b.commit();
        }
        log(`   ✅ ${bSnap.size} Bereiche gelöscht`, 'var(--yellow)');
      }
    }

    const total = (importData.artikel?.length || 0) + (importData.bereiche?.length || 0);
    let done = 0;

    if (importData.artikel?.length > 0) {
      log('📦 Importiere Artikel...');
      for (let i = 0; i < importData.artikel.length; i += 400) {
        const b     = writeBatch(db);
        const chunk = importData.artikel.slice(i, i + 400);
        for (const a of chunk) {
          const { _id, ...data } = a;
          const r = _id ? doc(db, 'artikel', _id) : doc(collection(db, 'artikel'));
          b.set(r, data, { merge: mode === 'merge' });
          done++; setProgress(total > 0 ? done / total * 100 : 50);
        }
        await b.commit();
        log(`   ✅ ${Math.min(i + 400, importData.artikel.length)} / ${importData.artikel.length}`, 'var(--green)');
      }
    }

    if (importData.bereiche?.length > 0) {
      log('🏠 Importiere Bereiche...');
      for (const be of importData.bereiche) {
        const { _id, ...data } = be;
        const r = _id ? doc(db, 'bereiche', _id) : doc(collection(db, 'bereiche'));
        await setDoc(r, data, { merge: mode === 'merge' });
        done++; setProgress(total > 0 ? done / total * 100 : 75);
      }
      log(`   ✅ ${importData.bereiche.length} Bereiche`, 'var(--green)');
    }

    if (importData.config) {
      await setDoc(doc(db, 'config', 'app'), importData.config, { merge: true });
      log('   ✅ Config importiert', 'var(--green)');
    }

    setProgress(100);
    log('🎉 Import abgeschlossen!', 'var(--green)');
    toast('Import abgeschlossen ✅');
    await loadAll();

  } catch (e) {
    log('❌ ' + e.message, 'var(--red)');
    toast(e.message, 'error');
    document.getElementById('btn-import-start').disabled = false;
  }
}

async function loadBilderImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (typeof JSZip === 'undefined') { toast('JSZip nicht geladen', 'error'); return; }
  try {
    const zip          = await JSZip.loadAsync(file);
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) { toast('Ungültiges ZIP: manifest.json fehlt', 'error'); return; }
    const manifest     = JSON.parse(await manifestFile.async('string'));
    const produktCount = manifest.filter(e => e.typ === 'produkt').length;
    const lagerCount   = manifest.filter(e => e.typ === 'lager').length;
    window._bilderImportData = { manifest, zip };
    document.getElementById('bilder-import-preview').classList.remove('hidden');
    document.getElementById('bilder-import-preview-content').innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <span class="badge badge-blue">📦 ${produktCount} Produktfotos</span>
        <span class="badge badge-blue">🗄️ ${lagerCount} Lagerfotos</span>
      </div>
      <div style="font-size:0.72rem;color:var(--muted);">${manifest.length} Bilder in ${esc(file.name)}</div>`;
    const btn = document.getElementById('btn-bilder-import-start');
    btn.disabled = false; btn.style.opacity = '1';
    document.getElementById('bilder-drop-zone').style.borderColor = 'var(--green)';
  } catch (e) { toast('Ungültige Datei: ' + e.message, 'error'); }
}

async function startBilderImport() {
  const data = window._bilderImportData;
  if (!data) return;
  const { manifest, zip } = data;
  const logEl  = document.getElementById('bilder-import-log');
  const progEl = document.getElementById('bilder-import-progress-fill');
  const textEl = document.getElementById('bilder-import-progress-text');
  document.getElementById('bilder-import-progress').classList.remove('hidden');
  document.getElementById('btn-bilder-import-start').disabled = true;
  logEl.innerHTML = '';

  function log(msg, color = 'var(--text2)') {
    const d = document.createElement('div');
    d.style.color = color; d.textContent = msg;
    logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight;
  }
  function setProgress(pct) {
    progEl.style.width = pct + '%';
    textEl.textContent = Math.round(pct) + '%';
  }

  try {
    log('📋 Lade Artikel aus Firestore...');
    const snap  = await getDocs(collection(db, 'artikel'));
    const lpMap = {};
    snap.docs.forEach(d => { if (d.data().lp) lpMap[d.data().lp] = d.id; });

    const total = manifest.length;
    let done = 0, ok = 0, skipped = 0;

    for (const entry of manifest) {
      const { filename, lp, artikelId, name, typ } = entry;
      const docId = lpMap[lp] || artikelId;
      if (!docId) {
        log(`   ⚠️ Kein Artikel für LP "${lp}" gefunden – übersprungen`, 'var(--yellow)');
        skipped++; done++; setProgress(done / total * 100); continue;
      }

      const zipEntry = zip.file(filename);
      if (!zipEntry) {
        log(`   ⚠️ Datei "${filename}" nicht im ZIP – übersprungen`, 'var(--yellow)');
        skipped++; done++; setProgress(done / total * 100); continue;
      }

      try {
        const blob = await zipEntry.async('blob');
        const fd   = new FormData();
        fd.append('file', blob, filename);
        fd.append('upload_preset', 'lagerapp_unsigned');
        fd.append('folder', 'lagerapp/artikel');
        const res    = await fetch('https://api.cloudinary.com/v1_1/dvqug2dcx/image/upload', { method: 'POST', body: fd });
        const result = await res.json();
        if (!result.secure_url) throw new Error(result.error?.message || 'Upload fehlgeschlagen');

        const field = typ === 'produkt' ? 'fotoUrl' : 'lagerFotoUrl';
        await updateDoc(doc(db, 'artikel', docId), { [field]: result.secure_url });
        log(`   ✅ ${name} → ${typ}`, 'var(--green)');
        ok++;
      } catch (e) {
        log(`   ❌ ${name} (${typ}): ${e.message}`, 'var(--red)');
        skipped++;
      }
      done++; setProgress(done / total * 100);
    }

    setProgress(100);
    log(`🎉 Fertig: ${ok} importiert, ${skipped} übersprungen`, 'var(--green)');
    toast(`✅ ${ok} Bilder importiert`);
    await loadAll();
  } catch (e) {
    log('❌ ' + e.message, 'var(--red)');
    toast(e.message, 'error');
    document.getElementById('btn-bilder-import-start').disabled = false;
  }
}

// ── LIEFERANTEN-ZUWEISUNG ──
const LIEFERANTEN_NAMEN = {
  ekg: 'Meßmer (EKG)', ezio: 'Teleflex (EZ-IO)', hygiene: 'Orochemie (Hygiene)',
  apotheke: 'Klinikum (Apotheke)', thermopapier: 'medDV (Thermopapier)',
  sauerstoff: 'Kraiss & Friz (O₂)', vokranken: 'Kohlhammer (VO)', radecker: 'Radecker',
};

let _liefChanges = {};

function renderLieferantenTabelle() {
  _liefChanges = {};
  document.getElementById('btn-lief-save').disabled = true;
  filterLieferantenTabelle();
}

function filterLieferantenTabelle() {
  const q    = (document.getElementById('lief-search')?.value || '').toLowerCase();
  const lief = document.getElementById('lief-filter-lieferant')?.value || '';
  const tbody = document.getElementById('lief-table-body');
  if (!tbody) return;
  const filtered = alleArtikel.filter(a =>
    (!q || a.name.toLowerCase().includes(q)) &&
    (!lief || (a.lieferant || '') === lief)
  );
  tbody.innerHTML = filtered.map(a => `
    <tr style="border-bottom:1px solid var(--hairline);">
      <td style="padding:8px 16px;font-size:0.82rem;">${esc(a.name)}<br><span style="font-size:0.68rem;color:var(--muted);">${esc(a.lp || '')}</span></td>
      <td style="padding:8px 16px;">
        <select class="form-input" style="font-size:0.78rem;" data-action="lief-change" data-id="${esc(a.id)}" data-field="lieferant">
          <option value="" ${!a.lieferant ? 'selected' : ''}>— kein —</option>
          ${Object.entries(LIEFERANTEN_NAMEN).map(([k, v]) => `<option value="${esc(k)}" ${a.lieferant === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}
        </select>
      </td>
      <td style="padding:8px 16px;">
        <input type="text" class="form-input" style="font-size:0.78rem;" value="${esc(a.formularFeld || '')}" placeholder="bestellmenge_pos1" data-action="lief-change" data-id="${esc(a.id)}" data-field="formularFeld">
      </td>
    </tr>`).join('');
}

function onLiefChange(id, field, value) {
  if (!_liefChanges[id]) _liefChanges[id] = {};
  _liefChanges[id][field] = value;
  const a = alleArtikel.find(x => x.id === id);
  if (a) a[field] = value;
  document.getElementById('btn-lief-save').disabled = false;
}

async function saveLieferantenBatch() {
  const btn = document.getElementById('btn-lief-save');
  btn.disabled = true; btn.textContent = 'Wird gespeichert…';
  try {
    const batch = writeBatch(db);
    for (const [id, changes] of Object.entries(_liefChanges)) {
      batch.update(doc(db, 'artikel', id), changes);
      const a = alleArtikel.find(x => x.id === id);
      if (a) Object.assign(a, changes);
    }
    const count = Object.keys(_liefChanges).length;
    await batch.commit();
    _liefChanges = {};
    toast(`✅ ${count} Artikel gespeichert`);
  } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
  btn.textContent = '💾 Alle speichern';
}

function autoAssignRadecker() {
  if (!alleArtikel || alleArtikel.length === 0) { toast('Artikel noch nicht geladen', 'error'); return; }
  function radField(idx) {
    const p = idx <= 50 ? 1 : idx <= 114 ? 2 : idx <= 178 ? 3 : 4;
    return `bestellmenge_p${p}_${idx}`;
  }
  const MAP = [
    [['desinfektionshandschuhe','gr. s'], 77], [['desinfektionshandschuhe','gr. m'], 78],
    [['desinfektionshandschuhe','gr. l'], 79], [['desinfektionshandschuhe','gr. xl'], 80],
    [['handschuhe','gr. s'], 73], [['handschuhe','gr. m'], 74],
    [['handschuhe','gr. l'], 75], [['handschuhe','gr. xl'], 76],
    [['igel','plus','gr. 3'], 90], [['igel','plus','gr. 4'], 91], [['igel','plus','gr. 5'], 92],
    [['igel','gr. 1,5'], 87], [['igel','gr. 2,5'], 89],
    [['igel','gr. 1'], 86], [['igel','gr. 2'], 88],
    [['magill','groß'], 116], [['magill','klein'], 117],
    [['müllbeutel','blau'], 122], [['müllbeutel','120'], 122], [['müllbeutel','15'], 121],
    [['tubus','ohne','2,5'], 42], [['tubus','ohne','3,5'], 43],
    [['tubus','3,0'], 44], [['tubus','3,5'], 45], [['tubus','4,0'], 46], [['tubus','4,5'], 47],
    [['tubus','5,0'], 49], [['tubus','5,5'], 50], [['tubus','6,0'], 51],
    [['tubus','7,0'], 52], [['tubus','8,0'], 53],
    [['guedel','gr. 4'], 62], [['guedel','gr. 5'], 63], [['guedel','gr. 6'], 64],
    [['guedel','gr. 7'], 65], [['guedel','gr. 8'], 66], [['guedel','gr. 9'], 67],
    [['guedel','gr. 10'], 68], [['guedel','gr. 11'], 69],
    [['absaugkatheter','ch.6'], 1], [['absaugkatheter','ch 6'], 1],
    [['absaugkatheter','ch.14'], 2], [['absaugkatheter','ch 14'], 2],
    [['absaugkatheter','ch.16'], 3], [['absaugkatheter','ch 16'], 3],
    [['larynxmaske','1,0'], 102], [['larynxmaske','1,5'], 103], [['larynxmaske','2,0'], 104],
    [['larynxmaske','2,5'], 105], [['larynxmaske','3,0'], 106], [['larynxmaske','4,0'], 107],
    [['larynxmaske','5,0'], 108],
    [['larynxmaske','gr. 1'], 102], [['larynxmaske','gr. 2'], 104], [['larynxmaske','gr. 3'], 106],
    [['larynxmaske','gr. 4'], 107], [['larynxmaske','gr. 5'], 108],
    [['cpap','maske','951'], 15], [['cpap','maske','953'], 16], [['cpap','maske','954'], 17],
    [['cpap','maske','955'], 18], [['cpap','maske','956'], 19],
    [['aerosol','erw'], 5], [['aerosol','kind'], 6],
    [['vernebler','erw'], 5], [['vernebler','kind'], 6],
    [['beatmungsbeutel','erw'], 11], [['beatmungsbeutel','kind'], 12],
    [['iso-gard'], 13], [['beatmungsfilter','intersurgical'], 14],
    [['blutdruck','bein'], 21], [['blutdruck','kleinkind'], 24],
    [['blutdruck','kind'], 23], [['blutdruck','erw'], 22],
    [['fixationsband','erw'], 57], [['fixationsband','kind'], 58],
    [['laryngoskop','erw'], 100], [['laryngoskop','kind'], 101],
    [['macintosh','dahlhausen'], 157],
    [['macintosh','resq','1'], 158], [['macintosh','resq','2'], 159],
    [['macintosh','resq','3'], 160], [['macintosh','resq','4'], 161],
    [['macintosh','resq','5'], 162],
    [['macintosh','gr. 1'], 158], [['macintosh','gr. 2'], 159], [['macintosh','gr. 3'], 160],
    [['macintosh','gr. 4'], 161], [['macintosh','gr. 5'], 162],
    [['miller','gr. 0'], 155], [['miller','gr. 1'], 156],
    [['miller',' 0'], 155], [['miller',' 1'], 156],
    [['replantat','groß'], 146], [['replantat','klein'], 147],
    [['skalpell','10'], 153], [['skalpell','11'], 154],
    [['luer-lock'], 111], [['injekt-f'], 163], [['injekt f'], 163],
    [['discardit','1'], 164], [['discardit','5'], 165],
    [['discardit','10'], 166], [['discardit','20'], 167],
    [['thomas holder','select'], 174], [['thomas holder','erw'], 174],
    [['thomas holder','pediatric'], 175], [['thomas holder','kind'], 175],
    [['mcgrath','akku'], 191], [['videolaryngoskop','akku'], 191],
    [['mcgrath','spatel','072'], 192], [['mcgrath','spatel','017'], 193],
    [['mcgrath','spatel','005'], 194], [['mcgrath','spatel','013'], 195],
    [['mcgrath','x blade'], 196], [['mcgrath','x-blade'], 196],
    [['mcgrath','gerät'], 190],
    [['viggo','pflaster'], 203], [['viggo','leukomed'], 203],
    [['viggo','14g'], 201], [['viggo','16g'], 199], [['viggo','18g'], 200],
    [['viggo','20g'], 202], [['viggo','22g'], 197], [['viggo','24g'], 198],
    [['viggo','14'], 201], [['viggo','16'], 199], [['viggo','18'], 200],
    [['viggo','20'], 202], [['viggo','22'], 197], [['viggo','24'], 198],
    [['wendel','12'], 204], [['wendel','14'], 205], [['wendel','16'], 206],
    [['wendel','18'], 207], [['wendel','20'], 208], [['wendel','28'], 209],
    [['sauerstoffmaske','erw'], 128], [['sauerstoffmaske','kind'], 129],
    [['o2-maske','erw'], 128], [['o2-maske','kind'], 129],
    [['o2','maske','erw'], 128], [['o2','maske','kind'], 129],
    [['magensonde','mit mandrin'], 114], [['magensonde','mit'], 114],
    [['magensonde','ohne'], 113],
    [['hws','erw'], 82], [['hws','kind'], 83],
    [['augenspülung','nacl'], 8], [['augenspülung','0,9'], 8],
    [['augenspülung','ph'], 9], [['augenspülung','phosphat'], 9],
    [['mullkompressen','8x8'], 120], [['mullkompressen','5x5'], 181],
    [['tupfer','5x5'], 181],
    [['verbrennungstuch','betttuch'], 187], [['aluderm','betttuch'], 187],
    [['handabsaugpumpe','zubehör'], 72], [['handabsaugpumpe'], 71],
    [['decke','sommer'], 33], [['decken','sommer'], 33],
    [['decke','winter'], 34], [['decken','winter'], 34],
    [['verbandpäckchen','groß'], 185],
    [['absaugbeutel'], 0], [['absaugschlauch'], 4], [['aufziehkanüle'], 7],
    [['beatmungsschlauch'], 10], [['beckenschlinge'], 20], [['celox'], 25],
    [['chest seal'], 26], [['foxseal'], 26], [['chirurgisches besteck'], 27],
    [['eingaswarngerät'], 28], [['co-warngerät'], 28],
    [['schnelltest','covid'], 29], [['covid','test'], 29],
    [['cuffdruckmesser'], 30], [['cutasept'], 31], [['ypsipor'], 32],
    [['dreiecktuch'], 35], [['dreiecktücher'], 35], [['dreiwegehahn'], 36],
    [['druckinfusion'], 37], [['easy splint'], 38], [['einmallaken'], 39],
    [['klebeelektroden'], 40], [['elektrodengel'], 41],
    [['mandrin','asid'], 48], [['einführungsmandrin'], 48],
    [['ffp2'], 54], [['ffp3'], 55], [['fingertipp'], 56],
    [['gänsegurgel'], 61], [['haix'], 70],
    [['lindesa'], 81], [['hyperventilationsmaske'], 84], [['sterican'], 85],
    [['intrafix'], 93], [['infusionssystem'], 93],
    [['kältekompresse'], 94], [['kühlkompresse'], 94], [['kältebeutel'], 94],
    [['kontamed'], 95], [['sani 200'], 96], [['multi-safe','200'], 96],
    [['kindersicher'], 97], [['kleiderschere'], 98], [['kombistopfen'], 99],
    [['leukoplast'], 109], [['leukosilk'], 110], [['katherspritze'], 112],
    [['magensondenbeutel'], 115], [['ringmagnet'], 118], [['schrittmachermagnet'], 118],
    [['mini-spike'], 119], [['minispike'], 119],
    [['mundschutz'], 123], [['op-maske'], 123], [['mund-nasen-schutz'], 123],
    [['mundspatel'], 124], [['nabelklemme'], 125],
    [['nasalzerstäuber'], 126], [['mad100'], 126],
    [['nierenschale'], 127],
    [['sicherheitsschlauch'], 130], [['o2-sicherheitsschlauch'], 130],
    [['nasensonde'], 131], [['o2-brille'], 131], [['sauerstoffbrille'], 131],
    [['ohrthermometer','braun'], 132],
    [['thermometerfilter'], 133], [['meßfilter'], 133], [['ohrfilter'], 133],
    [['oro-sauger'], 134], [['orosauger'], 134],
    [['peep','ventil'], 135], [['peepventil'], 135],
    [['perfusor','leitung'], 136], [['perfusorleitung'], 136],
    [['perfusor','spritze'], 137], [['perfusorspritze'], 137],
    [['pinkelbeutel'], 138], [['pinzette'], 139], [['portkanüle'], 140],
    [['pulsoximeter'], 141], [['pulsoxy'], 141], [['pulsox'], 141],
    [['pupillenleuchte'], 142], [['rasierer'], 143], [['heizdecke'], 144],
    [['regenschutz'], 145], [['rettungsdecke'], 148],
    [['rückschlagventil'], 149], [['infuvalve'], 149],
    [['saugunterlage'], 150], [['brechbeutel'], 151], [['silberwindel'], 152],
    [['schere','steril'], 168], [['chirurgische schere'], 168],
    [['sterillium'], 171], [['virugard'], 171], [['stethoskop'], 172],
    [['s-guide'], 173], [['intubationshilfe'], 173],
    [['thoraxentlastungsnadel'], 176], [['angiocath'], 176],
    [['thoraxdrainage'], 177], [['tourniquet'], 178],
    [['patienteneigentum'], 179], [['tragetasche','patient'], 179],
    [['tragetuch'], 180],
    [['universalbinde'], 182], [['koniotomie'], 183], [['surgicric'], 183],
    [['venenstauer'], 184], [['verbandtuch'], 186],
    [['verbrennungstuch'], 188], [['aluderm'], 188],
    [['cirrus'], 189], [['videolaryngoskop'], 190],
    [['yankauer'], 210], [['zahnprothese'], 211], [['reflexschild'], 212],
    [['tupfer'], 181],
  ];

  let count = 0;
  for (const a of alleArtikel) {
    if (a.lieferant && a.lieferant !== '' && a.lieferant !== 'radecker') continue;
    const nameLow = (a.name || '').toLowerCase();
    for (const [keywords, idx] of MAP) {
      if (keywords.every(k => nameLow.includes(k))) {
        const feld = radField(idx);
        if (a.lieferant !== 'radecker' || a.formularFeld !== feld) {
          onLiefChange(a.id, 'lieferant', 'radecker');
          onLiefChange(a.id, 'formularFeld', feld);
          count++;
        }
        break;
      }
    }
  }
  filterLieferantenTabelle();
  toast(count > 0
    ? `🔄 ${count} Artikel Radecker zugeordnet – bitte prüfen & speichern`
    : 'Keine neuen Zuordnungen gefunden');
}

// ── EVENT DELEGATION & LISTENERS ──

// Theme toggle
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

// Logout buttons
document.querySelectorAll('.btn-logout-trigger').forEach(btn => {
  btn.addEventListener('click', doLogout);
});

// Sidebar + navbar logout (use event delegation on document for any logout button)
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {
    case 'logout':
      doLogout();
      break;
    case 'go-to-mitarbeiter':
      goToMitarbeiter();
      break;
    case 'open-bottom-sheet':
      openBottomSheet();
      break;
    case 'close-bottom-sheet':
      closeBottomSheet();
      break;
    case 'show-section': {
      const section = btn.dataset.section;
      showSection(section);
      if (btn.closest('#bottom-sheet')) closeBottomSheet();
      break;
    }
    case 'open-artikel-modal':
      openArtikelModal(null);
      break;
    case 'close-artikel-modal':
      closeArtikelModal();
      break;
    case 'save-artikel':
      saveArtikel();
      break;
    case 'edit-artikel':
      openArtikelModal(btn.dataset.id);
      break;
    case 'delete-artikel':
      deleteArtikel(btn.dataset.id, btn.dataset.name);
      break;
    case 'open-bereich-modal':
      openBereichModal(null);
      break;
    case 'close-bereich-modal':
      closeBereichModal();
      break;
    case 'save-bereich':
      saveBereich();
      break;
    case 'edit-bereich':
      openBereichModal(btn.dataset.id);
      break;
    case 'upload-foto':
      triggerFotoUpload(btn.dataset.id, btn.dataset.type);
      break;
    case 'delete-foto':
      deleteFotoFromGrid(btn.dataset.id, btn.dataset.type);
      break;
    case 'upload-ss-foto':
      triggerSsFotoUpload(btn.dataset.id);
      break;
    case 'toggle-pin-visibility':
      togglePinVisibility();
      break;
    case 'pin-key':
      adminPinKey(btn.dataset.digit);
      break;
    case 'pin-del':
      adminPinDel();
      break;
    case 'save-pin':
      savePIN();
      break;
    case 'save-laufband':
      saveLaufband();
      break;
    case 'clear-laufband':
      clearLaufband();
      break;
    case 'create-new-user':
      createNewUser();
      break;
    case 'export-db':
      exportDB(btn.dataset.typ);
      break;
    case 'export-bilder':
      exportBilder();
      break;
    case 'start-import':
      startImport();
      break;
    case 'start-bilder-import':
      startBilderImport();
      break;
    case 'open-import-file':
      document.getElementById('import-file').click();
      break;
    case 'open-bilder-import-file':
      document.getElementById('bilder-import-file').click();
      break;
    case 'lief-auto':
      autoAssignRadecker();
      break;
    case 'lief-save':
      saveLieferantenBatch();
      break;
    case 'goto-scanner':
      window.location.href = 'scanner.html';
      break;
    case 'goto-portal':
      window.location.href = 'portal.html';
      break;
    case 'goto-lager':
      window.location.href = '../index.html';
      break;
  }
});

// Change events (selects and inputs with data-action)
document.addEventListener('change', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'filter-artikel') {
    filterArtikel();
  } else if (action === 'filter-bereich') {
    filterArtikel();
  } else if (action === 'filter-foto') {
    renderFotoSection();
  } else if (action === 'filter-ss-foto') {
    renderSsFotos();
  } else if (action === 'update-lp') {
    updateArtikelLP(el.dataset.id, el.value);
  } else if (action === 'change-role') {
    changeRole(el.dataset.uid, el.value);
  } else if (action === 'import-mode') {
    const warn = document.getElementById('import-warn');
    if (warn) warn.classList.toggle('hidden', el.value !== 'replace');
  } else if (action === 'lief-change') {
    onLiefChange(el.dataset.id, el.dataset.field, el.value);
  }
});

// Input events
document.addEventListener('input', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'filter-artikel-search') {
    filterArtikel(el.value);
  } else if (action === 'filter-foto') {
    renderFotoSection();
  } else if (action === 'filter-ss-foto') {
    renderSsFotos();
  } else if (action === 'filter-lief') {
    filterLieferantenTabelle();
  } else if (action === 'lief-change') {
    onLiefChange(el.dataset.id, el.dataset.field, el.value);
  }
});

// Modal backdrop clicks
document.getElementById('artikel-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeArtikelModal();
});
document.getElementById('bereich-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeBereichModal();
});

// File input changes (hidden inputs)
document.getElementById('foto-file-input').addEventListener('change', uploadFotoFromGrid);
document.getElementById('ss-foto-file-input').addEventListener('change', uploadSsFoto);
document.getElementById('import-file').addEventListener('change', function() { loadImportFile(this); });
document.getElementById('bilder-import-file').addEventListener('change', function() { loadBilderImportFile(this); });

// Init
renderBackupHistory();
