// Shared helpers for the programme catalogue.
// The programme lists on the institution pages (idea-college-malta.html,
// idea-uae.html, fondazione-doria.html) are the single source of truth for
// titles, levels and credits. Edit those pages, then run
// `node tools/build-catalogue.mjs` to refresh data/programmes.json.

import fs from "node:fs";
import path from "node:path";

export const LEVELS = {
  foundation: "Foundation",
  cert_diploma: "Certificate / Diploma",
  bachelor: "Bachelor's",
  top_up: "Bachelor's top-up",
  pg_cert_diploma: "Postgraduate certificate / diploma",
  master: "Master's",
  doctorate: "Doctorate",
  short_course: "Professional / vocational course",
};

export const SUBJECTS = {
  business_management: "Business & Management",
  computing_data_ai: "Computing, Data & AI",
  health_nursing: "Health, Nursing & Care",
  accounting_finance: "Accounting & Finance",
  hospitality_tourism: "Hospitality, Tourism & Culinary",
  engineering_built_environment: "Engineering & Built Environment",
  education: "Education",
  logistics_supply_chain: "Logistics, Supply Chain & Transport",
  law_social_sciences: "Law & Social Sciences",
  arts_design_media: "Arts, Design & Media",
};

// Reviewed keyword rules -> subject tags. A programme can carry several tags.
const SUBJECT_RULES = [
  [/artificial intelligence|computing|blockchain|fintech|digital marketing|\bit\b/i, "computing_data_ai"],
  [/nursing|health|\bos[sa]\b|elderly|care\b|alzheimer|disabilit|social & health|social care/i, "health_nursing"],
  [/account|finance|fintech|money laundering|\baml\b|credit management|blockchain|cryptocurrency/i, "accounting_finance"],
  [/hospitality|tourism|travel|chef|culinary/i, "hospitality_tourism"],
  [/construction|quantity surveying/i, "engineering_built_environment"],
  [/education|childhood/i, "education"],
  [/supply chain|logistics|air transport/i, "logistics_supply_chain"],
  [/fashion/i, "arts_design_media"],
  [/management|business|governance|human resource|retail|compliance|dba|project/i, "business_management"],
];

export function subjectsFor(title) {
  const ids = [];
  SUBJECT_RULES.forEach(([re, id]) => { if (re.test(title) && !ids.includes(id)) ids.push(id); });
  return ids;
}

// Award type from the programme's own title + framework level.
export function levelFor(title, frameworkLevel, unit) {
  const t = title.toLowerCase();
  if (unit === "hours") return "short_course";
  if (/doctor|dba|dhsc/.test(t)) return "doctorate";
  if (/top.?up/.test(t)) return "top_up";
  if (/postgraduate/.test(t)) return "pg_cert_diploma";
  if (/^master|m\.sc|msc|mba|\bma\b/.test(t)) return "master";
  if (/bachelor|b\.sc|bsc|\bba\b/.test(t)) return "bachelor";
  if (/foundation/.test(t)) return "foundation";
  if (/diploma|certificate/.test(t)) return "cert_diploma";
  return null;
}

export function normTitle(s) {
  return s.toLowerCase()
    .replace(/&amp;|&/g, " and ")
    .replace(/\(?\s*top.?up\s*\)?/g, " topup ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bm\.?\s?sc\.?(?=\s|$)/g, "master of science")
    .replace(/\bb\.?\s?sc\.?(?=\s|$)/g, "bachelor of science")
    .replace(/\bundergraduate\b|\bmqf level \d\b|\bdegree\b/g, " ")
    .replace(/\bhuman resources?\b/g, "human resource")
    .replace(/\bin\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function slugify(s) {
  return s.toLowerCase().replace(/&amp;|&/g, "and").replace(/[()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

// Programme list accordions: <span class="prog-acc__lvl">MQF 5</span> ... <li><span class="prog-name">..</span><span class="prog-ects">..</span></li>
function readAccordion(html, institutionId, page) {
  const out = [];
  const block = html.split('id="programme-list"')[1] || "";
  const items = block.split('class="prog-acc__item"').slice(1);
  items.forEach((item) => {
    const fw = (/prog-acc__lvl">([^<]+)</.exec(item) || [])[1] || "";
    const [framework, lvl] = fw.trim().split(/\s+/);
    const re = /<li><span class="prog-name">(?:<a [^>]*>)?([^<]+)(?:<\/a>)?<\/span>(?:<span class="prog-ects">([^<]+)<\/span>)?<\/li>/g;
    let m;
    while ((m = re.exec(item))) {
      let title = unescape(m[1]);
      const tag = m[2] ? unescape(m[2]) : "";
      const ects = /^(\d+)\s*ECTS$/.exec(tag);
      // IDEA UAE lists the subject with the award ("Computing" + "Diploma")
      const display = !ects && tag && !new RegExp(tag, "i").test(title) ? `${tag} in ${title}` : title;
      out.push({
        title: display, institution_id: institutionId, page,
        framework, framework_level: lvl ? +lvl : null, framework_label: fw.trim(),
        credits: ects ? { value: +ects[1], unit: "ECTS" } : null,
      });
    }
  });
  return out;
}

// Fondazione Doria lists named courses as <li data-prog="...">Title - 1,000 hrs</li>
function readTagged(html, institutionId, page) {
  const out = [];
  const re = /<li data-prog(?:="[^"]*")?>(?:<a [^>]*>)?([^<]+)(?:<\/a>)?<\/li>/g;
  let m;
  while ((m = re.exec(html))) {
    const raw = unescape(m[1]);
    const h = /^(.*?)\s+-\s+([\d,]+)\s*hrs$/.exec(raw);
    out.push({
      title: h ? h[1] : raw, institution_id: institutionId, page,
      framework: null, framework_level: null, framework_label: null,
      credits: h ? { value: +h[2].replace(/,/g, ""), unit: "hours" } : null,
    });
  }
  return out;
}

export const SEED_PAGES = [
  ["idea-malta", "idea-college-malta.html", readAccordion],
  ["idea-uae", "idea-uae.html", readAccordion],
  ["fondazione-doria", "fondazione-doria.html", readTagged],
];

export function readSeeds(root) {
  const all = [];
  SEED_PAGES.forEach(([id, file, reader]) => {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    reader(html, id, "/" + file.replace(/\.html$/, "")).forEach((p) => all.push(p));
  });
  const seen = new Set();
  all.forEach((p) => {
    let slug = p.institution_id + "-" + slugify(p.title);
    while (seen.has(slug)) slug += "-2";
    seen.add(slug);
    p.id = slug;
    p.level_group = levelFor(p.title, p.framework_level, p.credits && p.credits.unit);
    p.subject_ids = subjectsFor(p.title);
  });
  return all;
}
