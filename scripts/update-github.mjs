/*
 * Sucht alle öffentlichen Repositories des GitHub-Kontos, die eine GitHub-Pages-Seite haben,
 * und schreibt sie als App-Karten nach
 *   <out>/github-apps.js    (wird von der Seite geladen)
 *   <out>/github-apps.json  (Rückfallebene für den nächsten Lauf)
 * Icons (apple-touch-icon / favicon der jeweiligen Seite) landen verkleinert in <out>/feed-img/.
 *
 * Läuft in GitHub Actions:  node scripts/update-github.mjs _site
 *
 * Umgebungsvariablen:
 *   GITHUB_TOKEN             (empfohlen) höheres API-Limit; in Actions automatisch vorhanden
 *   GITHUB_REPOSITORY_OWNER  Konto, falls in apps.js kein `user` steht (in Actions automatisch)
 *   GITHUB_REPOSITORY        dieses Repository – wird selbst nicht aufgelistet
 *   SITE_URL                 öffentliche Adresse dieser Seite (für die Rückfallebene)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readConfig, localImage } from "./update-feed.mjs";

const OUT = process.argv[2] || ".";
const SITE_URL = (process.env.SITE_URL || "").replace(/\/?$/, "/");
const TOKEN = process.env.GITHUB_TOKEN || "";
const SELF = ((process.env.GITHUB_REPOSITORY || "").split("/")[1] || "").toLowerCase();
const UA = "Mozilla/5.0 (compatible; webapps-landing/1.0)";
const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#0ea5e9", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#84cc16", "#f97316"];

async function get(url, headers = {}, timeout = 20000) {
  const res = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} für ${url}`), { status: res.status });
  return res;
}
const api = (p) =>
  get(`https://api.github.com/${p}`, {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
  }).then((r) => r.json());

/* ---------- Hilfsfunktionen ---------- */
const decode = (s) =>
  String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

function prettyName(repo) {
  const n = repo.replace(/\.github\.io$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  // komplett kleingeschrieben → Wörter groß beginnen („lol champ quiz“ → „Lol Champ Quiz“)
  return n === n.toLowerCase() ? n.replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : n;
}
function prettyTopic(t) {
  return t.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}
function colorFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Icon und Beschreibung direkt von der veröffentlichten Seite lesen */
export async function inspectSite(url) {
  const html = await (await get(url, {}, 12000)).text();
  const head = html.slice(0, 200000);
  const icons = [];
  let description = null;

  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a.rel || "").toLowerCase().split(/\s+/);
    if (!a.href) continue;
    let score = 0;
    if (rel.includes("apple-touch-icon") || rel.includes("apple-touch-icon-precomposed")) score = 3;
    else if (rel.includes("icon")) score = /\.svg(\?|$)/i.test(a.href) || /svg/.test(a.type || "") ? 2 : 1;
    if (!score || /\.ico(\?|$)/i.test(a.href)) continue; // .ico kann nicht verkleinert werden
    const size = parseInt((a.sizes || "").split("x")[0], 10) || 0;
    icons.push({ href: new URL(a.href, url).href, score, size });
  }
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (!description && (a.name === "description" || a.property === "og:description") && a.content) description = a.content;
  }
  icons.sort((x, y) => y.score - x.score || y.size - x.size);
  return { icon: icons[0]?.href || null, description };
}

/* ---------- Repositories ---------- */
export async function fetchGithubApps(cfg) {
  const user = cfg.user || process.env.GITHUB_REPOSITORY_OWNER;
  if (!user) throw new Error("Kein GitHub-Konto bekannt (apps.js → GITHUB.user)");
  const exclude = new Set((cfg.exclude || []).map((x) => String(x).toLowerCase()));
  const newDays = cfg.newDays ?? 30;

  let repos = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api(`users/${encodeURIComponent(user)}/repos?type=owner&sort=pushed&per_page=100&page=${page}`);
    repos = repos.concat(batch);
    if (batch.length < 100) break;
  }

  repos = repos.filter((r) =>
    r.has_pages && !r.private && !r.archived && (cfg.includeForks || !r.fork) &&
    r.name.toLowerCase() !== SELF && !exclude.has(r.name.toLowerCase()));
  console.log(`GitHub: ${repos.length} öffentliche Seite(n) bei ${user} gefunden.`);

  const apps = [];
  for (const r of repos) {
    // Adresse: Pages-API (kennt eigene Domains) → Homepage-Feld → Standardadresse
    let url = null;
    try { url = (await api(`repos/${r.full_name}/pages`)).html_url; } catch { /* nicht schlimm */ }
    if (!url && /^https?:\/\//i.test(r.homepage || "")) url = r.homepage;
    if (!url) {
      const host = `${r.owner.login.toLowerCase()}.github.io`;
      url = r.name.toLowerCase() === host ? `https://${host}/` : `https://${host}/${r.name}/`;
    }

    let site = { icon: null, description: null };
    try {
      site = await inspectSite(url);
    } catch (e) {
      if (e.status === 404) { console.warn(`  – ${r.name}: Seite nicht erreichbar (404), übersprungen`); continue; }
      console.warn(`  ! ${r.name}: Seite nicht lesbar (${e.message})`);
    }

    const created = Date.parse(r.created_at);
    const isUserSite = /\.github\.io$/i.test(r.name);
    apps.push({
      name: isUserSite ? "Startseite" : prettyName(r.name),
      url,
      description: r.description || site.description || "",
      icon: site.icon ? await localImage(site.icon, "appicon") : null,
      tags: (r.topics || []).filter((t) => !/^(github-?pages|website|webapp|web-app)$/.test(t)).slice(0, 3).map(prettyTopic),
      badge: Date.now() - created < newDays * 864e5 ? "Neu" : undefined,
      color: colorFor(r.name),
      repo: r.html_url,
      source: "github",
    });
    console.log(`  ✓ ${r.name} → ${url}`);
  }
  return apps;
}

const urlKey = (u) => String(u || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");

/** Einträge von Hand ohne Icon/Beschreibung: beides von der Seite selbst holen */
async function enrichManual(manual, found) {
  const known = new Set(found.map((a) => urlKey(a.url)));
  const extras = [];
  for (const m of manual) {
    if (!m || !/^https?:\/\//i.test(m.url || "") || known.has(urlKey(m.url))) continue;
    if (m.icon && m.description) continue;
    try {
      const site = await inspectSite(m.url);
      extras.push({
        name: m.name,
        url: m.url,
        description: site.description || "",
        icon: site.icon ? await localImage(site.icon, "appicon") : null,
        source: "site",
      });
      console.log(`  ✓ ${m.name}: Icon/Beschreibung von der Seite geholt`);
    } catch (e) {
      console.warn(`  ! ${m.name}: Seite nicht lesbar (${e.message})`);
    }
  }
  return extras;
}

async function main() {
  const { github: cfg = {}, apps: manual = [] } = await readConfig();
  let apps = [];
  if (cfg.show === false) {
    console.log("GitHub-Seiten ausgeschaltet (apps.js → GITHUB.show).");
  } else {
    try {
      apps = await fetchGithubApps(cfg);
    } catch (e) {
      console.warn(`✗ GitHub: ${e.message}`);
      if (SITE_URL !== "/") {
        try {
          apps = await (await get(`${SITE_URL}github-apps.json?t=${Date.now()}`)).json();
          console.log("  → nutze den zuletzt veröffentlichten Stand.");
        } catch { /* dann eben leer */ }
      }
    }
  }
  apps = apps.concat(await enrichManual(manual, apps));
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "github-apps.json"), JSON.stringify(apps));
  await writeFile(path.join(OUT, "github-apps.js"), `window.GITHUB_APPS = ${JSON.stringify(apps, null, 1)};\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => console.error(e));
}
