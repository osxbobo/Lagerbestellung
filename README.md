# 🚑 LAGER//APP
### Digitale Lagerverwaltung & Bestandskontrolle
**DRK-Rettungsdienst gGmbH · Böblingen · Rettungswache Malmsheim**

---

![Version](https://img.shields.io/badge/Version-1.0.0-f97316)
![Status](https://img.shields.io/badge/Status-Live-22c55e)
![Platform](https://img.shields.io/badge/Platform-GitHub%20Pages-0ea5e9)
![Firebase](https://img.shields.io/badge/Backend-Firebase-f97316)
![PWA](https://img.shields.io/badge/PWA-Ready-22c55e)

---

## 📋 Inhaltsverzeichnis

- [Übersicht](#übersicht)
- [Live-Demo](#live-demo)
- [Funktionen](#funktionen)
- [Rollen & Berechtigungen](#rollen--berechtigungen)
- [Seiten & Navigation](#seiten--navigation)
- [Tech Stack](#tech-stack)
- [Projektstruktur](#projektstruktur)
- [Setup & Installation](#setup--installation)
- [Firebase Konfiguration](#firebase-konfiguration)
- [PWA & Push Notifications](#pwa--push-notifications)
- [PDF-Generierung](#pdf-generierung)
- [Foto-Upload](#foto-upload)
- [QR/Barcode Scanner](#qrbarcode-scanner)
- [Sicherheit](#sicherheit)
- [Roadmap](#roadmap)

---

## Übersicht

LAGER//APP ersetzt das bisherige Klemmbrett-System der Rettungswache Malmsheim durch eine vollständig digitale Lösung. Die App läuft direkt im Browser – ohne Installation, ohne App Store – und ist für Smartphone, Tablet und PC optimiert.

**Kernproblem das gelöst wird:**
- Wöchentliche Lagerbestellung war papierbasiert und aufwändig
- Kein Überblick über Verfallsdaten und Chargen
- Keine digitale Bestellhistorie für den Wachenleiter
- Kein schneller Zugriff auf Lagerorte von Materialien

---

## Live-Demo

```
https://osxbobo.github.io/Lagerbestellung
```

---

## Funktionen

### 🔍 Lagersuche (öffentlich)
- Echtzeit-Suche durch alle 245+ Artikel ohne Login
- Suche nach Name, Aliases (auch umgangssprachliche Begriffe) und LP-Nummer
- Ergebnis zeigt: Produktfoto, Bereich, Lagerplatznummer (LP)
- Bereiche-Übersicht als Kacheln zum Filtern
- Beispiel: Suche nach „Kotztüte" → findet SIC SAC-Brechbeutel

### 🗂 Lagercheck (PIN-geschützt)
- Zugang über 4-stelligen PIN (vom Admin änderbar)
- Namenseingabe des Mitarbeiters
- Geführt durch alle 13 Bereiche mit Fortschrittsbalken
- Pro Artikel:
  - **MIN/MAX** groß und deutlich angezeigt
  - **Produktfoto** (Soll-Zustand) per Tippen anzeigbar
  - **Lagerort-Foto** (wo liegt es im Schrank) anzeigbar
  - **„Muss bestellt werden?"** – Ja / Nein Auswahl
  - Bei Ja: Mengenauswahl per Schnell-Chips `[1][2][3][5][10]` + Plus/Minus
- Erklärungs-Banner für neue Kollegen
- Fixe Navigation unten (Zurück / Weiter)
- „Abschließen" nur auf letzter Seite sichtbar
- Touch-Unterschrift am Ende
- Automatische Speicherung in Firestore
- Push-Benachrichtigung an Wachenleiter nach Abschluss

### 📷 Charge-Scanner (PIN-geschützt, nach Check-PIN)
- Zugang über Scanner-Banner im Lagercheck (nach PIN)
- Kamera scannt automatisch GS1-DataMatrix, QR-Code und Barcodes
- Erkennt automatisch: GTIN, Charge/LOT, Verfallsdatum
- **Bekannte Produkte** → sofort Charge + Verfall speichern
- **Unbekannte Produkte** → einmalig Artikel zuordnen → danach automatisch erkannt
- Sofort-Vorschläge beim Antippen des Suchfelds
- Sortierung: Artikel mit Chargen zuerst (nach frühestem Verfall)
- Vibration als Scan-Feedback
- Taschenlampe & Kamera wechseln
- Alle Chargen pro Artikel anzeigbar (mit Ampelsystem 🔴🟡🟢)
- Charge löschen (Wachenleiter & Admin)
- Mehrere Chargen pro Artikel möglich

### 🖥️ Wachenleiter-Portal (Login)

**Tab: Bestellungen**
- Chronologische Bestellhistorie
- Mitarbeiter, Datum, Anzahl Nachbestellungen
- PDF-Download pro Bestellung

**Tab: Alle Chargen (Ebene 3)**
- Vollständige Übersicht aller erfassten Chargen
- Filter: Alle / Kritisch (≤30 Tage) / OK
- Sortiert nach Verfallsdatum (früheste zuerst)
- Charge direkt löschen

**Tab: Artikel**
- Artikel bearbeiten (Name, MIN/MAX, Hinweis)
- Neuen Artikel anlegen
- Artikel löschen

**Verfallswarnungen (Ebene 1)**
- Nur Artikel unter 30 Tagen (filter umstellbar auf „Alle")
- Tippen auf Artikel → Ebene 2 öffnet sich
- 🔴 Abgelaufen / ≤7 Tage · 🟡 ≤30 Tage · 🟢 OK

**Tippen auf Verfalls-Artikel (Ebene 2)**
- Alle Chargen dieses Artikels mit Ampel
- LOT-Nummer, Verfallsdatum, GTIN
- Charge löschen

**KPI-Dashboard**
- Letzte Bestellung (Wer, Wann)
- Gesamtanzahl Bestellungen
- Anzahl kritischer Verfallswarnungen

### 🔧 Admin-Bereich (Login)

**Dashboard**
- Übersicht: Artikel, Bereiche, Bestellungen, Artikel ohne Foto
- Letzte 5 Lagerchecks

**Artikelverwaltung**
- Alle 245+ Artikel mit Suche und Bereichsfilter
- Artikel bearbeiten: Name, LP, Standort, Bereich, MIN/MAX, Aliases, Hinweis
- Neuen Artikel anlegen
- Artikel löschen

**Bereiche verwalten**
- Alle 13 Bereiche (Schränke, Regale, Sauerstofflager, Büro, Küche etc.)
- Bereich bearbeiten (Name, Reihenfolge)
- Neuen Bereich anlegen

**Fotos & Referenzbilder**
- Zwei Foto-Typen pro Artikel:
  - **Produktfoto** – wie sieht das Produkt aus? (Lagersuche)
  - **Lagerort-Foto** – wo liegt es im Schrank? (Lagercheck)
- Upload via Cloudinary (kein Firebase Storage nötig)
- Vorschau nach Upload
- Übersicht aller Artikel ohne Foto

**Charge-Scanner** (Link zu scanner.html)

**PIN ändern**
- Aktuellen PIN anzeigen/verstecken
- Neuen PIN per Tastenfeld eingeben
- Sofort in Firestore gespeichert

**Account-Verwaltung**
- Bestehende Nutzer mit Rolle anzeigen
- Rolle ändern (Wachenleiter ↔ Admin)
- **Neuen Benutzer direkt anlegen** – kein Firebase Console nötig
  - Name, E-Mail, temporäres Passwort, Rolle
  - Firebase Authentication REST API

### 🔐 Login
- E-Mail + Passwort via Firebase Authentication
- Automatische Weiterleitung je nach Rolle:
  - Admin → Admin-Bereich
  - Wachenleiter → Wachenleiter-Portal
- Fehlermeldungen auf Deutsch

### 📄 PDF-Generierung
- Layout identisch zum Original-Papierdokument
- Inhalte:
  - Titel-Box „Lagerbestellung Rettungswache Malmsheim"
  - Tabelle mit LP, Produkt, MIN, MAX, Hinweis, Bestellen
  - Bereiche als graue Trennzeilen
  - Zebrierung für bessere Lesbarkeit
  - Bestellen-Spalte: Menge bei bestellten Artikeln, leer bei ausreichenden
  - Abkürzungslegende (Stk, VE, P, R, K, Fl...)
  - Felder für Datum, Name, Unterschrift
  - Roter Hinweis-Rahmen
  - Seitennummer auf jeder Seite (X von Y)
- Download als PDF mit Dateiname: `Lagerbestellung_[Name]_[Datum].pdf`

### 🌙 Dark / Light Mode
- Umschaltbar per Toggle (☀️/🌙) in der Navbar
- Einstellung wird gespeichert (localStorage)
- Respektiert Systemeinstellung automatisch

### 📱 PWA (Progressive Web App)
- Installierbar als App auf Homescreen (Android & iPhone)
- Offline-Fähigkeit für alle Seiten (Service Worker)
- Update-Banner wenn neue Version verfügbar
- **iPhone:** Safari → Teilen → „Zum Home-Bildschirm"
- **Android:** Chrome zeigt „App installieren" Banner automatisch

### 🔔 Push Notifications
- Benachrichtigung nach abgeschlossenem Lagercheck
- Automatische Verfallswarnungen:
  - 🔴 Kritisch: ≤7 Tage oder abgelaufen
  - 🟡 Bald: ≤30 Tage
- Einmalig „Erlauben" tippen genügt
- Funktioniert am Desktop (Chrome, Edge, Safari/Mac) und Handy

---

## Rollen & Berechtigungen

| Funktion | Mitarbeiter | Wachenleiter | Admin |
|---|:---:|:---:|:---:|
| Lagersuche | ✅ | ✅ | ✅ |
| Lagercheck (PIN) | ✅ | ✅ | ✅ |
| Charge scannen (nach PIN) | ✅ | ✅ | ✅ |
| Charge speichern | ❌ | ✅ | ✅ |
| Charge löschen | ❌ | ✅ | ✅ |
| Wachenleiter-Portal | ❌ | ✅ | ✅ |
| PDF herunterladen | ❌ | ✅ | ✅ |
| Verfallswarnungen | ❌ | ✅ | ✅ |
| Artikel bearbeiten | ❌ | ✅ | ✅ |
| Artikel löschen | ❌ | ✅ | ✅ |
| Fotos hochladen | ❌ | ❌ | ✅ |
| Bereiche verwalten | ❌ | ❌ | ✅ |
| PIN ändern | ❌ | ❌ | ✅ |
| Benutzer anlegen | ❌ | ❌ | ✅ |
| Rollen vergeben | ❌ | ❌ | ✅ |

---

## Seiten & Navigation

```
/index.html                  → Startseite: Lagersuche + Bereiche-Übersicht
/pages/check.html            → Lagercheck (PIN-geschützt)
/pages/scanner.html          → Charge-Scanner (PIN-geschützt via Session)
/pages/login.html            → Login für Wachenleiter & Admin
/pages/portal.html           → Wachenleiter-Portal
/pages/admin.html            → Admin-Bereich
```

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| **Frontend** | HTML5 · CSS3 · Vanilla JavaScript |
| **Hosting** | GitHub Pages (kostenlos) |
| **Datenbank** | Firebase Firestore |
| **Authentifizierung** | Firebase Authentication |
| **Foto-Upload** | Cloudinary (kostenloser Plan) |
| **PDF-Generierung** | jsPDF (CDN) |
| **Barcode-Scanner** | ZXing.js (CDN) |
| **PWA** | Service Worker · Web Push API |
| **Schriften** | IBM Plex Mono · DM Sans (Google Fonts) |

---

## Projektstruktur

```
Lagerbestellung/
├── index.html                  # Startseite / Lagersuche
├── manifest.json               # PWA Manifest
├── sw.js                       # Service Worker (PWA + Push)
├── README.md                   # Diese Datei
│
├── css/
│   ├── main.css                # Globale Styles + Theme System
│   └── index.css               # Startseiten-spezifische Styles
│
├── js/
│   ├── firebase-config.js      # Firebase Konfiguration
│   ├── theme.js                # Dark/Light Mode
│   └── pwa.js                  # PWA + Push Notification Manager
│
├── icons/
│   ├── icon-192.png            # PWA Icon (klein)
│   └── icon-512.png            # PWA Icon (groß)
│
└── pages/
    ├── check.html              # Lagercheck
    ├── scanner.html            # Charge-Scanner
    ├── login.html              # Login
    ├── portal.html             # Wachenleiter-Portal
    └── admin.html              # Admin-Bereich
```

---

## Setup & Installation

### Voraussetzungen
- GitHub Account
- Firebase Account (kostenlos)
- Cloudinary Account (kostenlos, für Fotos)

### 1. Repository forken / klonen
```bash
git clone https://github.com/osxbobo/Lagerbestellung.git
```

### 2. Firebase Projekt anlegen
1. [firebase.google.com](https://firebase.google.com) → Neues Projekt
2. **Firestore Database** aktivieren
3. **Authentication** → E-Mail/Passwort aktivieren
4. **Projekteinstellungen** → Web-App hinzufügen → `firebaseConfig` kopieren

### 3. Firebase Config eintragen
In `js/firebase-config.js`:
```javascript
export const firebaseConfig = {
  apiKey:            "DEIN_API_KEY",
  authDomain:        "DEIN_PROJEKT.firebaseapp.com",
  projectId:         "DEIN_PROJEKT",
  storageBucket:     "DEIN_PROJEKT.firebasestorage.app",
  messagingSenderId: "DEINE_ID",
  appId:             "DEINE_APP_ID",
};
```

### 4. Daten importieren
Die `firebase-import-tool-v2.html` lokal im Browser öffnen:
- API Key + Project ID eingeben
- „Import starten" → alle 245 Artikel werden importiert

### 5. Ersten Admin anlegen
1. Firebase Console → Authentication → Nutzer hinzufügen
2. `rollen-import.html` lokal öffnen → UID + Rolle eintragen

### 6. GitHub Pages aktivieren
GitHub Repository → Settings → Pages → Branch: `main` → Save

### 7. Autorisierte Domain hinzufügen
Firebase Console → Authentication → Settings → Autorisierte Domains → `[username].github.io` hinzufügen

---

## Firebase Konfiguration

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Artikel & Bereiche – jeder darf lesen (Lagersuche)
    match /artikel/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /bereiche/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Config (PIN) – nur authentifiziert
    match /config/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Bestellungen – nur authentifiziert
    match /bestellungen/{id} {
      allow read, write: if request.auth != null;
    }

    // Benutzer-Rollen – nur authentifiziert
    match /users/{id} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Firestore Datenstruktur
```
/artikel/{id}
  name:        string
  lp:          string       # Lagerplatznummer
  location:    string       # Standort-Code
  bereich:     string       # Bereich-ID
  min:         number
  minEinheit:  string
  max:         number
  maxEinheit:  string
  aliases:     string[]     # Suchbegriffe
  hinweis:     string
  fotoUrl:     string       # Produktfoto (Cloudinary)
  lagerFotoUrl:string       # Lagerort-Foto (Cloudinary)
  gtin:        string       # Primäre GTIN (vom Scanner)
  gtins:       string[]     # Alle bekannten GTINs
  chargen:     [            # Erfasste Chargen
    {
      lot:     string
      verfall: string       # ISO Datum: 2029-11-30
      gtin:    string
      erfasst: string       # ISO Timestamp
    }
  ]
  aktiv:       boolean

/bereiche/{id}
  name:        string
  reihenfolge: number
  aktiv:       boolean

/config/app
  pin:              string
  wacheName:        string
  wachenleiterEmail:string
  updatedAt:        string

/bestellungen/{id}
  mitarbeiter:      string
  datum:            timestamp
  bestellungen:     object    # artikelId → {bestellen, menge}
  nachbestellungen: array     # [{id, name, location, menge, einheit}]
  unterschrift:     string    # Base64 PNG
  status:           string

/users/{uid}
  name:      string
  email:     string
  role:      string    # 'admin' | 'wachenleiter'
  createdAt: string
```

---

## PWA & Push Notifications

### App auf Homescreen installieren

**iPhone (iOS):**
1. Safari öffnen
2. `osxbobo.github.io/Lagerbestellung` aufrufen
3. Teilen-Button → „Zum Home-Bildschirm"
4. Name bestätigen → Hinzufügen

**Android:**
1. Chrome öffnen
2. URL aufrufen
3. Banner „App installieren" tippen
4. Oder: Menü → „Zum Startbildschirm hinzufügen"

### Push Notifications aktivieren
1. Im Wachenleiter-Portal anmelden
2. Button „🔔 Benachrichtigungen erlauben" tippen
3. Browser-Dialog bestätigen → fertig

### Benachrichtigungen
| Ereignis | Empfänger |
|---|---|
| Lagercheck abgeschlossen | Wer Portal offen hat |
| Artikel ≤7 Tage / abgelaufen | Beim Öffnen des Portals |
| Artikel ≤30 Tage | Beim Öffnen des Portals |

---

## PDF-Generierung

Das generierte PDF entspricht dem offiziellen DRK-Formular:

- **Spalten:** LP · Produkt · MIN · MAX · Hinweis · Bestellen
- **Bereiche** als graue Trennzeilen
- **Bestellen-Spalte:** Menge bei bestellten Artikeln, leer bei ausreichenden
- **Legende** am Ende (Stk, VE, Pack, Rolle, Kanister, Flasche)
- **Unterschrift** des Bestellers
- **Roter Hinweis:** „Nur den Bestand im Regal über den Schränken kontrollieren"
- **Footer:** Erstellt · Seite X von Y · Stand

---

## Foto-Upload

Fotos werden über **Cloudinary** gespeichert (kein Firebase Storage nötig).

### Setup
1. [cloudinary.com](https://cloudinary.com) → kostenlosen Account anlegen
2. Settings → Upload → Upload Presets → „Add Upload Preset"
3. Signing Mode: **Unsigned**
4. Asset Folder: `lagerapp`
5. Preset-Name notieren

### In Admin-Bereich
1. Admin → Fotos & Bilder
2. Artikel aus Liste wählen
3. **Produktfoto** hochladen (für Lagersuche)
4. **Lagerort-Foto** hochladen (für Lagercheck – zeigt wo es liegt)

---

## QR/Barcode Scanner

### Unterstützte Formate
- GS1-DataMatrix (Standard auf Medizinprodukten)
- QR-Code
- EAN-13
- Code 128
- Code 39

### GS1 Application Identifiers
| AI | Bedeutung |
|---|---|
| `(01)` | GTIN – Produktnummer |
| `(10)` | LOT/Charge |
| `(17)` | Verfallsdatum (YYMMDD) |

### Ablauf
1. PIN eingeben → Lagercheck-Screen
2. „📷 Charge & Verfallsdatum scannen" tippen
3. Kamera auf GS1-Code halten
4. Bekanntes Produkt → bestätigen → gespeichert
5. Unbekanntes Produkt → Artikel aus Liste wählen → GTIN wird dauerhaft verknüpft

---

## Sicherheit

### Aktuell (Test-Modus)
⚠️ **Firestore läuft im Test-Modus bis 23. Mai 2026!**
Danach müssen die Security Rules aktualisiert werden (siehe oben).

### Zugriffsschutz
- **Lagersuche:** Öffentlich (nur lesen)
- **Lagercheck:** 4-stelliger PIN
- **Scanner:** PIN-Session (sessionStorage)
- **Portal/Admin:** Firebase Authentication (E-Mail + Passwort)
- **Rollen:** Firestore `users` Collection

### Empfehlungen vor Go-Live
- [ ] Firestore Security Rules auf Produktion umstellen
- [ ] PIN vom Standard `1234` ändern
- [ ] Cloudinary Upload Preset auf „Signed" umstellen
- [ ] API Keys in GitHub Secrets auslagern (optional)

---

## Roadmap

### In Entwicklung
- 🔲 KI-Texterkennung für Chargen (Anthropic Vision API) – wartet auf Finanzierung
- 🔲 E-Mail Benachrichtigungen (EmailJS)
- 🔲 Barcode-Scanner auch im Admin-Bereich

### Geplant
- 🔲 Statistiken – welche Artikel werden am häufigsten bestellt
- 🔲 Automatische Mindestbestand-Anpassung basierend auf Verbrauch
- 🔲 Mehrwachen-Unterstützung

---

## Abkürzungen

| Kürzel | Bedeutung |
|---|---|
| LP | Lagerplatznummer |
| VE | Verpackungseinheit |
| Stk | Stück |
| P | Pack |
| R | Rolle |
| K | Kanister |
| Fl | Flasche |
| B | Bögen |
| S | Schrank |
| L | Lagerplatz |
| GS1 | Global Standards 1 (Barcode-Standard) |
| GTIN | Global Trade Item Number |
| LOT | Chargennummer |

---

## Kontakt & Support

**Erstellt von:** Benni Trost  
**Organisation:** DRK-Rettungsdienst gGmbH · Böblingen  
**Wache:** Rettungswache Malmsheim  

---

*Erstellt: April 2026 · LAGER//APP v1.0.0*
