(function () {
  "use strict";

  var NEWS = window.NEWS || {};
  var FEED = window.FEED;
  var root = document.getElementById("news");
  if (!root || NEWS.show === false) return;

  /* ---------- Hilfsfunktionen ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function httpUrl(u) { return typeof u === "string" && /^https?:\/\//i.test(u) ? u : null; }
  function localImg(u) { return typeof u === "string" && /^feed-img\/[\w.-]+$/.test(u) ? u : null; }
  /** Lokales Bild aus feed-img/ – verschwindet still, falls es fehlt. */
  function imgEl(src, cls, w, h) {
    src = localImg(src);
    if (!src) return null;
    var wrap = el("span", cls);
    wrap.setAttribute("aria-hidden", "true");
    var img = el("img");
    img.src = src; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
    img.width = w; img.height = h || w;
    img.onerror = function () { wrap.remove(); };
    wrap.appendChild(img);
    return wrap;
  }
  function extLink(href, cls, text) {
    var a = el("a", cls, text);
    a.href = httpUrl(href) || "#";
    a.target = "_blank"; a.rel = "noopener noreferrer";
    return a;
  }
  var store = {
    get: function (k) { try { return localStorage.getItem("news:" + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem("news:" + k, v); } catch (e) {} },
  };
  var ICONS = {
    x: '<path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
    discord: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 5h16v11H9l-5 4z"/><circle cx="9.5" cy="10.5" r="1.3" fill="currentColor"/><circle cx="14.5" cy="10.5" r="1.3" fill="currentColor"/>',
    link: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    rss: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14"/><circle cx="6" cy="18" r="1.6" fill="currentColor"/>',
    arrow: '<path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    eye: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>',
    eyeOff: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.9 3.8M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/>',
  };
  function icon(name) {
    var s = el("span", "ico");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16">' + (ICONS[name] || ICONS.link) + "</svg>";
    return s;
  }

  /* ---------- Datum & Zeit ---------- */
  var dateFmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" });
  var whenFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  var rtf = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
  function relDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var days = Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
    return Math.abs(days) < 7 ? rtf.format(days, "day") : dateFmt.format(d);
  }
  function relTime(iso) {
    var mins = Math.round((new Date(iso) - Date.now()) / 6e4);
    if (isNaN(mins)) return "";
    if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
    if (Math.abs(mins) < 60 * 24) return rtf.format(Math.round(mins / 60), "hour");
    return rtf.format(Math.round(mins / 1440), "day");
  }
  function countdown(iso) {
    var ms = new Date(iso) - Date.now();
    if (isNaN(ms)) return "";
    if (ms <= 0) return "beginnt jeden Moment";
    var m = Math.floor(ms / 6e4), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d >= 1) return "in " + d + (d === 1 ? " Tag " : " Tagen ") + (h % 24) + " Std.";
    if (h >= 1) return "in " + h + " Std. " + (m % 60) + " Min.";
    return "in " + Math.max(1, m) + " Min.";
  }
  function startLabel(t) {
    var soon = new Date(t.dateTime) - Date.now() < 864e5;
    t.textContent = soon ? countdown(t.dateTime) : whenFmt.format(new Date(t.dateTime));
    t.title = whenFmt.format(new Date(t.dateTime)) + " Uhr";
    t.classList.toggle("is-soon", soon);
  }
  setInterval(function () {
    Array.prototype.forEach.call(root.querySelectorAll("time.start"), startLabel);
  }, 30000);

  /* ---------- Bausteine ---------- */
  function panel(title) {
    var p = el("article", "panel");
    var h = el("header", "panel-head");
    var h3 = el("h3", null, title);
    var tools = el("div", "panel-tools");
    h.appendChild(h3); h.appendChild(tools);
    p.appendChild(h);
    return { el: p, title: h3, tools: tools };
  }
  function panelLink(href, text) {
    var a = extLink(href, "panel-link", text);
    a.appendChild(icon("arrow"));
    return a;
  }
  function note(parent, text, link) {
    var n = el("p", "panel-note", text + " ");
    if (link) n.appendChild(extLink(link, null, "Zur Quelle"));
    parent.appendChild(n);
  }

  /* ---------- Kopf ---------- */
  var head = el("div", "news-head");
  var h2 = el("h2", null, NEWS.title || "League of Legends");
  h2.id = "news-title";
  head.appendChild(h2);
  var links = el("div", "news-links");
  (NEWS.links || []).forEach(function (l) {
    if (!l || !httpUrl(l.url)) return;
    var a = extLink(l.url, "news-link", null);
    a.appendChild(icon(l.type));
    a.appendChild(el("span", null, l.label || l.url));
    links.appendChild(a);
  });
  head.appendChild(links);
  root.appendChild(head);

  var grid = el("div", "news-grid");
  root.appendChild(grid);

  /* ---------- Noch keine Daten (z. B. lokal geöffnet) ---------- */
  if (!FEED) {
    var p0 = panel("Patchnotes & Esports");
    note(p0.el, "Die Daten werden beim Veröffentlichen über GitHub Actions geladen und erscheinen dann hier.");
    grid.appendChild(p0.el);
    root.hidden = false;
    return;
  }

  /* ================================================================ */
  /*  Patchnotes                                                       */
  /* ================================================================ */
  var P = FEED.patches || { error: true };
  var pp = panel("Patchnotes");
  pp.tools.appendChild(panelLink(P.url || "https://www.leagueoflegends.com/de-de/news/tags/patch-notes/", "Alle"));
  if (P.error || !P.items || !P.items.length) {
    note(pp.el, "Gerade nicht verfügbar.", "https://www.leagueoflegends.com/de-de/news/tags/patch-notes/");
  } else {
    var ol = el("ol", "patch-list");
    var anyThumb = P.items.some(function (it) { return localImg(it.thumb); });
    P.items.forEach(function (it, i) {
      var li = el("li");
      var a = extLink(it.url, "patch-item", null);
      var thumb = imgEl(it.thumb, "patch-thumb", 96, 54);
      if (thumb) a.appendChild(thumb);
      else if (anyThumb) a.appendChild(el("span", "patch-thumb is-empty"));
      var name = el("span", "patch-name", it.title);
      if (i === 0) name.appendChild(el("span", "pill", "Aktuell"));
      a.appendChild(name);
      if (it.date) {
        var t = el("time", "patch-date", relDate(it.date));
        t.dateTime = it.date;
        a.appendChild(t);
      }
      li.appendChild(a);
      ol.appendChild(li);
    });
    pp.el.appendChild(ol);
    if (P.stale) note(pp.el, "Stand ist eventuell nicht ganz aktuell.");
  }
  grid.appendChild(pp.el);

  /* ================================================================ */
  /*  Esports                                                          */
  /* ================================================================ */
  var leagues = (FEED.esports && FEED.esports.leagues) || [];
  // Ältere Feeds kannten nur Worlds
  if (!leagues.length && FEED.worlds) leagues = [Object.assign({ slug: "worlds", name: "Worlds" }, FEED.worlds)];

  var ep = panel("Esports");
  ep.el.classList.add("panel-esports");
  grid.appendChild(ep.el);

  // Spoiler-Schutz
  var storedSpoiler = store.get("spoilerFree");
  var spoilerFree = storedSpoiler != null ? storedSpoiler === "1" : NEWS.spoilerFree === true;
  var revealed = {};
  var spoilerBtn = el("button", "icon-btn");
  spoilerBtn.type = "button";
  function paintSpoilerBtn() {
    spoilerBtn.textContent = "";
    spoilerBtn.appendChild(icon(spoilerFree ? "eyeOff" : "eye"));
    spoilerBtn.setAttribute("aria-pressed", String(spoilerFree));
    var label = spoilerFree ? "Ergebnisse anzeigen" : "Ergebnisse verbergen (Spoiler-Schutz)";
    spoilerBtn.setAttribute("aria-label", label);
    spoilerBtn.title = label;
  }
  spoilerBtn.addEventListener("click", function () {
    spoilerFree = !spoilerFree;
    revealed = {};
    store.set("spoilerFree", spoilerFree ? "1" : "0");
    paintSpoilerBtn();
    render();
  });
  paintSpoilerBtn();

  var leagueLink = panelLink("https://lolesports.com/", "lolesports");
  ep.tools.appendChild(spoilerBtn);
  ep.tools.appendChild(leagueLink);

  var tabs = el("div", "tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Liga wählen");
  var body = el("div", "esports-body");
  body.setAttribute("role", "tabpanel");
  body.id = "esports-body";
  ep.el.appendChild(tabs);
  ep.el.appendChild(body);

  // Start-Tab: gespeicherte Wahl → Liga mit Live-Spiel → Liga mit jüngstem Ergebnis
  function latest(lg) { return (lg.results && lg.results[0] && lg.results[0].start) || ""; }
  var current = null;
  var saved = store.get("league");
  leagues.forEach(function (lg) { if (!current && lg.slug === saved) current = lg; });
  leagues.forEach(function (lg) { if (!current && lg.live && lg.live.length) current = lg; });
  if (!current) {
    current = leagues.slice().sort(function (a, b) { return latest(b).localeCompare(latest(a)); })[0] || null;
  }

  var tabButtons = leagues.map(function (lg, i) {
    var b = el("button", "tab");
    var logo = imgEl(lg.logo, "league-logo", 18);
    if (logo) b.appendChild(logo);
    b.appendChild(el("span", null, lg.name || lg.slug));
    b.type = "button";
    b.id = "tab-" + i;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", "esports-body");
    if (lg.live && lg.live.length) {
      var dot = el("span", "tab-live");
      dot.title = "Live";
      b.appendChild(dot);
    }
    b.addEventListener("click", function () { select(lg, false); });
    b.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var n = (i + d + leagues.length) % leagues.length;
      select(leagues[n], true);
    });
    tabs.appendChild(b);
    return b;
  });
  if (leagues.length < 2) tabs.hidden = true;

  function select(lg, focus) {
    current = lg;
    store.set("league", lg.slug);
    render();
    if (focus) tabButtons[leagues.indexOf(lg)].focus();
  }

  /* ---------- Spielzeile ---------- */
  function teamEl(t, side, showWinner) {
    var d = el("div", "team team-" + side + (showWinner && t.winner ? " is-winner" : ""));
    d.title = t.name || "";
    var logo = el("span", "team-logo");
    var src = localImg(t.logo);
    if (src) {
      var img = el("img");
      img.src = src; img.alt = ""; img.loading = "lazy"; img.width = 28; img.height = 28;
      img.onerror = function () { logo.textContent = (t.code || "?").slice(0, 1); img.remove(); };
      logo.appendChild(img);
    } else {
      logo.textContent = (t.code || "?").slice(0, 1);
    }
    d.appendChild(logo);
    d.appendChild(el("span", "team-code", t.code || t.name || "TBD"));
    return d;
  }

  function matchRow(m, mode) {
    var li = el("li", "match match-" + mode);
    var a = m.teams[0], b = m.teams[1];
    var hidden = spoilerFree && mode !== "upcoming" && !revealed[m.id];
    var mid;

    if (mode === "upcoming") {
      mid = el("div", "score");
      mid.appendChild(el("span", "vs", "vs"));
    } else if (hidden) {
      mid = el("button", "score is-hidden");
      mid.type = "button";
      mid.setAttribute("aria-label", "Ergebnis " + (a.code || "") + " gegen " + (b.code || "") + " anzeigen");
      mid.title = "Ergebnis anzeigen";
      mid.appendChild(el("span", null, "?"));
      mid.appendChild(el("span", "dash", ":"));
      mid.appendChild(el("span", null, "?"));
      mid.addEventListener("click", function () {
        revealed[m.id] = true;
        var fresh = matchRow(m, mode);
        li.replaceWith(fresh);
        var s = fresh.querySelector(".score");
        if (s) { s.setAttribute("tabindex", "-1"); s.focus({ preventScroll: true }); }
      });
    } else {
      mid = el("div", "score");
      mid.appendChild(el("span", a.winner ? "w" : null, a.wins != null ? a.wins : "–"));
      mid.appendChild(el("span", "dash", ":"));
      mid.appendChild(el("span", b.winner ? "w" : null, b.wins != null ? b.wins : "–"));
    }

    li.appendChild(teamEl(a, "a", !hidden));
    li.appendChild(mid);
    li.appendChild(teamEl(b, "b", !hidden));

    var meta = el("div", "match-meta");
    var parts = [];
    if (m.stage) parts.push(document.createTextNode(m.stage));
    if (mode === "upcoming") {
      var t = el("time", "start");
      t.dateTime = m.start;
      startLabel(t);
      parts.push(t);
    } else if (mode === "done") {
      parts.push(document.createTextNode(relDate(m.start)));
    }
    if (m.bestOf) parts.push(document.createTextNode("Bo" + m.bestOf));
    parts.forEach(function (p, i) {
      if (i) meta.appendChild(document.createTextNode(" · "));
      meta.appendChild(p);
    });
    li.appendChild(meta);
    return li;
  }

  function group(label, list, mode, opts) {
    list = (list || []).filter(function (m) { return m && m.teams && m.teams.length === 2; });
    if (!list.length) return;
    opts = opts || {};
    body.appendChild(el("h4", "group-label" + (mode === "live" ? " is-live" : ""), label));
    var ul = el("ul", "match-list");
    var limit = opts.limit || list.length;
    list.forEach(function (m, i) {
      var row = matchRow(m, mode);
      if (i >= limit) row.hidden = true;
      ul.appendChild(row);
    });
    body.appendChild(ul);
    if (list.length > limit) {
      var more = el("button", "more-btn", "Alle " + list.length + " anzeigen");
      more.type = "button";
      more.addEventListener("click", function () {
        Array.prototype.forEach.call(ul.children, function (r) { r.hidden = false; });
        more.remove();
      });
      body.appendChild(more);
    }
  }

  /* ---------- Ansicht einer Liga ---------- */
  function render() {
    body.textContent = "";
    if (!current) {
      ep.title.textContent = "Esports";
      spoilerBtn.hidden = true;
      note(body, "Gerade nicht verfügbar.", "https://lolesports.com/");
      return;
    }
    tabButtons.forEach(function (b, i) {
      var on = leagues[i] === current;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) body.setAttribute("aria-labelledby", b.id);
    });
    ep.title.textContent = "";
    var tl = imgEl(current.logo, "league-logo is-title", 22);
    if (tl) ep.title.appendChild(tl);
    ep.title.appendChild(document.createTextNode(current.title || current.name || "Esports"));
    leagueLink.href = httpUrl(current.url) || "https://lolesports.com/";

    if (current.error) {
      spoilerBtn.hidden = true;
      note(body, "Gerade nicht verfügbar.", current.url || "https://lolesports.com/");
      return;
    }
    var hasResults = (current.live || []).length || (current.results || []).length;
    spoilerBtn.hidden = !hasResults;

    group("Live", current.live, "live");
    group("Ergebnisse", current.results, "done", { limit: 5 });
    group("Als Nächstes", current.upcoming, "upcoming");
    if (!hasResults && !(current.upcoming || []).length) {
      note(body, "Gerade keine Spiele.", current.url);
    }
    if (current.stale) note(body, "Stand ist eventuell nicht ganz aktuell.");
  }
  render();

  /* ---------- Fuß ---------- */
  var foot = el("p", "news-foot");
  if (FEED.updated) {
    var t = el("time", null, "Aktualisiert " + relTime(FEED.updated));
    t.dateTime = FEED.updated;
    t.title = new Date(FEED.updated).toLocaleString("de-DE");
    foot.appendChild(t);
  }
  var rss = el("a", "rss", null);
  rss.href = "feed.xml";
  rss.appendChild(icon("rss"));
  rss.appendChild(el("span", null, "RSS abonnieren"));
  foot.appendChild(rss);
  root.appendChild(foot);

  root.hidden = false;
})();
