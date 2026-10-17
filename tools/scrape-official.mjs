// Enrich the programmes already listed on the Primegate Consultancy site with
// facts from the institutions' OFFICIAL course pages (IDEA Malta, IDEA UAE).
//
//   node tools/scrape-official.mjs
//
// Rules (see PRIMEGATE-WEBSITE-RESTRUCTURING-GUIDE.md):
// - The Primegate site is the baseline. Titles, levels and credits shown on our
//   pages are never replaced; a different official value is recorded as a conflict.
// - Only programmes already on our site are enriched. New official courses are
//   reported in `unlisted` for a human decision, never auto-added.
// - Fees, tax credits and intake dates are NOT captured: their basis/applicant
//   scope is ambiguous, so the site keeps saying "Fees to confirm".
// - One request at a time, ~1.2 s apart.
//
// Output: data/enrichment/<institution>.json (committed; read by build-catalogue).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSeeds, normTitle } from "./catalogue-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (compatible; PrimegateCatalogue/1.0; +https://primegateconsultancy.com)";
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SOURCES = {
  "idea-malta": "https://mt.ideaeducation.com",
  "idea-uae": "https://uae.ideaeducation.com",
};

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(res.status + " " + url);
  return res.text();
}

function decode(s) {
  return s.replace(/&#8211;|&#8212;/g, "-").replace(/&#8217;|&#8216;/g, "'").replace(/&#038;|&amp;/g, "&")
    .replace(/&euro;/g, "EUR ").replace(/&nbsp;/g, " ").replace(/&times;/g, "x").replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim();
}

function pageLines(html) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/g, "")
    .replace(/<\/(p|li|h\d|div|span|td|th|strong|a)>/g, "$&\n").replace(/<[^>]+>/g, "\n")
    .split("\n").map(decode).filter(Boolean);
}

// Pull the facts block + entry requirements out of a course page.
function extract(lines) {
  const out = { ects: null, level: null, modes: [], durations: {}, entry: null };
  const i0 = lines.findIndex((l) => /^(MQF|EQF) Level \d+$/.test(l));
  if (i0 >= 0) out.level = lines[i0];
  const head = lines.slice(Math.max(i0, 0), Math.max(i0, 0) + 40);
  head.forEach((l) => {
    const m = /^(Full|Part)-Time:\s*(.+)$/i.exec(l);
    if (m) {
      const mode = m[1].toLowerCase() === "full" ? "full_time" : "part_time";
      out.durations[mode] = m[2].trim();
      if (!out.modes.includes(mode)) out.modes.push(mode);
    }
  });
  const ei = head.indexOf("ECTS Credits");
  if (ei >= 0) { const m = /(\d+)\s*ECTS/.exec(head[ei + 1] || ""); if (m) out.ects = +m[1]; }
  // Entry requirements: from the "Entry Requirements" heading to the next section heading.
  const s = lines.findIndex((l, i) => l === "Entry Requirements" && i > i0 + 10);
  if (s >= 0) {
    const stops = ["Target Audience", "Audience", "Career Paths", "Modules", "Assessment", "Intake Dates", "Additional Info"];
    let e = s + 1;
    while (e < lines.length && !stops.includes(lines[e])) e++;
    const text = lines.slice(s + 1, e).join(" ").replace(/\s+([.,;:])/g, "$1").replace(/\s+/g, " ").trim();
    if (text) out.entry = text.slice(0, 1800);
  }
  return out;
}

async function officialIndex(base) {
  const all = [];
  for (let page = 1; page < 6; page++) {
    const url = `${base}/wp-json/wp/v2/courses?per_page=100&page=${page}&_fields=link,title`;
    let json;
    try { json = JSON.parse(await get(url)); } catch { break; }
    if (!Array.isArray(json) || !json.length) break;
    json.forEach((c) => all.push({ title: decode(c.title.rendered), url: c.link }));
    await sleep(1200);
    if (json.length < 100) break;
  }
  return all;
}

const seeds = readSeeds(ROOT);
fs.mkdirSync(path.join(ROOT, "data", "enrichment"), { recursive: true });

for (const [inst, base] of Object.entries(SOURCES)) {
  const ours = seeds.filter((p) => p.institution_id === inst);
  const index = await officialIndex(base);
  const byNorm = new Map();
  index.forEach((c) => { const k = normTitle(c.title); if (!byNorm.has(k)) byNorm.set(k, c); });
  const report = { institution_id: inst, source: base, retrieved_at: today, programmes: {}, unmatched: [], conflicts: [], unlisted: [] };
  const used = new Set();

  for (const p of ours) {
    const hit = byNorm.get(normTitle(p.match_title || p.title));
    if (!hit) { report.unmatched.push(p.title); continue; }
    used.add(hit.url);
    await sleep(1200);
    let facts;
    try { facts = extract(pageLines(await get(hit.url))); }
    catch (e) { report.unmatched.push(p.title + " (fetch failed: " + e.message + ")"); continue; }
    const rec = { official_title: hit.title, official_url: hit.url, retrieved_at: today };
    if (facts.modes.length) { rec.modes = facts.modes; rec.durations = facts.durations; }
    if (facts.entry) rec.entry_requirements = facts.entry;
    if (facts.level) rec.official_level = facts.level;
    // Credits: ours stays authoritative; a different official value is a conflict.
    if (facts.ects != null && p.credits && p.credits.unit === "ECTS" && p.credits.value !== facts.ects) {
      report.conflicts.push({ programme: p.title, field: "credits", primegate: p.credits.value + " ECTS", official: facts.ects + " ECTS", source: hit.url });
    }
    if (facts.level && p.framework_label && !facts.level.replace(" Level", "").startsWith(p.framework_label)) {
      report.conflicts.push({ programme: p.title, field: "level", primegate: p.framework_label, official: facts.level, source: hit.url });
    }
    report.programmes[p.id] = rec;
    process.stdout.write(".");
  }
  report.unlisted = index.filter((c) => !used.has(c.url)).map((c) => c.title);
  fs.writeFileSync(path.join(ROOT, "data", "enrichment", inst + ".json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`\n${inst}: ${Object.keys(report.programmes).length}/${ours.length} enriched, ${report.unmatched.length} unmatched, ${report.conflicts.length} conflicts, ${report.unlisted.length} official courses not on our site`);
}
