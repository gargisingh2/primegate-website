/* =========================================================
   PRIMEGATE CONSULTANCY - Contact page: programme / institution context
   /contact?programme=<id> or ?institution=<id> (from /programmes and
   /higher-education). Shows what the student is asking about and pre-fills
   the Zoho "Anything else you want to share" field (MultiLine) so the
   advisor sees it. The student can edit it before sending. Only known IDs
   are accepted; nothing else from the URL is displayed.
   ========================================================= */
(function () {
  "use strict";
  var box = document.querySelector("[data-enquiry-context]");
  var frame = document.querySelector("[data-student-form]");
  if (!box || !frame) return;
  var params = new URLSearchParams(location.search);
  var progId = params.get("programme"), instId = params.get("institution");
  if (!progId && !instId) return;

  var LEVEL_Q = { secondary: "Secondary school", higher_secondary: "Higher secondary / A-level or equivalent", foundation: "Foundation", certificate: "Certificate", diploma: "Diploma / Higher diploma", bachelor: "Bachelor's", master: "Master's", doctorate: "Doctorate", not_sure: "Not sure" };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var prefs = {};
  try { prefs = JSON.parse(sessionStorage.getItem("pg-finder-prefs") || "{}"); } catch (e) {}

  function prefLines() {
    var l = [];
    if (prefs.qual) l.push("Highest qualification: " + (LEVEL_Q[prefs.qual] || prefs.qual));
    if (prefs.res && prefs.res !== "Prefer not to say") l.push("Currently living in: " + prefs.res);
    if (prefs.budget) l.push("Annual tuition budget: " + prefs.cur + " " + Number(prefs.budget).toLocaleString("en-GB"));
    else if (prefs.unsure) l.push("Annual tuition budget: not sure yet");
    return l;
  }

  function show(subject, lines) {
    var extra = prefLines();
    var base = ["I'm interested in: " + subject].concat(lines);
    var text = function (withPrefs) { return base.concat(withPrefs && extra.length ? [""].concat(extra) : []).join("\n"); };
    box.innerHTML = "<h3>You are asking about " + esc(subject) + "</h3>" +
      "<p>We have added this to the message box in the form below so your advisor knows which programme you mean. You can edit it before sending.</p>" +
      "<pre data-summary></pre>" +
      (extra.length ? '<label class="fld__check"><input type="checkbox" data-include-prefs /> Also include the preferences I chose in the programme finder</label>' : "") +
      '<p style="margin:0.6rem 0 0;"><button type="button" class="btn btn--ghost-navy btn--sm" data-copy>Copy this summary</button> <span data-copy-status role="status" style="font-size:0.84rem;margin-left:0.5rem;"></span></p>' +
      '<p style="margin:0.6rem 0 0;font-size:0.8rem;">If the message box is empty, paste the summary into "Anything else you want to share".</p>';
    box.hidden = false;
    var pre = box.querySelector("[data-summary]");
    var cb = box.querySelector("[data-include-prefs]");
    var base0 = frame.getAttribute("src").split("?")[0];
    var apply = function () {
      var withPrefs = !!(cb && cb.checked);
      var t = text(withPrefs);
      pre.textContent = t;
      var q = "MultiLine=" + encodeURIComponent(t);
      if (withPrefs && prefs.res && prefs.res !== "Prefer not to say") q += "&SingleLine4=" + encodeURIComponent(prefs.res);
      frame.setAttribute("src", base0 + "?" + q);
    };
    if (cb) cb.addEventListener("change", apply);
    box.querySelector("[data-copy]").addEventListener("click", function () {
      var st = box.querySelector("[data-copy-status]");
      var t = pre.textContent;
      var done = function () { st.textContent = "Copied."; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { st.textContent = "Select the text above and copy it."; });
      else st.textContent = "Select the text above and copy it.";
    });
    apply();
  }

  Promise.all([
    fetch("/data/programmes.json").then(function (r) { return r.json(); }),
    fetch("/data/institutions.json").then(function (r) { return r.json(); })
  ]).then(function (res) {
    var cat = res[0], dir = res[1];
    var insts = {};
    cat.institutions.forEach(function (i) { insts[i.id] = i; });
    if (progId) {
      var p = cat.programmes.filter(function (x) { return x.id === progId; })[0];
      if (!p) return;
      var inst = insts[p.i] || {};
      show(p.t + " at " + inst.name, [
        "Institution: " + inst.name + " (" + inst.location + ")",
        "Level: " + cat.levels[p.lv] + (p.fw ? " (" + p.fw + ")" : "") + (p.cr ? ", " + p.cr : ""),
        "Programme reference: " + p.id
      ]);
    } else if (instId) {
      var i = insts[instId];
      if (i) { show(i.name, ["Location: " + i.location]); return; }
      // Network institutions (ApplyBoard): matched by a short key from the directory links.
      var key = instId.toLowerCase();
      var n = (dir.network || []).filter(function (x) { return x.logo.replace(/^uni-|\.png$/g, "") === key; })[0];
      if (n) show(n.name, ["Country: " + n.country, "Available through Primegate Consultancy's ApplyBoard partnership"]);
    }
  }).catch(function () { /* context is optional: the form still works on its own */ });
})();
