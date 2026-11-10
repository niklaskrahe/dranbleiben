# Dranbleiben

Persönlicher Habit Tracker als installierbare Web-App (PWA). Läuft komplett offline, Daten liegen im Browser. Optional Sync über das Supabase-Projekt vom Sportduell. Hosting über GitHub Pages.

## Was die App kann

- **Drei Arten von Gewohnheiten:** Abhaken, Zählen (z. B. Seiten, Gläser) und Fokuszeit mit eingebautem Timer.
- **Flexible Rhythmen:** täglich, bestimmte Wochentage oder x-mal pro Woche (Tage frei wählbar).
- **Serien, Stärke und Level:** Serie in Tagen bzw. Wochen. Dazu ein Stärke-Wert, der bei Lücken nur langsam sinkt. XP, Level-Titel und 25 Abzeichen.
- **Überspringen und Pausetage:** krank oder Urlaub, die Serie bleibt stehen.
- **Hinweise auf „Heute“:** „Nie zweimal verpassen“, „Serie in Gefahr“ (abends) und Erinnerung an den Wochenrückblick.
- **Wochenrückblick:** Quote, stärkste und schwächste Gewohnheit, drei Reflexionsfragen und eine Fokus-Gewohnheit für die nächste Woche.
- **Statistik:** Verlauf als Kalender-Heatmap, Stärke pro Gewohnheit, Quote nach Wochentag und welche Gewohnheiten mit guter Stimmung zusammenhängen.
- **Aufgaben (To-dos):** gelten für genau einen Tag. Was liegen bleibt, erscheint auf „Heute“ als überfällig und lässt sich mit „→ Heute“ verschieben. Geplante Aufgaben stehen unter „Demnächst“. +5 XP je Aufgabe.
- **Tagesnotiz:** Stimmung (5 Stufen) und eine kurze Notiz pro Tag.
- **Nachtragen:** vergangene Tage über die Datumsleiste oder den Monatskalender einer Gewohnheit.
- **Tageswechsel einstellbar** (Standard 3:00 Uhr): Was du nach Mitternacht abhakst, zählt noch für den Vortag.
- **Backup:** Export und Import als JSON.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Gerüst und Gestaltung |
| `core.js` | Datenmodell, Serien, Stärke, XP, Erfolge, Zusammenführen |
| `app.js` | Oberfläche, Fokus-Timer, Sync |
| `config.js` | Supabase-URL und anon-Key (gleiches Projekt wie Sportduell) |
| `supabase.js` | Supabase-Bibliothek, wird nur bei aktivem Sync geladen |
| `sw.js` | Service Worker (Offline). **Bei Änderungen `VERSION` hochzählen** |
| `manifest.webmanifest`, `icons/`, `fonts/` | App-Name, Icon, Schriften (lokal, damit offline alles gleich aussieht) |
| `supabase-setup.sql` | Tabelle und Zugriffsregeln für den Sync. Nur einmal in Supabase ausführen |

## Einrichtung

1. **GitHub:** Neues Repo anlegen, z. B. `dranbleiben`. Alle Dateien hochladen (die SQL-Datei schadet nicht, wird aber nicht gebraucht).
   *Settings → Pages → Source: Deploy from a branch → main / (root) → Save.*
   Nach ca. 1 Minute läuft die App unter `https://niklaskrahe.github.io/dranbleiben/`.
2. **Installieren:** Adresse am iPhone in Safari öffnen → *Teilen → Zum Home-Bildschirm*.
3. **Fertig.** Ohne Sync bleibt alles lokal auf dem Gerät.

### Optional: Cloud-Sync (Handy ↔ Laptop, Datensicherung)

1. In Supabase (Sportduell-Projekt) *SQL Editor → New query*: Inhalt von `supabase-setup.sql` einfügen → *Run*.
2. In der App unter *Mehr → Cloud-Sync* mit den Sportduell-Zugangsdaten anmelden.

Danach gleicht die App automatisch ab: beim Öffnen, kurz nach jeder Änderung und beim Schließen. Bei Konflikten gewinnt pro Tag und Gewohnheit der neuere Eintrag. Anlegen dürfen nur Konten, deren E-Mail in der Tabelle `players` steht. Jeder sieht nur seine eigenen Daten.

Auf einem neuen Gerät: beim Start *„Ich nutze Dranbleiben schon auf einem anderen Gerät“* aufklappen und anmelden.

### Optional: eigene Subdomain

Statt `niklaskrahe.github.io/dranbleiben` geht auch `habits.niklaskrahe.de`:
Bei Strato einen CNAME-Eintrag `habits` → `niklaskrahe.github.io` anlegen. Dann im Repo unter *Settings → Pages → Custom domain* `habits.niklaskrahe.de` eintragen und „Enforce HTTPS“ aktivieren.
Vorsicht beim Umzug: Die App-Daten hängen an der Adresse. Vorher ein Backup exportieren oder den Sync nutzen.

## Hinweis zum Sportduell (gleiche Domain)

Beide Apps laufen unter `niklaskrahe.github.io` und teilen sich deshalb den Offline-Cache. Der Service Worker vom Sportduell löscht bei jedem eigenen Update **alle** fremden Caches. Dranbleiben lädt sich danach beim nächsten Online-Start einfach neu, es gehen keine Daten verloren. Wer das vermeiden will, ändert in `sportduell/sw.js` eine Zeile:

```js
// vorher
caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
// nachher
caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("sportduell-") && k !== VERSION).map(k => caches.delete(k))))
```

## Updates

Dateien im Repo ersetzen und in `sw.js` die `VERSION` hochzählen (z. B. `dranbleiben-v2`). Die App holt sich die neue Version beim nächsten Öffnen mit Internet.
