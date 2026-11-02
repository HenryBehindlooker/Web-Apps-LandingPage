/*
 * ============================================================
 *  HIER PFLEGST DU DEINE SEITE – nur diese Datei bearbeiten.
 * ============================================================
 *
 *  SITE  → Titel und Untertitel der Seite
 *  APPS  → deine Web Apps. Für eine neue App einfach einen
 *          Block { ... }, kopieren und anpassen.
 *
 *  Felder einer App:
 *    name        (Pflicht)  Name der App
 *    url         (Pflicht)  Link zur App, z. B. "https://…" oder "./meine-app/"
 *    description (optional) Ein bis zwei Sätze, was die App macht
 *    icon        (optional) Ein Emoji ("🧮") ODER ein Bild aus dem Ordner icons/,
 *                           z. B. "icons/rechner.svg" – quadratisch, mind. 128 × 128 px,
 *                           als SVG, PNG oder WebP. Ohne Icon erscheint der Anfangsbuchstabe.
 *    tags        (optional) Liste von Stichworten, erscheinen als Filter oben
 *    badge       (optional) Kleines Label, z. B. "Neu", "Beta"
 *    color       (optional) Akzentfarbe der Karte, z. B. "#22c55e"
 */

window.SITE = {
  title: "Web Apps",
  tagline: "Kleine Werkzeuge und Experimente – direkt im Browser, ohne Installation.",
};

/*
 *  TAG_ICONS → Symbole für die Kategorien (Filter oben und Stichworte auf den Karten).
 *  Links der Name des Tags (genau wie bei den Apps geschrieben), rechts ein Emoji
 *  oder ein Bild, z. B. "icons/tag-spiel.svg". Tags ohne Eintrag bekommen kein Symbol.
 */
window.TAG_ICONS = {
  "Werkzeug": "🛠️",
  "Produktivität": "✅",
  "Spiel": "🎮",
};

/*
 *  NEWS → der League-of-Legends-Bereich unter den Apps.
 *    show:        false blendet ihn komplett aus
 *    leagues:     welche Ligen als Tabs erscheinen (Kürzel von lolesports.com), z. B.
 *                 "worlds", "msi", "first_stand", "lec", "lck", "lpl", "lta_north", "lta_south"
 *                 (Steht ein Kürzel nicht zur Verfügung, listet das Actions-Log die gültigen auf.)
 *    spoilerFree: true = Ergebnisse sind anfangs verdeckt (Besucher können umschalten)
 *    links:       Buttons zu X, Discord & Co. (type: "x", "discord" oder "link")
 *  Die Daten holt die GitHub Action automatisch – stündlich.
 */
window.NEWS = {
  show: true,
  title: "League of Legends",
  leagues: ["worlds", "msi", "lec"],
  spoilerFree: false,
  links: [
    { label: "@LeagueOfLegends", url: "https://x.com/LeagueOfLegends", type: "x" },
    { label: "@lolesports", url: "https://x.com/lolesports", type: "x" },
    // { label: "Discord", url: "https://discord.gg/DEIN-EINLADUNGSLINK", type: "discord" },
  ],
};

window.APPS = [
  {
    name: "Beispiel: Rechner",
    url: "https://example.com",
    description: "Ein schneller Rechner für den Alltag. Ersetze diesen Eintrag durch deine eigene App.",
    icon: "icons/rechner.svg",
    tags: ["Werkzeug"],
    badge: "Neu",
    color: "#6366f1",
  },
  {
    name: "Beispiel: Notizen",
    url: "https://example.com",
    description: "Notizen, die lokal im Browser gespeichert werden.",
    icon: "icons/notizen.svg",
    tags: ["Produktivität"],
    color: "#f59e0b",
  },
  {
    name: "Beispiel: Spiel",
    url: "https://example.com",
    description: "Ein kleines Browserspiel für zwischendurch.",
    icon: "icons/spiel.svg",
    tags: ["Spiel"],
    badge: "Beta",
    color: "#10b981",
  },
];
