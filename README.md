# 📦 Lagerbestellung Web-App – Projektplanung v2

### Digitale Lagerkontrolle für den Rettungsdienst

-----

## 📋 Projektübersicht

Ziel ist eine moderne, mobile-freundliche Web-App zur digitalen Durchführung der wöchentlichen Lagerbestellung auf der Rettungswache. Sie ersetzt das bisherige Klemmbrett-System durch einen geführten digitalen Workflow – inklusive Unterschrift, PDF-Generierung, Wachenleiter-Portal und Admin-Bereich.

-----

## 👥 Rollen & Berechtigungen

|Rolle           |Zugang                 |Berechtigungen                                                                                                  |
|----------------|-----------------------|----------------------------------------------------------------------------------------------------------------|
|**Mitarbeiter** |4-stelliger PIN        |Lagercheck durchführen, unterschreiben                                                                          |
|**Wachenleiter**|E-Mail + Passwort Login|Bestellungen einsehen, PDFs herunterladen                                                                       |
|**Admin**       |E-Mail + Passwort Login|Alles des Wachenleiters + Artikelverwaltung, Fotos hochladen, Bereiche verwalten, PIN ändern, Accounts verwalten|

-----

## 🔄 App-Ablauf

### 1. PIN-Eingabe

- 4-stelliger PIN als Zugungsschutz
- PIN ist vom Admin jederzeit änderbar

### 2. Namenseingabe

- Mitarbeiter gibt seinen Namen ein
- Bestätigung per „Start”-Button

### 3. Bestandscheck (Bereich für Bereich)

- Geführt durch alle Bereiche: Schränke 1–5, Sauerstofflager, Küche, Hygieneraum, etc.
- Pro Artikel: Soll-Menge sichtbar, Ist-Menge eintragen
- **ℹ️ Info-Icon** pro Einheit → zeigt Foto des Soll-Zustands
- **Fortschrittsbalken** oben (z. B. „Bereich 3 von 9 – 33 %”)
- **Vor/Zurück-Navigation** zwischen den Bereichen

### 4. Unterschrift

- Touch-/Maus-Unterschrift am Ende des Checks

### 5. Abschluss

- PDF wird automatisch generiert (vollständige ausgefüllte Liste)
- PDF wird im **Wachenleiter-Portal** bereitgestellt
- **E-Mail-Benachrichtigung** an den Wachenleiter („Neue Lagerbestellung eingegangen”)

-----

## 🖥️ Wachenleiter-Portal

- Login per E-Mail + Passwort (Firebase Authentication)
- Chronologische Übersicht aller abgeschlossenen Bestellungen
- PDF-Download direkt aus dem Portal
- Sofort sichtbar: Wer hat unterschrieben und wann

-----

## 🔧 Admin-Bereich

- Login per E-Mail + Passwort (Firebase Authentication)
- **Artikelverwaltung:** Artikel hinzufügen, bearbeiten, löschen
- **Soll-Mengen:** Jederzeit anpassbar
- **Fotos:** Referenzfotos pro Artikel hochladen (Firebase Storage)
- **Bereiche:** Schränke und Bereiche umbenennen, hinzufügen oder entfernen
- **PIN:** Mitarbeiter-PIN jederzeit ändern
- **Accounts:** Wachenleiter-Accounts anlegen und verwalten

-----

## 🎨 Design

- **Look:** Clean, modern, professionell
- **Farbschema:** Dunkles Blau/Anthrazit als Basis, Akzentfarbe (z. B. Orange oder Cyan)
- **Schrift:** Groß, klar, gut lesbar
- **Buttons:** Groß und daumenfreundlich (auch mit Handschuhen bedienbar)
- **Responsive:** Optimiert für Handy (Hochformat), Tablet und PC

-----

## ⚙️ Technik

|Bereich                  |Lösung                                            |
|-------------------------|--------------------------------------------------|
|**Frontend**             |HTML / CSS / JavaScript                           |
|**Hosting**              |GitHub Pages (kostenlos)                          |
|**Datenbank**            |Firebase Firestore                                |
|**Authentifizierung**    |Firebase Authentication (Rollen via Custom Claims)|
|**Datei-Speicher**       |Firebase Storage (PDFs & Fotos)                   |
|**Mail-Benachrichtigung**|Firebase Cloud Functions                          |
|**PDF-Generierung**      |Client-seitig (z. B. jsPDF)                       |

### Architektur-Übersicht

```
GitHub Pages (Frontend)
        │
        ▼
Firebase Authentication  →  Rollenverwaltung (Mitarbeiter / Wachenleiter / Admin)
        │
Firebase Firestore       →  Artikelliste, Bestellungen, PIN, Bereiche
        │
Firebase Storage         →  PDFs, Referenzfotos
        │
Firebase Cloud Functions →  Mail-Benachrichtigung bei neuer Bestellung
```

-----

## 📸 Foto-Feature

- Jeder Artikel/Bereich kann ein Referenzfoto hinterlegt bekommen
- Zeigt den **Soll-Zustand** der Einheit
- Fotos werden vom Admin direkt in der App hochgeladen
- Besonders hilfreich für neue Kollegen

-----

## ✅ Was noch fehlt / vorzubereiten ist

- [ ] Artikelliste bereitstellen (Foto, Excel oder PDF)
- [ ] Fotos der Schränke/Einheiten im Soll-Zustand aufnehmen
- [ ] E-Mail-Adresse des Wachenleiters
- [ ] GitHub-Account (für Hosting)
- [ ] Firebase-Projekt anlegen (kostenlos unter firebase.google.com)

-----

## 🚀 Nächste Schritte

1. Artikelliste bereitstellen → App-Struktur wird daraus aufgebaut
1. Firebase-Projekt anlegen
1. GitHub Repository erstellen
1. App entwickeln & testen
1. Fotos aufnehmen & im Admin-Bereich hochladen

-----

*Erstellt: 2026 | Projekt: Digitale Lagerbestellung – Rettungswache | Version 2.0*
