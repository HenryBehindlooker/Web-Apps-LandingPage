/*
 * Esport-Ergebnisse aus Leaguepedia (lol.fandom.com) – das LoL-Wiki bietet mit der
 * Cargo-Schnittstelle offenen Zugriff auf Spielpläne und Ergebnisse.
 * Inhalte stehen unter CC BY-SA 3.0; die Seite nennt Leaguepedia deshalb als Quelle.
 *
 * Wird von update-feed.mjs genutzt, wenn lolesports.com nicht antwortet.
 */

const API = "https://lol.fandom.com/api.php";
const WIKI = "https://lol.fandom.com/wiki/";
const repo = process.env.GITHUB_REPOSITORY ? ` (+https://github.com/${process.env.GITHUB_REPOSITORY})` : "";
const UA = `webapps-landing-feed/1.0${repo}`;

/** Kürzel aus apps.js → Liga-Name in Leaguepedia (SQL-LIKE-Muster) */
export const LEAGUES = {
  worlds: { name: "Worlds", like: "%World Championship%" },
  msi: { name: "MSI", like: "%Mid-Season Invitational%" },
  first_stand: { name: "First Stand", like: "%First Stand%" },
  lec: { name: "LEC", like: "%EMEA Championship%" },
  lck: { name: "LCK", like: "%Champions Korea%" },
  lpl: { name: "LPL", like: "%Pro League%" },
  lta_north: { name: "LTA Nord", like: "%Americas North%" },
  lta_south: { name: "LTA Süd", like: "%Americas South%" },
  prime_league: { name: "Prime League", like: "%Prime League%" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const sqlDate = (d) => d.toISOString().slice(0, 19).replace("T", " ");
const parseDate = (s) => (s ? new Date(s.replace(" ", "T") + "Z") : null);

async function cargo(params) {
  const u = new URL(API);
  const all = { action: "cargoquery", format: "json", limit: "100", ...params };
  for (const [k, v] of Object.entries(all)) u.searchParams.set(k, v);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(u, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} von Leaguepedia`);
    const data = await res.json();
    if (data.error) {
      // Leaguepedia bremst zu schnelle Abfragen – kurz warten und erneut versuchen
      if (/ratelimit/i.test(data.error.code || "") && attempt < 2) { await sleep(5000 * (attempt + 1)); continue; }
      throw new Error(`Leaguepedia: ${data.error.info || data.error.code}`);
    }
    return (data.cargoquery || []).map((row) => row.title);
  }
  throw new Error("Leaguepedia: zu viele Anfragen");
}

async function fetchMatches(def) {
  const now = Date.now();
  return cargo({
    tables: "MatchSchedule=MS,Tournaments=T",
    join_on: "MS.OverviewPage=T.OverviewPage",
    fields: [
      "MS.Team1=Team1", "MS.Team2=Team2", "MS.Team1Score=Score1", "MS.Team2Score=Score2",
      "MS.Winner=Winner", "MS.DateTime_UTC=Date", "MS.BestOf=BestOf", "MS.Round=Round",
      "MS.Tab=Tab", "MS.MatchId=MatchId", "MS.OverviewPage=Page", "T.Name=Tournament",
    ].join(","),
    where: `T.League LIKE ${q(def.like)} AND MS.DateTime_UTC >= ${q(sqlDate(new Date(now - 300 * 864e5)))} AND MS.DateTime_UTC <= ${q(sqlDate(new Date(now + 60 * 864e5)))}`,
    order_by: "MS.DateTime_UTC DESC",
  });
}

async function fetchTeams(names) {
  const out = new Map();
  const list = [...names].filter((n) => n && n !== "TBD");
  for (let i = 0; i < list.length; i += 40) {
    const chunk = list.slice(i, i + 40);
    const rows = await cargo({ tables: "Teams", fields: "Name,Short,Image", where: `Name IN (${chunk.map(q).join(",")})` });
    for (const r of rows) out.set(r.Name, r);
    await sleep(800);
  }
  return out;
}

const ROUNDS = {
  "Finals": "Finale", "Final": "Finale", "Semifinals": "Halbfinale", "Quarterfinals": "Viertelfinale",
  "Swiss Stage": "Swiss-Phase", "Group Stage": "Gruppenphase", "Play-In": "Play-In", "Playoffs": "Playoffs",
  "Knockout Stage": "K.-o.-Phase", "Regular Season": "Reguläre Saison", "Tiebreakers": "Tiebreaker",
  "Lower Bracket Final": "Lower-Bracket-Finale", "Upper Bracket Final": "Upper-Bracket-Finale",
};
const stageName = (r) => {
  const s = r.Round || r.Tab || null;
  return s ? ROUNDS[s] || s.replace(/^Round (\d+)$/, "Runde $1").replace(/^Day (\d+)$/, "Tag $1").replace(/^Week (\d+)$/, "Woche $1") : null;
};

function shortCode(name) {
  if (!name) return "TBD";
  if (name.length <= 5) return name;
  const caps = name.replace(/[^A-Z0-9]/g, "");
  return caps.length >= 2 ? caps.slice(0, 4) : name.slice(0, 3).toUpperCase();
}

/**
 * @param slugs     Liga-Kürzel aus apps.js
 * @param saveImage (url, kind) → lokaler Pfad, z. B. localImage aus update-feed.mjs
 */
export async function fetchLeaguepedia(slugs, saveImage) {
  const now = Date.now();
  const raw = [];
  for (const slug of slugs) {
    const def = LEAGUES[slug];
    if (!def) {
      console.warn(`  ! Liga "${slug}" kennt die Leaguepedia-Anbindung nicht. Bekannt: ${Object.keys(LEAGUES).join(", ")}`);
      continue;
    }
    try {
      raw.push({ slug, def, rows: await fetchMatches(def) });
      console.log(`  ✓ ${slug} (Leaguepedia)`);
    } catch (e) {
      console.warn(`  ✗ ${slug} (Leaguepedia): ${e.message}`);
      raw.push({ slug, def, error: true });
    }
    await sleep(800);
  }
  if (!raw.length) throw new Error("Keine der eingestellten Ligen bekannt");

  // Team-Kürzel und Logos in einem Rutsch holen
  const names = new Set();
  raw.forEach((l) => (l.rows || []).forEach((r) => { names.add(r.Team1); names.add(r.Team2); }));
  let teams = new Map();
  try { teams = await fetchTeams(names); } catch (e) { console.warn("  Teams nicht geladen:", e.message); }

  const teamInfo = async (name, score, won) => {
    const t = teams.get(name);
    const logoUrl = t?.Image ? WIKI + "Special:FilePath/" + encodeURIComponent(t.Image.replace(/ /g, "_")) : null;
    const s = score === "" || score == null ? null : Number(score);
    return {
      name: name || "TBD",
      code: t?.Short || shortCode(name),
      logo: logoUrl ? await saveImage(logoUrl, "logo") : null,
      wins: Number.isFinite(s) ? s : null,
      winner: won,
    };
  };

  const leagues = [];
  for (const l of raw) {
    const base = { slug: l.slug, name: l.def.name, source: "Leaguepedia" };
    if (l.error) { leagues.push({ ...base, error: true }); continue; }

    let rows = l.rows.filter((r) => r.Date && r.Team1 && r.Team2);
    if (!rows.length) { leagues.push({ ...base, title: l.def.name, url: WIKI, live: [], results: [], upcoming: [] }); continue; }

    // Nur die jüngste Saison (Jahr des neuesten bereits begonnenen bzw. nächsten Spiels)
    const started = rows.filter((r) => parseDate(r.Date) <= now);
    const ref = started[0] || rows[rows.length - 1];
    const year = parseDate(ref.Date).getUTCFullYear();
    rows = rows.filter((r) => parseDate(r.Date).getUTCFullYear() === year);

    const toMatch = async (r, state) => ({
      id: r.MatchId || `${r.Page}|${r.Date}|${r.Team1}|${r.Team2}`,
      start: parseDate(r.Date).toISOString(),
      state,
      stage: stageName(r),
      bestOf: Number(r.BestOf) || null,
      teams: [await teamInfo(r.Team1, r.Score1, r.Winner === "1"), await teamInfo(r.Team2, r.Score2, r.Winner === "2")],
    });

    const done = rows.filter((r) => r.Winner === "1" || r.Winner === "2");
    const open = rows.filter((r) => !(r.Winner === "1" || r.Winner === "2"));
    const live = open.filter((r) => { const t = parseDate(r.Date); return t <= now && now - t < 6 * 36e5; });
    const upcoming = open.filter((r) => parseDate(r.Date) > now).reverse().slice(0, 4);

    leagues.push({
      ...base,
      title: `${l.def.name} ${year}`,
      url: WIKI + encodeURI(ref.Page.replace(/ /g, "_")),
      live: await Promise.all(live.map((r) => toMatch(r, "inProgress"))),
      results: await Promise.all(done.slice(0, 8).map((r) => toMatch(r, "completed"))),
      upcoming: await Promise.all(upcoming.map((r) => toMatch(r, "unstarted"))),
    });
  }
  return { leagues, source: "Leaguepedia" };
}
