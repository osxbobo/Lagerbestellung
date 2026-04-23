# 📦 Lagerbestellung Web-App – Projektplanung v4

### Digitale Lagerkontrolle für den Rettungsdienst

> 📎 **Siehe auch:** `mockup.html` – Interaktives UI-Mockup aller Screens

-----

## 📋 Projektübersicht

Moderne, mobile-freundliche Web-App zur digitalen Durchführung der wöchentlichen Lagerbestellung auf der Rettungswache. Ersetzt das bisherige Klemmbrett-System durch einen geführten digitalen Workflow – inklusive Lagersuche, Unterschrift, PDF-Generierung, Charge/Verfall-Tracking und Wachenleiter-Portal.

-----

## 🖼️ App-Screens (Übersicht)

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  01 STARTSEITE  │  │   02 PIN-LOGIN  │  │  03 LAGERCHECK  │
│                 │  │                 │  │                 │
│  🔍 Artikelsuche│  │  ● ● ● ○        │  │  ████░░░░ 42%   │
│  ─────────────  │  │                 │  │                 │
│  📦 Schrank 2   │  │  [1][2][3]      │  │  Tubus Gr.8     │
│  Regal 3 Fach 1 │  │  [4][5][6]      │  │  Soll: 5-10 [8] │
│                 │  │  [7][8][9]      │  │                 │
│  [Lagercheck]   │  │  [←][0][✓]     │  │  [← Zurück]     │
│  [Login]        │  │  Name eingeben  │  │  [Weiter →]     │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 04 UNTERSCHRIFT │  │ 05 WACHENLEITER │  │   06 ADMIN      │
│                 │  │                 │  │                 │
│  48/48 ✅       │  │  ⚠️ 3 Warnungen │  │  📦 Artikel     │
│  3 nachbestellen│  │  ───────────── │  │  📸 Fotos       │
│                 │  │  🔴 Adrenalin   │  │  🔍 Scanner     │
│  ~~Unterschrift~│  │     3 Tage!    │  │  🏠 Bereiche    │
│  ─────────────  │  │  🟡 NaCl 18 T. │  │  👥 Accounts    │
│                 │  │  ───────────── │  │  🔑 PIN         │
│  [PDF senden]   │  │  [↓ PDF] ...   │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

-----

## 👥 Rollen & Berechtigungen

|Funktion                    |Mitarbeiter|Wachenleiter|Admin|
|----------------------------|-----------|------------|-----|
|PIN-Login                   |✅          |—           |—    |
|E-Mail + Passwort Login     |—          |✅           |✅    |
|Lagersuche (Startseite)     |✅          |✅           |✅    |
|Lagercheck durchführen      |✅          |✅           |✅    |
|Unterschreiben              |✅          |✅           |✅    |
|Barcode scannen             |✅          |✅           |✅    |
|Foto + KI auslesen          |✅          |✅           |✅    |
|Charge & Verfall speichern  |✅          |✅           |✅    |
|Bestellungen & PDFs einsehen|❌          |✅           |✅    |
|Verfalls-Dashboard          |❌          |✅           |✅    |
|Verfall-Warnungen per Mail  |❌          |✅           |✅    |
|Artikelverwaltung           |❌          |❌           |✅    |
|Fotos hochladen             |❌          |❌           |✅    |
|Bereiche verwalten          |❌          |❌           |✅    |
|PIN ändern                  |❌          |❌           |✅    |
|Accounts verwalten          |❌          |❌           |✅    |

-----

## 🔄 App-Ablauf

### Screen 1 – Startseite

- **Lagersuche** immer sichtbar, kein Login nötig
- Artikel eingeben → Standort wird angezeigt (Schrank / Regal / Fach)
- Produktfoto wird direkt neben dem Suchergebnis angezeigt
- Buttons: „Lagercheck starten” und „Wachenleiter / Admin Login”
- **Datenbank:** Firebase Firestore (migriert aus bestehendem Google Sheets)

### Screen 2 – PIN & Name

- 4-stelliger PIN (vom Admin änderbar)
- Name des Mitarbeiters eingeben → Start

### Screen 3 – Bestandscheck

- Geführt durch alle Bereiche: Schränke 1–5, Sauerstofflager, Küche, Hygieneraum, etc.
- Pro Artikel: Soll-Menge sichtbar, Ist-Menge eintragen
- **ℹ️ Info-Icon** → Referenzfoto des Soll-Zustands
- **Fortschrittsbalken** oben
- **Vor/Zurück-Navigation**

### Screen 4 – Unterschrift & Abschluss

- Zusammenfassung: Mitarbeiter, Datum, geprüfte Artikel, Nachbestellungen
- Touch-/Maus-Unterschrift
- PDF automatisch generiert → ins Wachenleiter-Portal + Mail-Benachrichtigung

### Screen 5 – Wachenleiter-Portal

- Verfalls-Dashboard mit Ampel-System (🔴 / 🟡 / 🟢)
- Chronologische Bestellhistorie mit PDF-Download
- Automatische Warnmails bei kritischen Verfallsdaten

### Screen 6 – Admin-Bereich

- Vollständige Verwaltung aller Inhalte der App
- Fotos hochladen, Artikel und Bereiche bearbeiten
- Accounts und PIN verwalten

-----

## 📷 Charge & Verfall-Tracking

**Für alle Rollen – Scannen & Speichern**

|Methode         |Beschreibung                                                         |
|----------------|---------------------------------------------------------------------|
|**Barcode-Scan**|GS1-Datamatrix-Code scannen → Charge + Verfall automatisch ausgelesen|
|**Foto + KI**   |Foto vom Produkt → Anthropic Vision API liest Text aus (Fallback)    |

- Nutzer bestätigt kurz → gespeichert
- Keine manuelle Eingabe nötig

**Für Wachenleiter & Admin – Automatische Warnungen**

- 🟡 Warnung **30 Tage** vor Verfall
- 🔴 Warnung **7 Tage** vor Verfall
- 📧 Automatische Mail bei kritischen Artikeln
- 📊 Dashboard mit vollständiger Verfall-Übersicht

-----

## 🔍 Lagersuche

- Direkt auf der Startseite, ohne Login
- Suchfeld → Artikel eingeben → Standort + Foto wird angezeigt
- Gleiche Datenbank wie der Rest der App (Firebase Firestore)
- Bestehende Google Sheets Datenbank wird einmalig migriert
- Danach nur noch über Admin-Bereich gepflegt

-----

## 🎨 Design

- **Look:** Clean, modern, professionell
- **Farbschema:** Dunkel (Anthrazit/Navy) mit Orange + Cyan als Akzente
- **Schrift:** Groß, klar, gut lesbar – daumenfreundlich
- **Buttons:** Groß (auch mit Handschuhen bedienbar)
- **Responsive:** Handy · Tablet · PC

-----

## ⚙️ Technik-Stack

|Bereich                  |Lösung                                 |
|-------------------------|---------------------------------------|
|**Frontend**             |HTML / CSS / JavaScript                |
|**Hosting**              |GitHub Pages (kostenlos)               |
|**Datenbank**            |Firebase Firestore                     |
|**Authentifizierung**    |Firebase Authentication (Custom Claims)|
|**Datei-Speicher**       |Firebase Storage (PDFs & Fotos)        |
|**Mail-Benachrichtigung**|Firebase Cloud Functions               |
|**PDF-Generierung**      |jsPDF (client-seitig)                  |
|**Barcode-Scanner**      |ZXing.js                               |
|**KI-Texterkennung**     |Anthropic Vision API                   |

### Architektur

```
GitHub Pages (Frontend)
        │
        ├── Firebase Authentication  →  Rollen: Mitarbeiter / Wachenleiter / Admin
        ├── Firebase Firestore       →  Artikel, Lagerstruktur, Chargen, Bestellungen, PIN
        ├── Firebase Storage         →  PDFs, Referenzfotos
        ├── Firebase Cloud Functions →  Mails (neue Bestellung / Verfall-Warnung)
        └── Anthropic Vision API     →  KI-Erkennung Charge & Verfall aus Foto
```

-----

## ✅ Was noch fehlt / vorzubereiten ist

- [ ] Artikelliste bereitstellen (Foto, Excel oder PDF)
- [ ] Lager-Datenbank (Google Sheets Export) für Migration
- [ ] Referenzfotos der Schränke/Einheiten im Soll-Zustand aufnehmen
- [ ] E-Mail-Adresse des Wachenleiters
- [ ] GitHub-Account
- [ ] Firebase-Projekt anlegen → firebase.google.com (kostenlos)
- [ ] Anthropic API Key (für KI-Texterkennung)

-----

## 🚀 Nächste Schritte

1. Artikelliste + Lager-Datenbank bereitstellen
1. Firebase-Projekt & GitHub Repository anlegen
1. App entwickeln & testen
1. Daten aus Google Sheets migrieren
1. Referenzfotos aufnehmen & hochladen

-----

*Erstellt: 2026 | Projekt: Digitale Lagerbestellung – Rettungswache | Version 4.0*
