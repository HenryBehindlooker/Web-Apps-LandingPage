/*
 * Holt League-of-Legends-Patchnotes und Esport-Ergebnisse und schreibt sie als
 *   <out>/feed.js    (wird von der Seite geladen)
 *   <out>/feed.json  (dieselben Daten, Rückfallebene und Vergleich für den nächsten Lauf)
 *   <out>/feed.xml   (RSS zum Abonnieren)
 *   <out>/feed-img/  (Team-Logos, lokal gespeichert → keine Fremd-Requests beim Besucher)
 *
 * Läuft in GitHub Actions:  node scripts/update-feed.mjs _site
 *
 * Umgebungsvariablen (alle optional):
 *   SITE_URL             öffentliche Adresse der Seite (RSS-Links, Rückfall auf letzte Daten,
 *                        Erkennen neuer Einträge für Discord)
 *   DISCORD_WEBHOOK_URL  wenn gesetzt: neue Patchnotes & Ergebnisse in Discord posten
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import { fetchLeaguepedia } from "./leaguepedia.mjs";

const OUT = process.argv[2] || ".";
const SITE_URL = (process.env.SITE_URL || "").replace(/\/?$/, "/");
const HAS_SITE = SITE_URL !== "/";
const DISCORD = process.env.DISCORD_WEBHOOK_URL || "";
const LOCALE = "de-de"; // Sprache der Patchnotes-Seite
const HL = "de-DE";     // Sprache der Esport-Daten
const DEFAULT_LEAGUES = ["worlds", "msi", "lec"];

const RIOT = "https://www.leagueoflegends.com";
const ESPORTS_API = "https://esports-api.lolesports.com/persisted/gw";
// Öffentlicher Schlüssel, den lolesports.com selbst im Browser verwendet.
const ESPORTS_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8x3zDJ5";
const UA = "Mozilla/5.0 (compatible; webapps-landing-feed/1.0)";

async function get(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, ...headers },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  return res;
}

/* ------------------------------------------------------------------ */
/*  Einstellungen aus apps.js lesen                                    */
/* ------------------------------------------------------------------ */

export async function readConfig() {
  try {
    const code = await readFile(new URL("../apps.js", import.meta.url), "utf8");
    const ctx = { window: {} };
    vm.runInNewContext(code, ctx, { timeout: 1000 });
    return { site: ctx.window.SITE || {}, news: ctx.window.NEWS || {}, github: ctx.window.GITHUB || {} };
  } catch (e) {
    console.warn("apps.js nicht lesbar, nutze Standardwerte:", e.message);
    return { site: {}, news: {}, github: {} };
  }
}

/* ------------------------------------------------------------------ */
/*  Bilder: herunterladen, verkleinern, mitveröffentlichen             */
/* ------------------------------------------------------------------ */

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn("Hinweis: sharp nicht installiert – Bilder werden unverkleinert übernommen.");
}

const IMAGE_SIZES = {
  logo: { width: 64, height: 64, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } },
  thumb: { width: 192, height: 108, fit: "cover" },
  appicon: { width: 128, height: 128, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } },
};

const imageCache = new Map();
export async function localImage(url, kind = "logo") {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  const key = kind + " " + url;
  if (imageCache.has(key)) return imageCache.get(key);
  const task = (async () => {
    try {
      const res = await get(url);
      const type = res.headers.get("content-type") || "";
      let buf = Buffer.from(await res.arrayBuffer());
      let ext = /svg/.test(type) ? ".svg" : /webp/.test(type) ? ".webp" : /jpe?g/.test(type) ? ".jpg" : ".png";
      if (sharp) {
        try {
          buf = await sharp(buf).resize(IMAGE_SIZES[kind]).webp({ quality: 82 }).toBuffer();
          ext = ".webp";
        } catch (e) {
          console.warn("Bild nicht verkleinert:", url, e.message);
        }
      }
      const name = createHash("sha1").update(key).digest("hex").slice(0, 16) + ext;
      await mkdir(path.join(OUT, "feed-img"), { recursive: true });
      await writeFile(path.join(OUT, "feed-img", name), buf);
      return `feed-img/${name}`;
    } catch (e) {
      console.warn("Bild nicht geladen:", url, e.message);
      return null;
    }
  })();
  imageCache.set(key, task);
  return task;
}

/* ------------------------------------------------------------------ */
/*  Patchnotes                                                         */
/* ------------------------------------------------------------------ */

const isLolPatchUrl = (u) =>
  /\/news\/game-updates\/[^"?#]*patch[^"?#]*notes/i.test(u) && !/teamfight|tft/i.test(u);

function titleFromSlug(u) {
  const m = u.match(/patch-([a-z0-9-]+?)-notes/i);
  if (!m) return "Patchnotes";
  return "Patch " + m[1].split("-").map((p) => p.toUpperCase()).join(".");
}

const decodeHtml = (s) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function fetchPatchNotes() {
  const listUrl = `${RIOT}/${LOCALE}/news/tags/patch-notes/`;
  const html = await (await get(listUrl)).text();
  const items = new Map(); // URL → Eintrag, Reihenfolge = Reihenfolge auf der Seite

  const add = (rawUrl, title, date, image) => {
    if (typeof rawUrl !== "string") return;
    let url;
    try { url = new URL(decodeHtml(rawUrl), RIOT); } catch { return; }
    url.search = ""; url.hash = "";
    const href = url.href;
    if (!isLolPatchUrl(href)) return;
    const prev = items.get(href) || {};
    const t = typeof title === "string" && title.trim() ? title.trim() : null;
    const d = typeof date === "string" && !isNaN(Date.parse(date)) ? new Date(date).toISOString() : null;
    const img = typeof image === "string" && /^https?:\/\//.test(image) ? image : null;
    items.set(href, { url: href, title: prev.title || t, date: prev.date || d, image: prev.image || img });
  };

  // 1) Strukturierte Daten der Next.js-Seite (enthält Titel und Datum)
  const nd = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nd) {
    try {
      (function walk(o) {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) return o.forEach(walk);
        const link = o.action?.payload?.url ?? o.link?.url ?? o.url ?? o.href;
        if (typeof link === "string" && isLolPatchUrl(new URL(link, RIOT).href)) {
          add(link, o.title ?? o.headline, o.publishedAt ?? o.publishDate ?? o.date, pickImage(o));
        }
        Object.values(o).forEach(walk);
      })(JSON.parse(nd[1]));
    } catch (e) {
      console.warn("Patchnotes: __NEXT_DATA__ nicht lesbar:", e.message);
    }
  }

  // 2) Rückfall: alle Links im HTML
  for (const m of html.matchAll(/href="([^"]+)"/g)) add(m[1]);

  const list = [...items.values()].map((it, i) => ({ ...it, title: it.title || titleFromSlug(it.url), _i: i }));
  list.sort((a, b) => (a.date && b.date ? b.date.localeCompare(a.date) : a._i - b._i));
  if (!list.length) throw new Error("Keine Patchnotes auf der Seite gefunden");

  const top = list.slice(0, 6);
  // Vorschaubilder: aus der Übersicht, sonst aus dem og:image des Artikels
  await Promise.all(top.map(async (it) => {
    if (!it.image) it.image = await articleImage(it.url);
    it.thumb = await localImage(it.image, "thumb");
  }));

  return {
    url: listUrl,
    items: top.map(({ _i, image, ...it }) => it),
  };
}

function pickImage(o) {
  const c = [o.media?.url, o.media?.sources?.[0]?.url, o.image?.url, o.thumbnail?.url, o.imageUrl,
    typeof o.image === "string" ? o.image : null, typeof o.media === "string" ? o.media : null];
  return c.find((u) => typeof u === "string" && /^https?:\/\//.test(u)) || null;
}

async function articleImage(url) {
  try {
    const html = await (await get(url)).text();
    const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) ||
              html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/);
    return m ? decodeHtml(m[1]) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Esports (Worlds, MSI, LEC, …)                                      */
/* ------------------------------------------------------------------ */

async function esports(endpoint, params = {}) {
  const u = new URL(`${ESPORTS_API}/${endpoint}`);
  u.searchParams.set("hl", HL);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return (await get(u, { "x-api-key": ESPORTS_KEY })).json();
}


async function fetchLeague(league) {
  const first = await esports("getSchedule", { leagueId: league.id });
  let events = first.data.schedule.events || [];
  const older = first.data.schedule.pages?.older;
  if (older && events.filter((e) => e.state === "completed").length < 10) {
    const prev = await esports("getSchedule", { leagueId: league.id, pageToken: older });
    events = [...(prev.data.schedule.events || []), ...events];
  }
  events = events.filter((e) => e.type === "match" && e.match?.teams?.length === 2);

  const base = {
    slug: league.slug,
    name: league.name,
    logo: await localImage(league.image, "logo"),
    url: `https://lolesports.com/${HL}/leagues/${league.slug}`,
  };
  if (!events.length) return { ...base, title: league.name, live: [], results: [], upcoming: [] };

  // Nur die jüngste Saison anzeigen
  const year = Math.max(...events.map((e) => new Date(e.startTime).getUTCFullYear()));
  events = events.filter((e) => new Date(e.startTime).getUTCFullYear() === year);

  const toMatch = async (e) => ({
    id: e.match.id,
    start: e.startTime,
    state: e.state,
    stage: e.blockName || null,
    bestOf: e.match.strategy?.count ?? null,
    teams: await Promise.all(
      e.match.teams.map(async (t) => ({
        name: t.name,
        code: t.code,
        logo: await localImage(t.image, "logo"),
        wins: t.result?.gameWins ?? null,
        winner: t.result?.outcome === "win",
      })),
    ),
  });

  const byTime = (a, b) => a.startTime.localeCompare(b.startTime);
  const completed = events.filter((e) => e.state === "completed").sort(byTime).reverse().slice(0, 8);
  const live = events.filter((e) => e.state === "inProgress").sort(byTime);
  const upcoming = events.filter((e) => e.state === "unstarted").sort(byTime).slice(0, 4);

  return {
    ...base,
    title: `${league.name} ${year}`,
    live: await Promise.all(live.map(toMatch)),
    results: await Promise.all(completed.map(toMatch)),
    upcoming: await Promise.all(upcoming.map(toMatch)),
  };
}

export async function fetchEsports(slugs) {
  const all = (await esports("getLeagues")).data.leagues || [];
  const leagues = [];
  for (const slug of slugs) {
    const league = all.find((l) => l.slug === slug);
    if (!league) {
      console.warn(`  ! Liga "${slug}" gibt es nicht. Verfügbar: ${all.map((l) => l.slug).join(", ")}`);
      continue;
    }
    try {
      leagues.push(await fetchLeague(league));
      console.log(`  ✓ ${slug}`);
    } catch (e) {
      console.warn(`  ✗ ${slug}: ${e.message}`);
      leagues.push({ slug, name: league.name, error: true });
    }
  }
  if (!leagues.length) throw new Error("Keine der eingestellten Ligen gefunden");
  return { leagues };
}

/* ------------------------------------------------------------------ */
/*  RSS                                                                */
/* ------------------------------------------------------------------ */

const xml = (s) => String(s ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
const label = (t) => t.code || t.name || "TBD";

export function buildRss(feed) {
  const items = [];
  for (const p of feed.patches?.items || []) {
    items.push({ title: p.title, link: p.url, guid: p.url, date: p.date, cat: "Patchnotes" });
  }
  for (const lg of feed.esports?.leagues || []) {
    for (const m of lg.results || []) {
      const [a, b] = m.teams;
      items.push({
        title: `${label(a)} ${a.wins ?? "?"}–${b.wins ?? "?"} ${label(b)} · ${lg.title}${m.stage ? " · " + m.stage : ""}`,
        link: lg.url,
        guid: `lolesports-match-${m.id}`,
        date: m.start,
        cat: lg.title,
      });
    }
  }
  items.sort((x, y) => (y.date || "").localeCompare(x.date || ""));

  const body = items
    .map((i) => `    <item>
      <title>${xml(i.title)}</title>
      <link>${xml(i.link)}</link>
      <guid isPermaLink="${/^https?:/.test(i.guid)}">${xml(i.guid)}</guid>
      <category>${xml(i.cat)}</category>${i.date ? `\n      <pubDate>${new Date(i.date).toUTCString()}</pubDate>` : ""}
    </item>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>League of Legends – Patchnotes &amp; Esports</title>
    <link>${xml(HAS_SITE ? SITE_URL : "https://www.leagueoflegends.com/")}</link>
    <description>Neue Patchnotes und Esport-Ergebnisse</description>
    <language>de</language>
    <lastBuildDate>${new Date(feed.updated).toUTCString()}</lastBuildDate>
${body}
  </channel>
</rss>
`;
}

/* ------------------------------------------------------------------ */
/*  Discord                                                            */
/* ------------------------------------------------------------------ */

/** Was ist seit dem letzten veröffentlichten Stand neu? Ohne Vorgänger: nichts (kein Spam beim ersten Lauf). */
export function findNews(feed, prev) {
  const out = [];
  const pp = prev?.patches;
  if (pp?.items && !pp.error && feed.patches?.items && !feed.patches.stale) {
    const known = new Set(pp.items.map((i) => i.url));
    feed.patches.items.filter((p) => !known.has(p.url)).reverse().forEach((p) => out.push({ kind: "patch", patch: p }));
  }
  for (const lg of feed.esports?.leagues || []) {
    if (lg.error || lg.stale) continue;
    const old = prev?.esports?.leagues?.find((l) => l.slug === lg.slug && !l.error && l.results);
    if (!old) continue;
    const known = new Set(old.results.map((m) => m.id));
    (lg.results || []).filter((m) => !known.has(m.id)).reverse().forEach((m) => out.push({ kind: "match", league: lg, match: m }));
  }
  return out;
}

export function discordPayload(news) {
  const embeds = news.slice(-10).map((n) => {
    if (n.kind === "patch") {
      return {
        title: n.patch.title,
        url: n.patch.url,
        description: "Neue Patchnotes sind da.",
        color: 0x6366f1,
        ...(n.patch.date ? { timestamp: n.patch.date } : {}),
      };
    }
    const [a, b] = n.match.teams;
    return {
      title: `${label(a)} vs ${label(b)}`,
      url: n.league.url,
      description: `${n.league.title}${n.match.stage ? " · " + n.match.stage : ""}\nErgebnis: ||${a.wins ?? "?"} : ${b.wins ?? "?"}||`,
      color: 0x10b981,
      timestamp: n.match.start,
    };
  });
  return { username: "LoL-Feed", embeds };
}

async function notifyDiscord(news) {
  if (!DISCORD) return;
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(DISCORD)) {
    console.warn("DISCORD_WEBHOOK_URL sieht nicht wie ein Discord-Webhook aus – übersprungen.");
    return;
  }
  if (!news.length) { console.log("Discord: nichts Neues."); return; }
  const res = await fetch(DISCORD, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(discordPayload(news)),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Discord antwortet mit HTTP ${res.status}`);
  console.log(`Discord: ${Math.min(news.length, 10)} Meldung(en) gesendet.`);
}

/* ------------------------------------------------------------------ */
/*  Ablauf                                                             */
/* ------------------------------------------------------------------ */

async function previousFeed() {
  if (!HAS_SITE) return null;
  try {
    // Zeitstempel umgeht den CDN-Cache von GitHub Pages
    return await (await get(`${SITE_URL}feed.json?t=${Date.now()}`)).json();
  } catch {
    return null;
  }
}

export async function main() {
  const { news: cfg } = await readConfig();
  const slugs = Array.isArray(cfg.leagues) && cfg.leagues.length ? cfg.leagues : DEFAULT_LEAGUES;
  const prev = await previousFeed();
  const feed = { updated: new Date().toISOString() };

  try {
    feed.patches = await fetchPatchNotes();
    console.log("✓ Patchnotes");
  } catch (e) {
    console.warn(`✗ Patchnotes: ${e.message}`);
    feed.patches = prev?.patches?.items && !prev.patches.error ? { ...prev.patches, stale: true } : { error: true };
  }

  console.log("Esports:");
  try {
    feed.esports = await fetchEsports(slugs);
  } catch (e) {
    console.warn(`  lolesports.com nicht verfügbar (${e.message}) – nutze Leaguepedia.`);
    try {
      feed.esports = await fetchLeaguepedia(slugs, localImage);
    } catch (e2) {
      console.warn(`✗ Esports: ${e2.message}`);
      feed.esports = { leagues: slugs.map((slug) => ({ slug, name: slug.toUpperCase(), error: true })) };
    }
  }
  // Fehlgeschlagene Ligen mit dem letzten veröffentlichten Stand füllen
  feed.esports.leagues = feed.esports.leagues.map((lg) => {
    if (!lg.error) return lg;
    const old = prev?.esports?.leagues?.find((l) => l.slug === lg.slug && !l.error);
    return old ? { ...old, stale: true } : lg;
  });

  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "feed.json"), JSON.stringify(feed));
  await writeFile(path.join(OUT, "feed.js"), `window.FEED = ${JSON.stringify(feed, null, 1)};\n`);
  await writeFile(path.join(OUT, "feed.xml"), buildRss(feed));
  console.log(`Feed geschrieben nach ${OUT}/`);

  try {
    await notifyDiscord(findNews(feed, prev));
  } catch (e) {
    console.warn("Discord:", e.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); });
}
