(function () {
  "use strict";

  var SITE = window.SITE || {};
  var APPS = Array.isArray(window.APPS) ? window.APPS : [];
  var TAG_ICONS = window.TAG_ICONS || {};

  var $ = function (id) { return document.getElementById(id); };
  var grid = $("grid"), search = $("search"), filters = $("filters");
  var countEl = $("count"), emptyEl = $("empty");
  var activeTag = null;

  /* ---------- Kopfbereich ---------- */
  if (SITE.title) {
    document.title = SITE.title;
    $("site-title").textContent = SITE.title;
    $("brand-name").textContent = SITE.title;
  }
  $("site-tagline").textContent = SITE.tagline || "";
  $("year").textContent = "© " + new Date().getFullYear();

  /* ---------- Hilfsfunktionen ---------- */
  function safeUrl(u) {
    if (typeof u !== "string") return "#";
    var s = u.trim();
    // Nur http(s) und relative Links zulassen
    if (/^(https?:)?\/\//i.test(s) || /^[./]/.test(s) || !/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
    return "#";
  }
  function isImage(icon) {
    return typeof icon === "string" && /\.(png|jpe?g|svg|webp|gif|avif)(\?.*)?$/i.test(icon);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  /** Icon für eine Kategorie: Emoji oder Bild aus TAG_ICONS in apps.js */
  function tagIcon(tag) {
    var v = TAG_ICONS[tag];
    if (!v) return null;
    var s = el("span", "tag-ico");
    s.setAttribute("aria-hidden", "true");
    if (isImage(v)) {
      var img = el("img");
      img.src = v; img.alt = ""; img.width = 16; img.height = 16;
      s.appendChild(img);
    } else {
      s.textContent = v;
    }
    return s;
  }
  function labelWithIcon(node, tag, text) {
    var ic = tagIcon(tag);
    if (ic) node.appendChild(ic);
    node.appendChild(el("span", null, text));
    return node;
  }

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /* ---------- Karten bauen ---------- */
  var cards = APPS.filter(function (a) { return a && a.name && a.url; }).map(function (app) {
    var li = el("li", "card-wrap");
    var a = el("a", "card");
    a.href = safeUrl(app.url);
    var external = /^(https?:)?\/\//i.test(a.getAttribute("href"));
    if (external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    if (app.color) a.style.setProperty("--accent", app.color);

    var head = el("div", "card-head");
    var icon = el("div", "card-icon");
    if (isImage(app.icon)) {
      var img = el("img");
      img.src = app.icon; img.alt = ""; img.loading = "lazy";
      icon.appendChild(img);
    } else {
      icon.textContent = app.icon || app.name.trim().charAt(0).toUpperCase();
    }
    head.appendChild(icon);
    if (app.badge) head.appendChild(el("span", "badge", app.badge));
    a.appendChild(head);

    a.appendChild(el("h2", "card-title", app.name));
    if (app.description) a.appendChild(el("p", "card-desc", app.description));

    var foot = el("div", "card-foot");
    var tags = el("div", "tags");
    (app.tags || []).forEach(function (t) { tags.appendChild(labelWithIcon(el("span", "tag"), t, t)); });
    foot.appendChild(tags);
    var open = el("span", "open", "Öffnen");
    open.insertAdjacentHTML("beforeend",
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    foot.appendChild(open);
    a.appendChild(foot);

    li.appendChild(a);
    grid.appendChild(li);

    return {
      li: li,
      tags: app.tags || [],
      text: norm([app.name, app.description, (app.tags || []).join(" ")].join(" ")),
    };
  });

  /* ---------- Filter-Chips ---------- */
  var allTags = [];
  cards.forEach(function (c) {
    c.tags.forEach(function (t) { if (allTags.indexOf(t) === -1) allTags.push(t); });
  });
  allTags.sort(function (x, y) { return x.localeCompare(y, "de"); });

  function chip(label, tag) {
    var b = el("button", "chip");
    if (tag === null) {
      var all = el("span", "tag-ico");
      all.setAttribute("aria-hidden", "true");
      all.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><g fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></g></svg>';
      b.appendChild(all);
      b.appendChild(el("span", null, label));
    } else {
      labelWithIcon(b, tag, label);
    }
    b.type = "button";
    b.setAttribute("aria-pressed", String(activeTag === tag));
    b.addEventListener("click", function () {
      activeTag = activeTag === tag ? null : tag;
      renderChips(); apply();
    });
    return b;
  }
  function renderChips() {
    filters.textContent = "";
    if (allTags.length < 2) return;
    filters.appendChild(chip("Alle", null));
    allTags.forEach(function (t) { filters.appendChild(chip(t, t)); });
  }

  /* ---------- Suchen & Filtern ---------- */
  function apply() {
    var q = norm(search.value).trim().split(/\s+/).filter(Boolean);
    var shown = 0;
    cards.forEach(function (c) {
      var ok = (!activeTag || c.tags.indexOf(activeTag) !== -1) &&
               q.every(function (w) { return c.text.indexOf(w) !== -1; });
      c.li.hidden = !ok;
      if (ok) shown++;
    });
    emptyEl.hidden = shown !== 0 || cards.length === 0;
    countEl.textContent = cards.length
      ? shown + (shown === 1 ? " App" : " Apps") + (shown !== cards.length ? " von " + cards.length : "")
      : "Noch keine Apps eingetragen – siehe apps.js.";
  }

  search.addEventListener("input", apply);
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== search) { e.preventDefault(); search.focus(); }
    if (e.key === "Escape" && document.activeElement === search) { search.value = ""; apply(); search.blur(); }
  });

  renderChips();
  apply();

  /* ---------- Hell/Dunkel ---------- */
  var root = document.documentElement;
  $("theme-toggle").addEventListener("click", function () {
    var current = root.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
  });
})();
