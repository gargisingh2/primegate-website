// Build the shared programme catalogue.
//
//   node tools/build-catalogue.mjs
//
// Reads:  programme lists on the institution pages (single source of truth),
//         data/institutions.json, data/enrichment/*.json (official-site facts)
// Writes: data/programmes.json        - compact index for /programmes
//         agent-partnership.html        - portfolio table between <!-- portfolio:start/end -->
//         higher-education.html       - programme counts in [data-count-for] spans
// Fails (exit 1) on duplicate IDs, unknown institutions or unclassified programmes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSeeds, LEVELS, SUBJECTS, SEED_PAGES } from "./catalogue-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const { institutions, network = [] } = JSON.parse(read("data/institutions.json"));
const instById = Object.fromEntries(institutions.map((i) => [i.id, i]));
const enrichment = {};
const enrichDir = path.join(ROOT, "data", "enrichment");
if (fs.existsSync(enrichDir)) fs.readdirSync(enrichDir).filter((f) => f.endsWith(".json")).forEach((f) => {
  const r = JSON.parse(fs.readFileSync(path.join(enrichDir, f), "utf8"));
  enrichment[r.institution_id] = r;
});

// Official duration wording is kept in full (owner-approved 17 Oct 2026, review
// round 2, R2-04): dissertation/project components and minimums stay. Only the
// two generic scheduling caveats are lifted out and shown once as a note.
const CAVEATS = {
  recess: /\(?\s*subject to changes? due to public holidays,? christmas,? and summer recess\.?\s*\)?/i,
  flexible: /\.?\s*\*\s*the institute sets an indicative duration[\s\S]*$/i,
};
function formatDuration(raw) {
  let s = raw, cav = [];
  Object.entries(CAVEATS).forEach(([k, re]) => { if (re.test(s)) { cav.push(k); s = s.replace(re, " "); } });
  s = s.replace(/\s*\+\s*/g, " + ").replace(/\bMinimum\b/g, "minimum").replace(/\bfor Dissertation\b/g, "for dissertation")
    .replace(/\((Dissertation|Project)\)/g, (m, w) => "(" + w.toLowerCase() + ")").replace(/\bMonths\b/g, "months")
    .replace(/\s+/g, " ").replace(/[\s.]+$/, "").trim();
  return { text: s, cav };
}

// Owner-approved wording corrections to official excerpts (source text is cut off).
// Keyed by programme ID; the raw scrape in data/enrichment stays unchanged.
const ER_CORRECTIONS = {
  // Approved 17 Oct 2026 (review round 3): IDEA's page ends "IELTS level 6.0 or equival".
  "idea-malta-bachelor-of-science-in-nursing-top-up": [[/IELTS level 6\.0 or equival$/, "IELTS level 6.0 or equivalent."]],
};

// Owner decision 26 Oct 2026: the finder shows no IELTS/OET (English-test) eligibility
// criteria. Remove the "Students whose first language is not English ..." sentence
// (including an "at either: IELTS ... OR OET ..." list) and the footnote asterisks
// that pointed to it. Other requirements in the excerpt are kept as published.
function stripEnglishTestRequirement(er) {
  const out = er
    .replace(/\s*\*?\s*Students whose first language is not English[\s\S]*?(?:at either:[\s\S]*?OET[\s\S]*?listening\.|(?:IELTS|OET)[\s\S]*?(?:writing\.|communication\.|equivalent\.))/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ").trim();
  if (/IELTS|OET\b/.test(out)) errors.push("English-test wording left in entry requirements: " + out.slice(0, 80));
  return out;
}

const errors = [];
const seeds = readSeeds(ROOT);
const ids = new Set();
const programmes = seeds.map((p) => {
  if (ids.has(p.id)) errors.push("duplicate id " + p.id);
  ids.add(p.id);
  if (!instById[p.institution_id]) errors.push("unknown institution " + p.institution_id);
  if (!p.level_group) errors.push("no level for " + p.title);
  if (!p.subject_ids.length) errors.push("no subject for " + p.title);
  const inst = instById[p.institution_id] || {};
  const e = (enrichment[p.institution_id] || { programmes: {} }).programmes[p.id];
  const rec = {
    id: p.id, t: p.title, i: p.institution_id, lv: p.level_group, s: p.subject_ids,
    fw: p.framework_label, cr: p.credits ? `${p.credits.value.toLocaleString("en-GB")} ${p.credits.unit === "hours" ? "hrs" : p.credits.unit}` : null,
    c: inst.country, r: inst.region, u: (inst.url || "") + "#programme-list",
  };
  if (p.institution_id === "fondazione-doria") rec.u = inst.url + "#programmes";
  if (e) {
    // Partner-site URLs stay in data/enrichment (not served); the public index
    // carries no outbound links, only the retrieval date.
    rec.chk = e.retrieved_at;
    if (e.modes) rec.m = e.modes;
    if (e.durations) {
      rec.d = {};
      const cav = new Set();
      Object.entries(e.durations).forEach(([k, v]) => { const f = formatDuration(v); rec.d[k] = f.text; f.cav.forEach((c) => cav.add(c)); });
      if (cav.size) rec.dc = [...cav];
    }
    // No partner-site URLs on our pages: drop "Link to ...: <url>" pointers and bare URLs.
    if (e.entry_requirements) rec.er = e.entry_requirements.replace(/\s*Link to [^:.]*:\s*https?:\/\/\S+/gi, "").replace(/\s*https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
    if (rec.er && ER_CORRECTIONS[p.id]) ER_CORRECTIONS[p.id].forEach(([from, to]) => { rec.er = rec.er.replace(from, to); });
    if (rec.er) rec.er = stripEnglishTestRequirement(rec.er);
  }
  return rec;
});
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

const counts = {};
programmes.forEach((p) => { counts[p.i] = (counts[p.i] || 0) + 1; });

write("data/programmes.json", JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  levels: LEVELS, subjects: SUBJECTS,
  institutions: institutions.map((i) => ({ id: i.id, name: i.name, url: i.url, location: i.location, country: i.country, region: i.region, relationship: i.relationship, count: counts[i.id] || 0 })),
  // Directory-only institutions (no listed programmes): lets the finder offer an enquiry route.
  network: network.map((n) => ({ key: n.logo.replace(/^uni-|\.png$/g, ""), name: n.name, country: n.country })),
  programmes,
}) + "\n");

// ---- /agent-partnership portfolio overview ----
const REL = { exclusive: "Exclusive Representative Office", admissions: "Admissions Partner" };
const levelsOf = (id) => {
  const set = new Set(programmes.filter((p) => p.i === id).map((p) => p.lv));
  return Object.keys(LEVELS).filter((k) => set.has(k)).map((k) => LEVELS[k]);
};
const rows = institutions.map((i) => {
  const n = counts[i.id] || 0;
  const name = i.url ? `<a href="${i.url}">${esc(i.name)}</a>` : esc(i.name);
  const lv = n ? levelsOf(i.id).join(", ") : esc(i.levels);
  const cov = n ? `<a href="/programmes?institution=${i.id}">${n} programmes listed &rarr;</a>` : "Programme list on request";
  return `        <tr><th scope="row" data-label="Institution">${name}</th><td data-label="Destination">${esc(i.location)}</td><td data-label="Relationship">${REL[i.relationship]}</td><td data-label="Levels">${lv}</td><td data-label="Programmes">${cov}</td></tr>`;
}).join("\n");
const table = `<!-- portfolio:start (generated by tools/build-catalogue.mjs - do not edit by hand) -->
    <div class="portfolio-table">
      <table>
        <thead><tr><th scope="col">Institution</th><th scope="col">Destination</th><th scope="col">Relationship</th><th scope="col">Levels</th><th scope="col">Programmes</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
    <p class="portfolio-note">Plus universities and colleges in Canada and the UK available through our ApplyBoard partnership - see <a href="/higher-education#north-america">the full directory</a>. Intakes, entry requirements and fees are confirmed per student. Last updated ${new Date().toISOString().slice(0, 10)}.</p>
    <!-- portfolio:end -->`;
let partner = read("agent-partnership.html");
if (partner.includes("<!-- portfolio:start")) {
  partner = partner.replace(/<!-- portfolio:start[\s\S]*?<!-- portfolio:end -->/, table);
  write("agent-partnership.html", partner);
}

// ---- Institution pages: link each listed programme to its stable finder link ----
// Rows are paired with catalogue records in document order (the same order
// readSeeds parsed them), so every row maps to exactly one ID.
SEED_PAGES.forEach(([instId, file]) => {
  let html = read(file);
  const recs = programmes.filter((p) => p.i === instId);
  let n = 0;
  const link = (title) => { const p = recs[n++]; return p ? `<a href="/programmes?programme=${p.id}">${title}</a>` : title; };
  if (instId === "fondazione-doria") {
    html = html.replace(/<li data-prog(="[^"]*")?>(?:<a [^>]*>)?([^<]+)(?:<\/a>)?<\/li>/g, (m, attr, t) => `<li data-prog${attr || ""}>${link(t)}</li>`);
  } else {
    const [head, list] = html.split('id="programme-list"');
    html = head + 'id="programme-list"' + list.replace(/<span class="prog-name">(?:<a [^>]*>)?([^<]+)(?:<\/a>)?<\/span>/g, (m, t) => `<span class="prog-name">${link(t)}</span>`);
  }
  if (n !== recs.length) { console.error(`${file}: ${n} rows vs ${recs.length} records - not linking`); process.exit(1); }
  write(file, html);
});

// ---- /programmes crawlable / no-JavaScript list ----
let finder = read("programmes.html");
const staticList = `<!-- static:start (generated by tools/build-catalogue.mjs; shown when JavaScript is unavailable) -->
    <div class="static-list-wrap">
${institutions.filter((i) => counts[i.id]).map((i) => `      <h2 style="font-size:1.3rem;color:var(--navy);margin:1.6rem 0 0.6rem;">${esc(i.name)}</h2>
      <ul class="static-list">
${programmes.filter((p) => p.i === i.id).map((p) => `        <li>${esc(p.t)}${p.cr ? " - " + esc(p.cr) : ""}</li>`).join("\n")}
      </ul>`).join("\n")}
    </div>
    <!-- static:end -->`;
finder = finder.replace(/<!-- static:start[\s\S]*?<!-- static:end -->/, staticList);
write("programmes.html", finder);

// ---- /higher-education card counts ----
let he = read("higher-education.html");
he = he.replace(/(<span data-count-for="([a-z-]+)">)[^<]*(<\/span>)/g, (m, a, id, b) => a + (counts[id] || 0) + b);
write("higher-education.html", he);

console.log(`programmes.json: ${programmes.length} programmes (${Object.entries(counts).map(([k, v]) => k + " " + v).join(", ")}); ${programmes.filter((p) => p.chk).length} with official-source details`);
