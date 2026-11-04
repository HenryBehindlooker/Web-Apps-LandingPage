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
  // GitHub-Topics erscheinen so: "game" → "Game", "league-of-legends" → "League of legends"
  "Game": "🎮",
  "Games": "🎮",
  "Tool": "🛠️",
  "Tools": "🛠️",
  "Productivity": "✅",
  "League of legends": "⚔️",
  "Calculator": "🧮",
  "Weather": "🌦️",
  "Quiz": "❓",
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

/*
 *  GITHUB → deine öffentlichen GitHub-Pages-Seiten erscheinen automatisch als Apps.
 *    show:         false schaltet das aus
 *    user:         GitHub-Konto; leer = Besitzer dieses Repositorys
 *    exclude:      Repositories, die nicht erscheinen sollen, z. B. ["test-seite"]
 *    includeForks: true = auch geforkte Repositories zeigen
 *    newDays:      Repositories, die jünger sind, bekommen das Label „Neu“
 *  Name = Repository-Name, Beschreibung = Repository-Beschreibung („About“ auf GitHub),
 *  Kategorien = Topics des Repositorys, Icon = Favicon der jeweiligen Seite.
 *  Willst du eine Seite anders darstellen, trag sie unten bei APPS mit derselben URL ein –
 *  dein Eintrag gewinnt.
 */
window.GITHUB = {
  show: true,
  user: "",
  exclude: [],
  includeForks: false,
  newDays: 30,
};

/*
 *  APPS → zusätzliche Apps von Hand (z. B. Seiten, die nicht auf GitHub liegen).
 *  Vorlage zum Kopieren:
 *
 *  {
 *    name: "Mein Rechner",
 *    url: "https://example.com",
 *    description: "Ein schneller Rechner für den Alltag.",
 *    icon: "icons/rechner.svg",
 *    tags: ["Werkzeug"],
 *    badge: "Neu",
 *    color: "#6366f1",
 *  },
 */
window.APPS = [
  {
    name: "Rift Forge",
    url: "https://henrybehindlooker.github.io/rift-forge/",
    // Icon und Beschreibung holt die GitHub Action automatisch von der Seite.
    // Eigene Angaben hier haben Vorrang, z. B.: description: "…", icon: "icons/rift-forge.png",
    tags: ["League of legends"],
  },
];
