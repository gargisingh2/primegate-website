/* =========================================================
   PRIMEGATE CONSULTANCY - Programme finder (/programmes)
   Deterministic filtering of data/programmes.json. No dependencies.
   - URL holds only public catalogue filters (level, subject, q, dest,
     inst, mode, sort, page) so results can be shared.
   - Qualification, residence and budget are voluntary advisor context:
     kept in this tab's sessionStorage only, never in the URL, and they
     never exclude programmes.
   ========================================================= */
(function () {
  "use strict";
  var root = document.querySelector("[data-finder]");
  if (!root) return;
  document.documentElement.classList.add("js");

  var PAGE_SIZE = 20;
  var PREF_KEY = "pg-finder-prefs";
  var SCROLL_KEY = "pg-finder-scroll";

  // Navigation suggestions, not admission rules (guide section 4).
  var SUGGEST = {
    secondary: ["foundation", "cert_diploma"],
    higher_secondary: ["bachelor", "foundation", "cert_diploma"],
    foundation: ["bachelor", "cert_diploma"],
    certificate: ["cert_diploma", "bachelor"],
    diploma: ["bachelor", "top_up", "pg_cert_diploma", "master"],
    bachelor: ["master", "pg_cert_diploma", "short_course"],
    master: ["doctorate", "pg_cert_diploma", "short_course"],
    doctorate: ["short_course", "pg_cert_diploma"],
    not_sure: []
  };
  // Reviewed search aliases: whole-word tokens only, so "ai" never matches "maintenance".
  var ALIASES = {
    ai: ["artificial intelligence"], aml: ["anti-money laundering", "money laundering"],
    mba: ["business administration"], dba: ["business administration"], hr: ["human resource"],
    it: ["computing"], msc: ["master of science", "m.sc"], bsc: ["bachelor of science", "b.sc"],
    nursing: ["nursing"], oss: ["oss"], chef: ["chef", "culinary"], logistics: ["logistics", "supply chain"]
  };
  var MODES = { full_time: "Full-time", part_time: "Part-time" };
  var REL = { exclusive: "Exclusive Representative Office", admissions: "Admissions Partner" };
  var SOURCE_NAME = { "idea-malta": "IDEA College official course page", "idea-uae": "IDEA Academy official course page" };

  var data = null, instById = {};
  var $ = function (sel) { return root.querySelector(sel); };
  var els = {
    qual: $("#f-qual"), res: $("#f-res"), level: $("#f-level"), subject: $("#f-subject"),
    cur: $("#f-cur"), budget: $("#f-budget"), unsure: $("#f-unsure"),
    q: $("#f-q"), inst: $("#f-inst"), dest: $("#f-dest"), modes: $("#f-mode"), incl: $("#f-incl"),
    sort: $("#f-sort"), results: $("#results"), count: $("#results-count"), chips: $("#chips"),
    pager: $("#pager"), note: $("#budget-note"), clearPrefs: $("#clear-prefs")
  };

  var state = { level: "", subject: "", q: "", dest: [], inst: "", mode: [], incl: false, sort: "az", page: 1 };
  var prefs = { qual: "", res: "", cur: "EUR", budget: "", unsure: false };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function storage() { try { var k = "__t"; sessionStorage.setItem(k, k); sessionStorage.removeItem(k); return sessionStorage; } catch (e) { return null; } }
  var store = storage();

  /* ---------- state <-> URL / storage ---------- */
  function readUrl() {
    var p = new URLSearchParams(location.search);
    state.level = p.get("level") || "";
    state.subject = p.get("subject") || "";
    state.q = p.get("q") || "";
    state.dest = (p.get("dest") || "").split(",").filter(Boolean);
    state.inst = p.get("institution") || "";
    state.mode = (p.get("mode") || "").split(",").filter(Boolean);
    state.incl = p.get("unconfirmed") === "1";
    state.sort = p.get("sort") || "az";
    state.page = Math.max(1, parseInt(p.get("page"), 10) || 1);
  }
  function writeUrl() {
    var p = new URLSearchParams();
    if (state.level) p.set("level", state.level);
    if (state.subject) p.set("subject", state.subject);
    if (state.q) p.set("q", state.q);
    if (state.dest.length) p.set("dest", state.dest.join(","));
    if (state.inst) p.set("institution", state.inst);
    if (state.mode.length) p.set("mode", state.mode.join(","));
    if (state.incl) p.set("unconfirmed", "1");
    if (state.sort !== "az") p.set("sort", state.sort);
    if (state.page > 1) p.set("page", state.page);
    var qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }
  function readPrefs() {
    if (!store) return;
    try { var v = JSON.parse(store.getItem(PREF_KEY) || "{}"); Object.keys(prefs).forEach(function (k) { if (k in v) prefs[k] = v[k]; }); } catch (e) {}
  }
  function savePrefs() {
    if (!store) return;
    try { store.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  /* ---------- filtering ---------- */
  function tokens(q) { return q.toLowerCase().split(/[^a-z0-9.\-]+/).filter(Boolean); }
  function wordMatch(hay, needle) {
    var i = hay.indexOf(needle);
    while (i !== -1) {
      var before = i === 0 ? " " : hay.charAt(i - 1), after = hay.charAt(i + needle.length) || " ";
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
      i = hay.indexOf(needle, i + 1);
    }
    return false;
  }
  function prefixMatch(hay, tok) {
    var words = hay.split(/[^a-z0-9]+/);
    for (var i = 0; i < words.length; i++) if (words[i].indexOf(tok) === 0) return true;
    return false;
  }
  function queryScore(p, toks) {
    if (!toks.length) return 1;
    var title = p.t.toLowerCase(), hay = title + " " + (instById[p.i] ? instById[p.i].name.toLowerCase() : "");
    var score = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i], hit = false, alias = ALIASES[t];
      if (alias) for (var a = 0; a < alias.length; a++) if (wordMatch(hay, alias[a])) { hit = true; break; }
      if (!hit && (t.length >= 3 ? prefixMatch(hay, t) : wordMatch(hay, t))) hit = true;
      if (!hit) return 0;
      score += wordMatch(title, t) || (alias && alias.some(function (x) { return wordMatch(title, x); })) ? 2 : 1;
    }
    if (title.indexOf(toks.join(" ")) !== -1) score += 3;
    return score;
  }
  // Apply every public filter except the ones named in `skip` (used for option counts).
  function apply(skip) {
    skip = skip || {};
    var toks = tokens(state.q);
    var out = [], unconfirmed = 0;
    data.programmes.forEach(function (p) {
      if (!skip.level && state.level && p.lv !== state.level) return;
      if (!skip.subject && state.subject && p.s.indexOf(state.subject) === -1) return;
      if (!skip.dest && state.dest.length && state.dest.indexOf(p.c) === -1) return;
      if (!skip.inst && state.inst && p.i !== state.inst) return;
      var sc = queryScore(p, toks);
      if (!sc) return;
      if (!skip.mode && state.mode.length) {
        if (!p.m) { unconfirmed++; if (!state.incl) return; p._unconf = true; }
        else if (!state.mode.some(function (m) { return p.m.indexOf(m) !== -1; })) return;
        else p._unconf = false;
      } else p._unconf = false;
      p._score = sc;
      out.push(p);
    });
    return { list: out, unconfirmed: unconfirmed };
  }
  function sortList(list) {
    var byInst = function (p) { return instById[p.i] ? instById[p.i].name : p.i; };
    list.sort(function (a, b) {
      if (state.q && state.sort === "az") { if (b._score !== a._score) return b._score - a._score; }
      if (state.sort === "inst") { var c = byInst(a).localeCompare(byInst(b)); if (c) return c; }
      if (a._unconf !== b._unconf) return a._unconf ? 1 : -1;
      return a.t.localeCompare(b.t) || byInst(a).localeCompare(byInst(b)) || a.id.localeCompare(b.id);
    });
    return list;
  }

  /* ---------- controls ---------- */
  function countBy(field, skipKey) {
    var skip = {}; skip[skipKey] = true;
    var counts = {};
    apply(skip).list.forEach(function (p) {
      var vals = field === "s" ? p.s : [p[field]];
      vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    });
    return counts;
  }
  function buildLevelOptions() {
    var counts = countBy("lv", "level");
    var sug = SUGGEST[prefs.qual] || [];
    var all = Object.keys(data.levels);
    var opt = function (k) { return '<option value="' + k + '"' + (state.level === k ? " selected" : "") + ">" + esc(data.levels[k]) + " (" + (counts[k] || 0) + ")</option>"; };
    var html = '<option value="">Any level</option>';
    if (sug.length) {
      html += '<optgroup label="Suggested for you">' + sug.map(opt).join("") + "</optgroup>";
      html += '<optgroup label="All other levels">' + all.filter(function (k) { return sug.indexOf(k) === -1; }).map(opt).join("") + "</optgroup>";
    } else html += all.map(opt).join("");
    els.level.innerHTML = html;
  }
  function buildSubjectOptions() {
    var counts = countBy("s", "subject");
    var totals = {};
    data.programmes.forEach(function (p) { p.s.forEach(function (s) { totals[s] = 1; }); });
    // Only subjects that exist in published records.
    var html = '<option value="">Any subject</option>' + Object.keys(data.subjects).filter(function (k) { return totals[k]; }).map(function (k) {
      return '<option value="' + k + '"' + (state.subject === k ? " selected" : "") + ">" + esc(data.subjects[k]) + " (" + (counts[k] || 0) + ")</option>";
    }).join("");
    els.subject.innerHTML = html;
  }
  function buildStaticControls() {
    els.inst.innerHTML = '<option value="">All institutions</option>' + data.institutions.filter(function (i) { return i.count; }).map(function (i) {
      return '<option value="' + i.id + '">' + esc(i.name) + "</option>";
    }).join("");
    var countries = [];
    data.institutions.forEach(function (i) { if (i.count && countries.indexOf(i.country) === -1) countries.push(i.country); });
    els.dest.innerHTML = countries.map(function (c) {
      return '<label class="fld__check"><input type="checkbox" value="' + esc(c) + '" /> ' + esc(c) + "</label>";
    }).join("");
  }
  function syncControls() {
    els.qual.value = prefs.qual; els.res.value = prefs.res; els.cur.value = prefs.cur;
    els.budget.value = prefs.budget; els.unsure.checked = !!prefs.unsure; els.budget.disabled = !!prefs.unsure;
    els.q.value = state.q; els.inst.value = state.inst; els.sort.value = state.sort; els.incl.checked = state.incl;
    els.dest.querySelectorAll("input").forEach(function (cb) { cb.checked = state.dest.indexOf(cb.value) !== -1; });
    els.modes.querySelectorAll("input").forEach(function (cb) { cb.checked = state.mode.indexOf(cb.value) !== -1; });
    els.note.hidden = !(prefs.budget || prefs.unsure);
  }

  /* ---------- rendering ---------- */
  function chipsHtml() {
    var c = [];
    var add = function (key, label, val) { c.push('<button type="button" class="chip" data-remove="' + key + '"' + (val ? ' data-val="' + esc(val) + '"' : "") + ">" + esc(label) + ' <span aria-hidden="true">&times;</span><span class="sr-only">Remove filter</span></button>'); };
    if (state.q) add("q", "“" + state.q + "”");
    if (state.level) add("level", data.levels[state.level]);
    if (state.subject) add("subject", data.subjects[state.subject]);
    state.dest.forEach(function (d) { add("dest", "Study in " + d, d); });
    if (state.inst && instById[state.inst]) add("inst", instById[state.inst].name);
    state.mode.forEach(function (m) { add("mode", MODES[m], m); });
    if (c.length > 1) c.push('<button type="button" class="linkbtn" data-remove="all">Clear all filters</button>');
    return c.join("");
  }
  function why(p) {
    var bits = [];
    if (state.subject && p.s.indexOf(state.subject) !== -1) bits.push("subject");
    if (state.level && p.lv === state.level) bits.push("study level");
    if (!bits.length) return "";
    return '<span class="tag tag--match">Matches your selected ' + bits.join(" and ") + "</span>";
  }
  function rowHtml(p) {
    var inst = instById[p.i] || {};
    var level = data.levels[p.lv] + (p.fw ? " · " + p.fw : "");
    var modes = p.m ? '<span class="tag tag--known">' + p.m.map(function (m) { return MODES[m]; }).join(" / ") + "</span>" : '<span class="tag tag--confirm">Study mode to confirm</span>';
    var note = p.lv === "top_up" ? '<p class="prow__note">Top-up degree: it builds on a completed, relevant diploma or higher diploma. It is not a first-degree route for school leavers.</p>' : "";
    var unconf = p._unconf ? '<p class="prow__note">Study mode has not been confirmed for this programme yet.</p>' : "";
    var detailId = "d-" + p.id;
    return '<article class="prow">' +
      '<div class="prow__top"><div><h3>' + esc(p.t) + '</h3><p class="prow__meta"><strong>' + esc(inst.name) + "</strong> · " + esc(inst.location) + " · " + esc(level) + "</p></div>" +
      (p.cr ? '<span class="prow__cr">' + esc(p.cr) + "</span>" : "") + "</div>" +
      '<div class="tags">' + why(p) + modes + '<span class="tag tag--confirm">Fees to confirm</span><span class="tag tag--confirm">Intake to confirm</span>' + (p.er ? '<span class="tag tag--confirm">Entry requirements need review</span>' : "") + "</div>" +
      note + unconf +
      '<div class="prow__actions"><button type="button" class="linkbtn" aria-expanded="false" aria-controls="' + detailId + '" data-detail>View details</button>' +
      '<a class="btn btn--navy btn--sm" href="/contact?programme=' + encodeURIComponent(p.id) + '#contact-forms">Ask about this programme</a></div>' +
      '<div class="prow__detail" id="' + detailId + '" hidden>' + detailHtml(p, inst) + "</div>" +
      "</article>";
  }
  function detailHtml(p, inst) {
    var h = "";
    if (p.d) {
      h += "<h4>Duration</h4>" + Object.keys(p.d).map(function (k) { return "<p>" + MODES[k] + ": " + esc(p.d[k]) + "</p>"; }).join("");
    }
    if (p.er) {
      h += "<h4>Official entry requirements</h4><p>" + esc(p.er) + "</p><p><em>An advisor will confirm how your qualification maps to these requirements.</em></p>";
    }
    h += "<h4>Fees and intakes</h4><p>Fees and next intake are confirmed by your Primegate Consultancy advisor for your situation (study mode, nationality and start date can all change them).</p>";
    if (p.src) h += '<p class="src">Source: <a href="' + esc(p.src) + '" target="_blank" rel="noopener">' + esc(SOURCE_NAME[p.i] || "Official course page") + "</a> (checked " + esc(p.chk) + "). Details can change; your advisor confirms them before you apply.</p>";
    if (inst.url) h += '<p class="src"><a href="' + esc(p.u) + '">See all programmes at ' + esc(inst.name) + "</a></p>";
    return h;
  }
  function emptyHtml(unconfirmed) {
    var actions = [];
    if (state.mode.length && unconfirmed && !state.incl) actions.push('<button type="button" class="btn btn--ghost-navy btn--sm" data-incl>Include ' + unconfirmed + " options with study mode to confirm</button>");
    if (state.dest.length) actions.push('<button type="button" class="btn btn--ghost-navy btn--sm" data-remove="dest-all">Any destination</button>');
    if (state.subject) actions.push('<button type="button" class="btn btn--ghost-navy btn--sm" data-remove="subject">Any subject</button>');
    if (state.level) actions.push('<button type="button" class="btn btn--ghost-navy btn--sm" data-remove="level">Any level</button>');
    if (state.q) actions.push('<button type="button" class="btn btn--ghost-navy btn--sm" data-remove="q">Clear search</button>');
    return '<div class="results-empty" role="status"><h3>No listed programmes match all of these choices.</h3><p>Your filters: ' + describe() + '. Try one of these, or ask an advisor: many institutions we work with have programmes that are not listed here yet.</p><div class="btn-row">' + actions.join("") + '<a class="btn btn--navy btn--sm" href="/contact#contact-forms">Ask an advisor</a></div></div>';
  }
  function describe() {
    var d = [];
    if (state.q) d.push("“" + esc(state.q) + "”");
    if (state.level) d.push(esc(data.levels[state.level]));
    if (state.subject) d.push(esc(data.subjects[state.subject]));
    if (state.dest.length) d.push("in " + esc(state.dest.join(" or ")));
    if (state.inst && instById[state.inst]) d.push("at " + esc(instById[state.inst].name));
    if (state.mode.length) d.push(state.mode.map(function (m) { return MODES[m]; }).join(" or "));
    return d.join(", ");
  }
  function render(keepFocus) {
    buildLevelOptions();
    buildSubjectOptions();
    var res = apply();
    var list = sortList(res.list);
    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * PAGE_SIZE;
    var slice = list.slice(start, start + PAGE_SIZE);
    els.count.innerHTML = list.length ? list.length + (list.length === 1 ? " programme" : " programmes") + (pages > 1 ? " <span>· showing " + (start + 1) + "-" + (start + slice.length) + "</span>" : "") : "0 programmes";
    els.chips.innerHTML = chipsHtml();
    var html = slice.map(rowHtml).join("");
    if (!list.length) html = emptyHtml(res.unconfirmed);
    else if (state.mode.length && res.unconfirmed && !state.incl && state.page === pages) {
      html += '<div class="results-more">' + res.unconfirmed + ' more programmes match your other choices, but their study mode is still to be confirmed. <button type="button" class="linkbtn" data-incl>Include options needing confirmation</button></div>';
    }
    els.results.innerHTML = html;
    renderPager(pages);
    writeUrl();
  }
  function renderPager(pages) {
    if (pages < 2) { els.pager.innerHTML = ""; return; }
    var b = '<button type="button" data-page="' + (state.page - 1) + '"' + (state.page === 1 ? " disabled" : "") + ' aria-label="Previous page">&lsaquo;</button>';
    for (var i = 1; i <= pages; i++) b += '<button type="button" data-page="' + i + '"' + (i === state.page ? ' aria-current="page"' : "") + ' aria-label="Page ' + i + '">' + i + "</button>";
    b += '<button type="button" data-page="' + (state.page + 1) + '"' + (state.page === pages ? " disabled" : "") + ' aria-label="Next page">&rsaquo;</button>';
    els.pager.innerHTML = b;
  }

  /* ---------- events ---------- */
  function onFilter() { state.page = 1; render(); }
  els.level.addEventListener("change", function () { state.level = els.level.value; onFilter(); });
  els.subject.addEventListener("change", function () { state.subject = els.subject.value; onFilter(); });
  els.inst.addEventListener("change", function () { state.inst = els.inst.value; onFilter(); });
  els.sort.addEventListener("change", function () { state.sort = els.sort.value; render(); });
  var qTimer;
  els.q.addEventListener("input", function () { clearTimeout(qTimer); qTimer = setTimeout(function () { state.q = els.q.value.trim(); onFilter(); }, 200); });
  root.querySelector("[data-search-form]").addEventListener("submit", function (e) { e.preventDefault(); state.q = els.q.value.trim(); onFilter(); });
  els.dest.addEventListener("change", function () { state.dest = [].map.call(els.dest.querySelectorAll("input:checked"), function (c) { return c.value; }); onFilter(); });
  els.modes.addEventListener("change", function () { state.mode = [].map.call(els.modes.querySelectorAll("input:checked"), function (c) { return c.value; }); onFilter(); });
  els.incl.addEventListener("change", function () { state.incl = els.incl.checked; onFilter(); });

  // Voluntary preferences: guidance only.
  els.qual.addEventListener("change", function () { prefs.qual = els.qual.value; savePrefs(); render(); });
  els.res.addEventListener("change", function () { prefs.res = els.res.value.trim(); savePrefs(); });
  els.cur.addEventListener("change", function () { prefs.cur = els.cur.value; savePrefs(); });
  els.budget.addEventListener("input", function () { prefs.budget = els.budget.value.replace(/[^\d]/g, ""); savePrefs(); els.note.hidden = !(prefs.budget || prefs.unsure); });
  els.unsure.addEventListener("change", function () { prefs.unsure = els.unsure.checked; els.budget.disabled = prefs.unsure; if (prefs.unsure) { prefs.budget = ""; els.budget.value = ""; } savePrefs(); els.note.hidden = !(prefs.budget || prefs.unsure); });
  els.clearPrefs.addEventListener("click", function () {
    prefs = { qual: "", res: "", cur: "EUR", budget: "", unsure: false };
    if (store) try { store.removeItem(PREF_KEY); } catch (e) {}
    syncControls(); render();
  });

  root.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute("data-detail")) {
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      var open = t.getAttribute("aria-expanded") === "true";
      t.setAttribute("aria-expanded", open ? "false" : "true");
      t.textContent = open ? "View details" : "Hide details";
      panel.hidden = open;
      return;
    }
    if (t.hasAttribute("data-incl")) { state.incl = true; els.incl.checked = true; render(); return; }
    if (t.hasAttribute("data-page")) {
      if (t.disabled) return;
      state.page = parseInt(t.getAttribute("data-page"), 10); render();
      els.count.scrollIntoView({ block: "start" });
      els.count.focus({ preventScroll: true });
      return;
    }
    var r = t.getAttribute("data-remove");
    if (!r) return;
    var v = t.getAttribute("data-val");
    if (r === "all") { state.level = state.subject = state.q = state.inst = ""; state.dest = []; state.mode = []; state.incl = false; }
    else if (r === "dest") state.dest = state.dest.filter(function (d) { return d !== v; });
    else if (r === "dest-all") state.dest = [];
    else if (r === "mode") state.mode = state.mode.filter(function (m) { return m !== v; });
    else if (r === "inst") state.inst = "";
    else state[r] = "";
    syncControls(); onFilter();
    els.count.focus({ preventScroll: true });
  });

  // Mobile: level, country and budget sit behind "Personalise your search".
  var tog = root.querySelector("[data-personalise]"), finderBox = root.querySelector(".finder");
  tog.addEventListener("click", function (e) {
    e.stopPropagation();
    var open = finderBox.classList.toggle("is-personal");
    tog.setAttribute("aria-expanded", open ? "true" : "false");
    tog.textContent = (open ? "− Hide personalisation" : "+ Personalise your search (study level, country, budget)");
  });
  function autoOpen() { if (prefs.qual || prefs.res || prefs.budget || prefs.unsure || state.level) { finderBox.classList.add("is-personal"); tog.setAttribute("aria-expanded", "true"); tog.textContent = "− Hide personalisation"; } }
  // Keep the scroll position for Back from /contact or an official page.
  window.addEventListener("pagehide", function () { if (store) try { store.setItem(SCROLL_KEY, location.search + "|" + window.scrollY); } catch (e) {} });

  /* ---------- load ---------- */
  function fail() {
    els.count.textContent = "";
    els.results.innerHTML = '<div class="results-error" role="alert"><h3>We could not load the programme list.</h3><p>This is a loading problem, not a lack of programmes. Please try again, browse <a class="textlink" href="/higher-education">our institutions</a>, or <a class="textlink" href="/contact#contact-forms">ask an advisor</a>.</p><button type="button" class="btn btn--navy btn--sm" data-retry>Try again</button></div>';
    var r = els.results.querySelector("[data-retry]");
    if (r) r.addEventListener("click", load);
  }
  function load() {
    els.count.textContent = "Loading programmes…";
    fetch("/data/programmes.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      data = d;
      d.institutions.forEach(function (i) { instById[i.id] = i; });
      readUrl(); readPrefs();
      buildStaticControls(); syncControls(); autoOpen(); render();
      if (store) {
        var saved = (store.getItem(SCROLL_KEY) || "").split("|");
        if (saved[0] === location.search && saved[1]) window.scrollTo(0, parseInt(saved[1], 10) || 0);
      }
    }).catch(fail);
  }
  load();
})();
