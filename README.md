# 📦 Lagerbestellung Web-App – Projektplanung

### Digitale Lagerkontrolle für den Rettungsdienst

-----

## 📋 Projektübersicht

Ziel ist eine moderne, mobile-freundliche Web-App zur digitalen Durchführung der wöchentlichen Lagerbestellung auf der Rettungswache. Sie ersetzt das bisherige Klemmbrett-System durch einen geführten digitalen Workflow – inklusive Unterschrift, PDF-Generierung und Wachenleiter-Portal.

-----

## 🔄 App-Ablauf

### 1. PIN-Eingabe

- 4-stelliger statischer PIN als Zugungsschutz
- Verhindert unbefugten Zugriff

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
- Optionale **E-Mail-Benachrichtigung** an den Wachenleiter („Neue Lagerbestellung eingegangen”)

-----

## 🖥️ Wachenleiter-Portal

- Separater Login für den Wachenleiter
- Chronologische Übersicht aller abgeschlossenen Bestellungen
- PDF-Download direkt aus dem Portal
- Sofort sichtbar: Wer hat unterschrieben und wann

-----

## 🎨 Design

- **Look:** Clean, modern, professionell
- **Farbschema:** Dunkles Blau/Anthrazit als Basis, Akzentfarbe (z. B. Orange oder Cyan)
- **Schrift:** Groß, klar, gut lesbar
- **Buttons:** Groß und daumenfreundlich (auch mit Handschuhen bedienbar)
- **Responsive:** Optimiert für Handy (Hochformat), Tablet und PC

-----

## ⚙️ Technik

|Bereich            |Lösung                                                          |
|-------------------|----------------------------------------------------------------|
|Frontend           |HTML / CSS / JavaScript (Web-App, kein App-Store nötig)         |
|PDF-Generierung    |Client-seitig oder serverseitig                                 |
|Mail-Versand       |Externer Dienst (z. B. EmailJS – kostenlos, kein eigener Server)|
|Wachenleiter-Portal|Kleines Backend mit Datenbank (Cloud-Dienst)                    |
|Hosting            |Kostenloser Cloud-Dienst (z. B. Render, Railway o. ä.)          |

-----

## 📸 Foto-Feature

- Jeder Artikel/Bereich kann ein Referenzfoto hinterlegt bekommen
- Zeigt den **Soll-Zustand** der Einheit
- Besonders hilfreich für neue Kollegen
- Fotos müssen noch aufgenommen und hinterlegt werden

-----

## ✅ Was noch fehlt / vorzubereiten ist

- [ ] Artikelliste (als Foto, Excel oder PDF)
- [ ] Fotos der Schränke/Einheiten im Soll-Zustand
- [ ] E-Mail-Adresse des Wachenleiters
- [ ] EmailJS-Account erstellen (kostenlos, ca. 5 Minuten)

-----

## 🚀 Nächste Schritte

1. Artikelliste bereitstellen → App-Struktur wird daraus aufgebaut
1. Fotos machen → werden als Referenzbilder hinterlegt
1. EmailJS einrichten → für Mail-Benachrichtigungen
1. App bauen & testen

-----

*Erstellt: 2026 | Projekt: Digitale Lagerbestellung – Rettungswache*
