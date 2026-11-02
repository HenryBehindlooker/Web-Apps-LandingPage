/*
 * Schreibt Titel, Beschreibung und Link-Vorschau (Open Graph) aus apps.js fest in
 * <out>/index.html – damit Discord, WhatsApp, X & Co. beim Teilen eine schöne Vorschau zeigen
 * (die lesen kein JavaScript).
 *
 *   node scripts/prepare-html.mjs _site      (SITE_URL = öffentliche Adresse, z. B. https://name.github.io/repo)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readConfig } from "./update-feed.mjs";

const OUT = process.argv[2] || "_site";
const SITE_URL = (process.env.SITE_URL || "").replace(/\/?$/, "/");
const file = path.join(OUT, "index.html");

const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const setMeta = (html, key, value) =>
  html.replace(new RegExp(`(<meta (?:name|property)="${key}" content=")[^"]*(")`), `$1${attr(value)}$2`);

const { site } = await readConfig();
let html = await readFile(file, "utf8");

if (site.title) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${attr(site.title)}</title>`);
  html = setMeta(html, "og:title", site.title);
  html = setMeta(html, "og:site_name", site.title);
}
if (site.tagline) {
  html = setMeta(html, "description", site.tagline);
  html = setMeta(html, "og:description", site.tagline);
}
if (SITE_URL !== "/") {
  html = setMeta(html, "og:url", SITE_URL);
  html = setMeta(html, "og:image", SITE_URL + "og-image.png");
}

await writeFile(file, html);
console.log("index.html vorbereitet.");
