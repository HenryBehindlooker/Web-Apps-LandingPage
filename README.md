# Web Apps – Landing Page

Eine schlichte, statische Seite, auf der deine Web Apps als Karten verlinkt sind,
plus ein League-of-Legends-Bereich mit aktuellen **Patchnotes** und **Esport-Ergebnissen** (Worlds, MSI, LEC …).
Keine Abhängigkeiten, kein Framework.

## Dateien

| Datei / Ordner                  | Zweck                                                        |
|---------------------------------|--------------------------------------------------------------|
| `apps.js`                       | **Hier trägst du deine Apps ein** (plus Titel, LoL-Bereich, X/Discord-Links) |
| `index.html`                    | Seitengerüst                                                 |
| `style.css`                     | Aussehen (Hell/Dunkel automatisch)                           |
| `script.js`                     | App-Karten, Suche und Filter                                 |
| `icons/`                        | Deine App-Icons (Beispiele: `rechner.svg`, `notizen.svg`, `spiel.svg`) |
| `og-image.png`, `apple-touch-icon.png` | Vorschaubild beim Teilen, Icon für den Homescreen     |
| `news.js`                       | Anzeige des LoL-Bereichs                                     |
| `feed.js`                       | Platzhalter – wird beim Veröffentlichen durch echte Daten ersetzt |
| `scripts/update-feed.mjs`       | Holt Patchnotes & Esport-Daten, postet optional nach Discord (läuft auf GitHub) |
| `scripts/prepare-html.mjs`      | Trägt Titel & Link-Vorschau aus `apps.js` in die Seite ein   |
| `package.json`, `package-lock.json` | Bildverkleinerung (`sharp`) – nur für die GitHub Action  |
| `.github/workflows/deploy.yml`  | Baut und veröffentlicht die Seite – bei jedem Push und stündlich |

## Eine App hinzufügen

In `apps.js` einen Block kopieren und anpassen:

```js
{
  name: "Mein Tool",
  url: "https://deinname.github.io/mein-tool/",
  description: "Kurz, was es macht.",
  icon: "🛠️",          // Emoji oder Bildpfad, z. B. "icons/tool.png"
  tags: ["Werkzeug"],  // erscheinen oben als Filter
  badge: "Neu",        // optional
  color: "#0ea5e9",    // optional, Akzentfarbe der Karte
},
```

Die drei Beispiel-Einträge kannst du einfach löschen.

## Icons

**App-Icons:** Bild in den Ordner `icons/` legen und in `apps.js` angeben, z. B. `icon: "icons/mein-tool.png"`.
Am besten quadratisch, mindestens 128 × 128 Pixel, als SVG, PNG oder WebP.
Ein Emoji (`icon: "🛠️"`) geht weiterhin, ohne Icon erscheint der Anfangsbuchstabe.

**Kategorie-Icons:** In `apps.js` unter `TAG_ICONS` jedem Tag ein Emoji oder Bild zuordnen.
Sie erscheinen in den Filter-Knöpfen oben und auf den Karten. Der Name muss genau wie der Tag geschrieben sein.

```js
window.TAG_ICONS = {
  "Werkzeug": "🛠️",
  "Spiel": "icons/tag-spiel.svg",
};
```

**Liga-Logos und Patch-Vorschaubilder** holt die GitHub Action automatisch, verkleinert sie
und veröffentlicht sie mit (Ordner `feed-img/`) – da musst du nichts tun.

## Auf GitHub Pages veröffentlichen

1. Neues Repository auf GitHub anlegen
   - Heißt es `<dein-benutzername>.github.io`, liegt die Seite direkt unter `https://<dein-benutzername>.github.io/`.
   - Jeder andere Name ergibt `https://<dein-benutzername>.github.io/<repo-name>/`.
2. Alle Dateien aus diesem Ordner hochladen – **inklusive** des Ordners `.github`
   (versteckt; beim Hochladen im Browser ggf. den ganzen Ordner per Drag & Drop ziehen, oder Git benutzen).
3. Im Repository: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
4. Unter **Actions** den Workflow „Seite bauen und veröffentlichen“ öffnen und **Run workflow** klicken
   (danach läuft er automatisch bei jeder Änderung und stündlich).

## Der League-of-Legends-Bereich

- **Patchnotes** kommen von der offiziellen Seite `leagueoflegends.com/de-de/news/tags/patch-notes/`.
- **Esports** (Live, Ergebnisse, nächste Spiele mit Countdown) kommen von der Schnittstelle, die
  `lolesports.com` selbst nutzt. Sie ist nicht offiziell dokumentiert und kann sich ändern.
- **Ligen als Tabs:** in `apps.js` unter `NEWS.leagues`, z. B. `["worlds", "msi", "lec", "lck"]`.
  Ein falsches Kürzel wird übersprungen; das Actions-Log listet dann alle gültigen auf.
  Beim Öffnen wird die Liga mit einem Live-Spiel bzw. dem jüngsten Ergebnis gezeigt,
  danach merkt sich die Seite die Wahl des Besuchers.
- **Spoiler-Schutz:** Das Augen-Symbol verdeckt alle Ergebnisse; einzelne lassen sich per Klick
  aufdecken. Mit `spoilerFree: true` in `apps.js` ist er von Anfang an aktiv.
- Die Daten holt die GitHub Action stündlich. Fällt eine Quelle aus, bleiben die zuletzt
  veröffentlichten Daten stehen; gibt es keine, steht dort „Gerade nicht verfügbar“.
- Team-Logos werden mitveröffentlicht, Besucher laden also nichts von fremden Servern.
- Unter `…/feed.xml` gibt es einen **RSS-Feed** zum Abonnieren.
- **X:** Als Buttons in `apps.js` unter `NEWS.links`. Eingebettete X-Timelines
  bräuchten Tracking-Skripte von X und die kostenpflichtige API.
- Ganzen Bereich ausblenden: in `apps.js` `show: false` setzen.

### Discord-Benachrichtigungen (optional)

Neue Patchnotes und neue Ergebnisse werden automatisch in einen Kanal deines Discord-Servers gepostet
(Ergebnisse als Spoiler `||3 : 1||`).

1. In Discord: **Kanal bearbeiten → Integrationen → Webhooks → Neuer Webhook → Webhook-URL kopieren**.
2. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**,
   Name `DISCORD_WEBHOOK_URL`, Wert = die kopierte URL.

Gepostet wird nur, was seit dem letzten Lauf neu ist (beim allerersten Lauf nichts),
höchstens 10 Meldungen pro Stunde. Die Webhook-URL ist geheim – nie in eine Datei schreiben.

## Link-Vorschau

Wird der Link in Discord, WhatsApp, X usw. geteilt, erscheinen Titel und Untertitel aus `apps.js`
plus das Bild `og-image.png`. Das Bild kannst du durch ein eigenes ersetzen (1200 × 630 Pixel).
Titel und Beschreibung trägt die Action beim Veröffentlichen automatisch ein.

Hinweis: GitHub pausiert zeitgesteuerte Workflows nach 60 Tagen ohne Aktivität im Repository.
Dann einfach unter **Actions** wieder aktivieren oder eine kleine Änderung pushen.

## Lokal ansehen

`index.html` im Browser öffnen. Der LoL-Bereich zeigt lokal nur einen Hinweis, weil die Daten erst
beim Veröffentlichen geladen werden. Zum Testen mit echten Daten (Node 20+):

```bash
npm install
node scripts/update-feed.mjs .
```

Die dabei erzeugten Dateien (`feed.json`, `feed.xml`, `feed-img/`) nicht committen und `feed.js`
danach mit `git checkout feed.js` zurücksetzen.

## Datenschutz

Die Seite enthält keine persönlichen Angaben, lädt keine externen Schriften, Skripte oder Tracker.
Gespeichert wird nur deine Hell/Dunkel-Wahl im eigenen Browser.
