# 🚑 LAGER//APP
### Digitale Lagerverwaltung & Bestandskontrolle

---

![Version](https://img.shields.io/badge/Version-2.1.0-f97316)
![Status](https://img.shields.io/badge/Status-Live-22c55e)
![Platform](https://img.shields.io/badge/Platform-GitHub%20Pages-0ea5e9)
![Firebase](https://img.shields.io/badge/Backend-Firebase%20Blaze-f97316)
![PWA](https://img.shields.io/badge/PWA-Ready-22c55e)

---

## Inhaltsverzeichnis

- [Übersicht](#übersicht)
- [Live-Demo](#live-demo)
- [Kernfunktionen](#kernfunktionen)
- [Alle Features im Detail](#alle-features-im-detail)
- [Rollen & Berechtigungen](#rollen--berechtigungen)
- [Tech Stack](#tech-stack)
- [Projektstruktur](#projektstruktur)
- [Firebase Konfiguration](#firebase-konfiguration)
- [Firestore Datenstruktur](#firestore-datenstruktur)
- [Scanner – Unterstützte Formate](#scanner--unterstützte-formate)
- [PWA & Push Notifications](#pwa--push-notifications)
- [Setup & Installation](#setup--installation)
- [Sicherheit](#sicherheit)
- [Roadmap](#roadmap)

---

## Übersicht

LAGER//APP ersetzt das Klemmbrett-System der Rettungswache Malmsheim durch eine vollständig digitale Lösung. Die App läuft direkt im Browser – ohne Installation, ohne App Store – und ist für Smartphone, Tablet und PC optimiert.

**Gelöste Probleme:**
- Wöchentliche Lagerbestellung war papierbasiert und zeitaufwändig
- Kein Überblick über Verfallsdaten und Chargen
- Keine digitale Bestellhistorie für den Wachenleiter
- Kein schneller Zugriff auf Lagerorte von Materialien
- Kein koordiniertes Arbeiten mehrerer Kollegen gleichzeitig

---

## Live-Demo

```
https://osxbobo.github.io/Lagerbestellung
```

---

## Kernfunktionen

```
┌─────────────────────────────────────┐
│  🔍 Lagersuche      → offen         │
│  📋 Lagerbestellung → PIN           │
│  📷 Verfallsscan    → PIN           │
│  🔐 Wachenleiter    → Login         │
└─────────────────────────────────────┘
```

---

## Alle Features im Detail

### 🔍 Lagersuche (öffentlich, kein Login)
- Echtzeit-Suche durch alle 245+ Artikel
- Suche nach Name, Aliases und LP-Nummer
- Zeigt: Produktfoto, Bereich, LP-Nummer
- Bereiche-Übersicht als Kacheln
- Beispiel: „Kotztüte" → findet SIC SAC-Brechbeutel

---

### 📋 Lagerbestellung (PIN-geschützt)
- PIN-Eingabe als Modal auf der Startseite oder direkt in `check.html`
- Name wird für den nächsten Besuch gespeichert (PIN nicht)
- PIN-Sperre: nach 5 Fehlversuchen 60 Sekunden Wartezeit
- Firebase Anonymous Authentication nach korrekter PIN-Eingabe
- Geführt durch alle Bereiche mit Fortschrittsbalken
- Pro Artikel: MIN/MAX, Produktfoto (PRODUKT) und Lagerort-Foto (LAGERORT) getrennt angezeigt
- Bei Ja: Schnell-Chips `[1][2][3][5][10]` + Plus/Minus
- Touch-Unterschrift am Ende
- Push-Benachrichtigung an Wachenleiter nach Abschluss

**Multi-User Lagerbestellung:**
- Mehrere Kollegen können gleichzeitig verschiedene Bereiche bearbeiten
- Bereiche auswählen und aufteilen (z.B. Schrank 1–3 / Schrank 4–6 / Büro)
- Laufende Session sichtbar für alle die einsteigen wollen
- Alleine starten – andere können jederzeit mitmachen und Bereiche übernehmen
- Schreibkonflikte werden mit Firestore-Transaktionen verhindert
- PDF zeigt alle beteiligten Namen: `Benni · Timo · Florian`

**Auto-Save / Pause-Funktion:**
- Automatisch gespeichert bei jedem „Weiter →"
- Alle 30 Sekunden im Hintergrund gespeichert
- Bei Einsatzalarm: App einfach schließen – Fortschritt bleibt erhalten
- Beim nächsten Öffnen: Banner zeigt offene Bestellung mit Fortschritt
- Andere Kollegen können pausierte Bestellung fortführen
- Draft wird nach Abschluss automatisch gelöscht

---

### 📷 Verfallsscan (PIN-geschützt)
- Direkt von der Startseite erreichbar (nach PIN)
- Kamera scannt GS1-DataMatrix, QR-Code, Code-128, GS1-128, EAN-13
- HIBC DataMatrix (Medizinprodukte) vollständig unterstützt
- Erkennt automatisch: GTIN, Charge/LOT, Verfallsdatum
- **Bekannte Produkte** → direkt Charge + Verfall speichern
- **Unbekannte Produkte** → einmalig Artikel zuordnen → danach automatisch erkannt
- Sofort-Vorschläge beim Antippen des Suchfelds
- Mehrere Chargen pro Artikel möglich
- Fehlende Daten (LOT/Verfall) manuell ergänzbar (LOT max. 50 Zeichen)
- Vibration als Scan-Feedback + Taschenlampe

**Dual-Scanner (Kamera):**
- ZXing.js → für DataMatrix & QR
- QuaGGA2 → für Code-128 & GS1-128 (lineare Barcodes)
- Beide laufen parallel – wer zuerst erkennt gewinnt

**Bluetooth-Scanner Support:**
- Handscanner (z.B. Netum NT-1228BL) per Bluetooth koppeln
- Funktioniert als Tastatur-Eingabe (HID Mode)
- Status-Anzeige: grau = inaktiv, grün = bereit
- Automatisch aktiv beim Seitenaufruf
- Gleiche GS1/HIBC Logik wie Kamera-Scanner

---

### 🖥️ Wachenleiter-Portal (Login)

| Tab | Inhalt |
|---|---|
| 📊 Dashboard | KPIs, letzte Lagerchecks, Verfallswarnungen |
| 📋 Bestellungen | Komplette Historie, Detail-Modal, PDF, Löschen |
| 🗄️ Chargen & Verfall | Fach für Fach sortiert, Ampelsystem, löschen |
| 📦 Artikelverwaltung | Bearbeiten, neu anlegen, löschen, suchen |
| 🏠 Bereiche | Verwalten, Reihenfolge, neu anlegen |
| 📸 Fotos & Bilder | Produkt- + Lagerort-Fotos verwalten |
| 🔑 PIN ändern | 4-stelligen PIN per Tastenfeld ändern |

**Fotos & Bilder:**
- Suchfeld: Artikel nach Name oder LP-Nummer filtern
- Sortierung: nach Name oder Lagerort (LP, natürliche Sortierung)
- Filter: Ohne Produktfoto / Ohne Lagerortfoto / Ohne beide / Alle Artikel
- Jede Karte zeigt beide Foto-Slots nebeneinander (📦 Produkt | 🗄️ Lagerort)
- Artikel-Dropdown zeigt LP + Name zur leichteren Zuordnung
- Quadratische Vorschau beim Auswählen eines Artikels

**Verfall – 3 Ebenen:**
- **Ebene 1:** Dashboard – nur kritische Artikel (≤30 Tage)
- **Ebene 2:** Tippen → alle Chargen dieses Artikels
- **Ebene 3:** Tab „Chargen & Verfall" – alle Artikel, alle Chargen, filterbar

---

### 🔧 Admin-Bereich (Login)

Alles was Wachenleiter kann + Benutzerverwaltung + Backup.

**Zusätzlich zu Wachenleiter:**
- 👤 Benutzer direkt anlegen (Name, E-Mail, Passwort, Rolle)
- 🔑 Rollen vergeben und ändern
- 💾 Backup & Import:
  - Export: Komplett / Nur Artikel / Nur Chargen als JSON
  - Import: Ergänzen oder Ersetzen mit Live-Fortschrittsbalken
  - Drag & Drop für Importdatei

---

### 📄 PDF-Generierung

Identisch zum offiziellen DRK-Formular:
- Titel-Box, Tabelle (LP · Produkt · MIN · MAX · Hinweis · Bestellen)
- Bereiche als graue Trennzeilen, Zebrierung
- Abkürzungslegende, Unterschrift, roter Hinweis-Rahmen
- Seitennummer auf jeder Seite
- Löschen-Button direkt in der Bestellliste

---

## Rollen & Berechtigungen

| Funktion | Mitarbeiter | Wachenleiter | Admin |
|---|:---:|:---:|:---:|
| Lagersuche | ✅ | ✅ | ✅ |
| Lagerbestellung (PIN) | ✅ | ✅ | ✅ |
| Verfallsscan (PIN) | ✅ | ✅ | ✅ |
| Charge speichern | ❌ | ✅ | ✅ |
| Charge löschen | ❌ | ✅ | ✅ |
| Wachenleiter-Portal | ❌ | ✅ | ✅ |
| PDF herunterladen | ❌ | ✅ | ✅ |
| PDF löschen | ❌ | ✅ | ✅ |
| Artikel bearbeiten | ❌ | ✅ | ✅ |
| Bereiche verwalten | ❌ | ✅ | ✅ |
| Fotos hochladen | ❌ | ✅ | ✅ |
| PIN ändern | ❌ | ✅ | ✅ |
| Benutzer anlegen | ❌ | ❌ | ✅ |
| Rollen vergeben | ❌ | ❌ | ✅ |
| Backup & Import | ❌ | ❌ | ✅ |

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| **Frontend** | HTML5 · CSS3 · Vanilla JavaScript |
| **Hosting** | GitHub Pages |
| **Datenbank** | Firebase Firestore (Blaze Plan) |
| **Authentifizierung** | Firebase Auth (E-Mail + Anonymous) |
| **Foto-Upload** | Cloudinary (Unsigned Preset) |
| **PDF** | jsPDF (CDN) |
| **Scanner 2D** | ZXing.js – DataMatrix, QR |
| **Scanner 1D** | QuaGGA2 – Code128, GS1-128, EAN |
| **Bluetooth-Scanner** | HID Keyboard Input |
| **PWA** | Service Worker · Web Push API |
| **Schriften** | IBM Plex Mono · DM Sans (Google Fonts) |

---

## Projektstruktur

```
Lagerbestellung/
├── index.html              # Startseite – Lagersuche + PIN Modal
├── manifest.json           # PWA Manifest
├── sw.js                   # Service Worker (Cache + Push)
├── README.md
├── CHANGELOG.md
│
├── css/
│   ├── main.css            # Globale Styles + Theme System
│   └── index.css           # Startseiten-Styles
│
├── js/
│   ├── firebase-config.js  # Firebase Konfiguration (zentral)
│   ├── theme.js            # Dark/Light Mode
│   └── pwa.js              # PWA + Push Manager
│
├── icons/
│   ├── icon-192.png        # PWA Icon
│   └── icon-512.png        # PWA Icon
│
└── pages/
    ├── check.html          # Lagerbestellung (Multi-User + Auto-Save)
    ├── scanner.html        # Verfallsscan (Dual-Kamera + Bluetooth)
    ├── login.html          # Login
    ├── portal.html         # Wachenleiter-Portal
    └── admin.html          # Admin-Bereich
```

---

## Firebase Konfiguration

### Authentication

Folgende Sign-in-Methoden müssen aktiviert sein:

| Methode | Verwendet für |
|---|---|
| **E-Mail/Passwort** | Wachenleiter, Admin |
| **Anonymous** | PIN-Nutzer (Lagerbestellung, Verfallsscan) |

> Firebase Console → Authentication → Sign-in method → beides aktivieren

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Nicht-anonymer eingeloggter Nutzer (Admin / Wachenleiter)
    function isStaff() {
      return request.auth != null &&
             request.auth.token.firebase.sign_in_provider != 'anonymous';
    }

    // Jeder eingeloggte Nutzer (PIN-Nutzer anonym + Staff)
    function isAuth() {
      return request.auth != null;
    }

    // Artikel – alle dürfen lesen; PIN-Nutzer dürfen Scan-Felder updaten; nur Staff darf anlegen/löschen
    match /artikel/{id} {
      allow read: if true;
      allow create, delete: if isStaff();
      allow update: if isAuth();
    }

    // Bereiche – alle dürfen lesen, nur Staff darf schreiben
    match /bereiche/{id} {
      allow read: if true;
      allow write: if isStaff();
    }

    // Config (PIN) – alle dürfen lesen, nur Staff schreibt
    match /config/{id} {
      allow read: if true;
      allow write: if isStaff();
    }

    // Drafts – nur eingeloggte Nutzer (auch anonymous/PIN)
    match /bestellungen_draft/{id} {
      allow read, write: if isAuth();
    }

    // Multi-User Sessions – nur eingeloggte Nutzer
    match /bestellungen_session/{id} {
      allow read, write: if isAuth();
    }

    // Abgeschlossene Bestellungen – PIN-Nutzer darf anlegen, nur Staff liest/ändert/löscht
    match /bestellungen/{id} {
      allow create: if isAuth();
      allow read, update, delete: if isStaff();
    }

    // Benutzer-Rollen – nur Staff
    match /users/{id} {
      allow read, write: if isStaff();
    }
  }
}
```

---

## Firestore Datenstruktur

```
/artikel/{id}
  name, lp, location, bereich
  min, minEinheit, max, maxEinheit
  aliases[], hinweis
  fotoUrl, lagerFotoUrl
  gtin, gtins[]
  chargen: [{ lot, verfall, gtin, erfasst }]

/bereiche/{id}
  name, reihenfolge, aktiv

/config/app
  pin, wacheName, updatedAt

/bestellungen/{id}
  mitarbeiter, mitarbeiterListe[]
  datum, bestellungen{}, nachbestellungen[]
  unterschrift (base64), status, sessionId

/bestellungen_draft/{id}
  mitarbeiter, datum, status
  currentIdx, bestellungen{}, fortschritt

/bestellungen_session/{id}
  startzeit, status, teilnehmer[]
  vergebeneBereiche{}, erledigteBereiche[]
  bestellungen{}

/users/{uid}
  name, email, role, createdAt
```

---

## Scanner – Unterstützte Formate

### GS1 DataMatrix / GS1-128

| AI | Bedeutung |
|---|---|
| `(01)` | GTIN – 14 Zeichen |
| `(17)` | Verfallsdatum – YYMMDD |
| `(10)` | LOT/Charge – variabel |

```
(01)06955824005646(17)290728(10)20240815
→ GTIN: 06955824005646 · Verfall: 2029-07-28 · LOT: 20240815
```

### HIBC DataMatrix

```
+EORONB4509F6010/$$10282521960E
→ Verfall: Oktober 2028 · LOT: 2521960
```

Format: `+[LIC][PCN]/$$[MMYY][LOT][Check]`

### Bluetooth-Scanner (Netum NT-1228BL)
1. Scanner einschalten → per Bluetooth koppeln (BT HID Mode)
2. Verfallsscan öffnen → grüner Punkt = bereit
3. Scanner auf Code halten → automatisch verarbeitet

---

## PWA – Automatisches Cache-Update

Bei jedem GitHub-Upload `CACHE_VERSION` in `sw.js` erhöhen:

```javascript
const CACHE_VERSION = 'v8'; // → v9, v10 ...
```

Alle Geräte laden beim nächsten Öffnen automatisch die neue Version.

**App installieren:**
- **iPhone:** Safari → Teilen → „Zum Home-Bildschirm"
- **Android:** Chrome → Menü → „Zum Startbildschirm hinzufügen"

---

## Setup & Installation

1. **Repository klonen**
```bash
git clone https://github.com/osxbobo/Lagerbestellung.git
```

2. **Firebase Projekt anlegen**
   - Firestore + Authentication aktivieren
   - Sign-in Methoden: **E-Mail/Passwort** und **Anonymous** aktivieren
   - `firebaseConfig` ist bereits in `js/firebase-config.js` zentralisiert

3. **Daten importieren** – `firebase-import-tool-v2.html` lokal öffnen

4. **Ersten Admin anlegen** – Firebase Console → Auth → Nutzer, dann `rollen-import.html`

5. **GitHub Pages aktivieren** – Settings → Pages → Branch: `main`

6. **Domain autorisieren** – Firebase Console → Auth → Autorisierte Domains → `[username].github.io`

7. **Firestore Rules** (siehe oben) einfügen und veröffentlichen

---

## Sicherheit

| Bereich | Schutz |
|---|---|
| Lagersuche | Öffentlich (nur Lesen) |
| Lagerbestellung | 4-stelliger PIN + Firebase Anonymous Auth |
| Verfallsscan | 4-stelliger PIN + Firebase Anonymous Auth |
| Portal / Admin | Firebase Auth (E-Mail/Passwort) |
| Rollen | Firestore `users` Collection + `isStaff()` Rule |
| PIN-Schutz | Sperre nach 5 Fehlversuchen (60 Sekunden) |
| XSS | Alle Firestore-Daten werden über `textContent` / `createElement` ausgegeben |
| Multi-User Sync | Schreibkonflikte verhindert durch Firestore-Transaktionen |

**Empfehlungen:**
- PIN nach Go-Live vom Standard `1234` ändern
- Budget-Alert in Firebase auf 5€/Monat setzen
- Cloudinary Preset nach Go-Live auf „Signed" umstellen

---

## Roadmap

- 🔲 KI-Texterkennung für Chargen (Anthropic Vision API)
- 🔲 Verbrauchsstatistik – meistbestellte Artikel
- 🔲 Automatische wöchentliche Verfallserinnerung
- 🔲 Bilder löschen / ersetzen in Fotos & Bilder
- 🔲 Excel-Export der Bestellhistorie
- 🔲 Mehrwachen-Unterstützung

---

## Abkürzungen

| Kürzel | Bedeutung |
|---|---|
| LP | Lagerplatznummer |
| VE | Verpackungseinheit |
| GS1 | Global Standards 1 |
| HIBC | Health Industry Bar Code |
| GTIN | Global Trade Item Number |
| LOT | Chargennummer |

---

**Erstellt von:** Benjamin Trost

*Stand: Mai 2026 · LAGER//APP v2.1.0*
