# 🚑 LAGER//APP
### Digitale Lagerverwaltung & Bestandskontrolle

---

![Version](https://img.shields.io/badge/Version-2.0.0-f97316)
![Status](https://img.shields.io/badge/Status-Live-22c55e)
![Platform](https://img.shields.io/badge/Platform-GitHub%20Pages-0ea5e9)
![Firebase](https://img.shields.io/badge/Backend-Firebase%20Blaze-f97316)
![PWA](https://img.shields.io/badge/PWA-Ready-22c55e)

---

## 📋 Inhaltsverzeichnis

- [Übersicht](#übersicht)
- [Live-Demo](#live-demo)
- [Drei Kernfunktionen](#drei-kernfunktionen)
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

## Drei Kernfunktionen

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
- Auto-Login: Name + PIN werden gespeichert, kein erneutes Einloggen nötig
- PIN-Eingabe direkt auf der Startseite als Modal
- Geführt durch alle 13 Bereiche mit Fortschrittsbalken
- Pro Artikel: MIN/MAX, Produktfoto, Lagerort-Foto, Ja/Nein Auswahl
- Bei Ja: Schnell-Chips `[1][2][3][5][10]` + Plus/Minus
- Touch-Unterschrift am Ende
- Push-Benachrichtigung an Wachenleiter nach Abschluss

**⭐ Multi-User Lagerbestellung:**
- Mehrere Kollegen können gleichzeitig verschiedene Bereiche bearbeiten
- Bereiche auswählen und aufteilen (z.B. Schrank 1-3 / Schrank 4-6 / Büro)
- Laufende Session sichtbar für alle die einsteigen wollen
- Alleine starten – andere können jederzeit mitmachen und Bereiche übernehmen
- PDF zeigt alle beteiligten Namen: `Benni · Timo · Florian`

**⭐ Auto-Save / Pause-Funktion:**
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
- Fehlende Daten (LOT/Verfall) manuell ergänzbar
- Vibration als Scan-Feedback + Taschenlampe

**⭐ Dual-Scanner (Kamera):**
- ZXing.js → für DataMatrix & QR
- QuaGGA2 → für Code-128 & GS1-128 (lineare Barcodes)
- Beide laufen parallel – wer zuerst erkennt gewinnt

**⭐ Bluetooth-Scanner Support:**
- Handscanner (z.B. Netum NT-1228BL) per Bluetooth koppeln
- Funktioniert als Tastatur-Eingabe (HID Mode)
- Status-Anzeige: grau = inaktiv, grün = bereit
- Automatisch aktiv beim Seitenaufruf
- Gleiche GS1/HIBC Logik wie Kamera-Scanner

---

### 🖥️ Wachenleiter-Portal (Login)

Gleicher Sidebar-Style wie Admin. Vollzugang außer Benutzerverwaltung.

| Tab | Inhalt |
|---|---|
| 📊 Dashboard | KPIs, letzte Lagerchecks, Verfallswarnungen |
| 📋 Bestellungen | Komplette Historie, Detail-Modal, PDF, Löschen |
| 🗄️ Chargen & Verfall | Fach für Fach sortiert, Ampelsystem, löschen |
| 📦 Artikelverwaltung | Bearbeiten, neu anlegen, löschen, suchen |
| 🏠 Bereiche | Verwalten, Reihenfolge, neu anlegen |
| 📸 Fotos & Bilder | Produkt- + Lagerort-Fotos via Cloudinary |
| 🔑 PIN ändern | 4-stelligen PIN per Tastenfeld ändern |

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
| **Authentifizierung** | Firebase Authentication |
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
│
├── css/
│   ├── main.css            # Globale Styles + Theme System
│   └── index.css           # Startseiten-Styles
│
├── js/
│   ├── firebase-config.js  # Firebase Konfiguration
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

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /artikel/{id} {
      allow read: if true;
      allow create, delete: if request.auth != null;
      allow update: if true;
    }

    match /bereiche/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /config/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /bestellungen/{id} {
      allow read:           if request.auth != null;
      allow create:         if true;
      allow update, delete: if request.auth != null;
    }

    match /bestellungen_draft/{id} {
      allow read, write: if true;
    }

    match /bestellungen_session/{id} {
      allow read, write: if true;
    }

    match /users/{id} {
      allow read, write: if request.auth != null;
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

2. **Firebase Projekt anlegen** – Firestore + Auth aktivieren, `firebaseConfig` eintragen

3. **Daten importieren** – `firebase-import-tool-v2.html` lokal öffnen

4. **Ersten Admin anlegen** – Firebase Console → Auth → Nutzer, dann `rollen-import.html`

5. **GitHub Pages aktivieren** – Settings → Pages → Branch: `main`

6. **Domain autorisieren** – Firebase Console → Auth → Autorisierte Domains → `[username].github.io`

7. **Firestore Rules** einfügen und veröffentlichen

---

## Sicherheit

| Bereich | Schutz |
|---|---|
| Lagersuche | Öffentlich (nur Lesen) |
| Lagerbestellung | 4-stelliger PIN (localStorage) |
| Verfallsscan | PIN (localStorage) |
| Portal / Admin | Firebase Auth |
| Rollen | Firestore `users` Collection |

**Empfehlungen:**
- PIN nach Go-Live vom Standard `1234` ändern
- Budget-Alert in Firebase auf 5€/Monat setzen
- Cloudinary Preset nach Go-Live auf „Signed" umstellen

---

## Roadmap

- 🔲 KI-Texterkennung für Chargen (Anthropic Vision API)
- 🔲 Verbrauchsstatistik – meistbestellte Artikel
- 🔲 Automatische wöchentliche Verfallserinnerung
- 🔲 Bilder löschen / ersetzen
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

*Stand: Mai 2026 · LAGER//APP v2.0.0*
