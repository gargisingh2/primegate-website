// Inline per-page critical CSS and load the full stylesheet without blocking render.
//
//   node tools/critical-css.mjs
//
// Run after ANY change to css/style.css or to a page's header/first sections.
// For each page it:
//   1. Collects the classes/tags/ids used in the header + first two sections
//      (plus state classes JavaScript adds: in, open, scrolled, ...).
//   2. Keeps the style.css rules whose selectors only need those, plus the base
//      reset, tokens and typography, and the self-hosted @font-face rules.
//   3. Writes them inline between <!-- critical:start --> and <!-- critical:end -->,
//      with font preloads and a non-blocking link to the full stylesheet
//      (and a <noscript> fallback).
// Safe to re-run. Dependency-free.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS_FILE = path.join(ROOT, "css", "style.css");
const FONTS_FILE = path.join(ROOT, "css", "fonts.css");
// Content hash: changes whenever style.css changes, so browsers fetch the new file.
// Line endings are normalised so a CRLF/LF checkout difference does not change the version.
const CSS_VERSION = crypto.createHash("sha1").update(fs.readFileSync(CSS_FILE, "utf8").split(String.fromCharCode(13)).join("")).digest("hex").slice(0, 8);
const STATE_CLASSES = ["in", "open", "scrolled", "is-active", "is-playing", "show", "active", "js", "is-personal", "flipped"];
// Selector starts that are always critical. The lookahead (not \b) is needed so "*" and "[id]" match too.
const ALWAYS = /^(:root|\*|html|body|img|picture|a|ul|h1|h2|h3|p|\[id\]|\.wrap|\.sr-only)(?=$|[\s,.:>[{+~])/;

// ---- tiny CSS splitter: top-level rules, @media/@supports blocks, @keyframes ----
function split(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
    const body = css.slice(open + 1, j - 1);
    out.push({ head, body });
    i = j;
  }
  return out;
}

const tokensOf = (sel) => {
  const s = sel.replace(/::?[a-z-]+(\([^)]*\))?/g, " ").replace(/\[[^\]]*\]/g, " ");
  return { classes: [...s.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]), ids: [...s.matchAll(/#([a-zA-Z0-9_-]+)/g)].map((m) => m[1]) };
};

function selectorNeeded(sel, used) {
  sel = sel.trim();
  if (ALWAYS.test(sel) && !/\./.test(sel.replace(/^body\./, ""))) return true;
  const { classes, ids } = tokensOf(sel);
  if (!classes.length && !ids.length) return true; // element-only rules (reset, typography): few, small, always needed
  return classes.every((c) => used.classes.has(c)) && ids.every((d) => used.ids.has(d));
}

function critical(rules, used) {
  const keep = [];
  for (const r of rules) {
    if (r.head.startsWith("@keyframes") || r.head.startsWith("@font-face")) continue;
    if (r.head.startsWith("@media") || r.head.startsWith("@supports")) {
      const inner = critical(split(r.body), used);
      if (inner) keep.push(r.head + "{" + inner + "}");
      continue;
    }
    const sels = r.head.split(",").filter((s) => selectorNeeded(s, used));
    if (sels.length) keep.push(sels.map((s) => s.trim()).join(",") + "{" + r.body.trim() + "}");
  }
  return keep.join("");
}

const minify = (s) => s.replace(/\s+/g, " ").replace(/\s*([{}:;,>])\s*/g, "$1").replace(/;}/g, "}");

const rules = split(fs.readFileSync(CSS_FILE, "utf8"));
// Every class the stylesheet defines (used to spot classes that page scripts render).
const CSS_CLASSES = new Set([...fs.readFileSync(CSS_FILE, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const fontsCss = minify(fs.readFileSync(FONTS_FILE, "utf8"));
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !f.startsWith("mock-"));

for (const f of pages) {
  const file = path.join(ROOT, f);
  let html = fs.readFileSync(file, "utf8");
  const bodyStart = html.indexOf("<body");
  // Header + first two content sections approximate the first screen on any device.
  let top = html.slice(bodyStart);
  let cut = 0;
  for (let n = 0; n < 3; n++) { const k = top.indexOf("</section>", cut); if (k < 0) break; cut = k + 10; }
  top = top.slice(0, cut || 20000);
  const used = { classes: new Set(STATE_CLASSES), ids: new Set() };
  for (const m of top.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => used.classes.add(c));
  for (const m of top.matchAll(/id="([^"]+)"/g)) used.ids.add(m[1]);
  const bodyCls = /<body[^>]*class="([^"]+)"/.exec(html);
  if (bodyCls) bodyCls[1].split(/\s+/).forEach((c) => used.classes.add(c));
  // Page-specific scripts (e.g. js/programmes.js) render first-screen markup too: include their classes.
  for (const m of html.matchAll(/<script src="(js\/(?!main\.js)[^"?]+)/g)) {
    const js = path.join(ROOT, m[1]);
    if (!fs.existsSync(js)) continue;
    const src = fs.readFileSync(js, "utf8");
    for (const k of CSS_CLASSES) {
      if (new RegExp("(^|[^\\w-])" + k.replace(/[-]/g, "\\-") + "($|[^\\w-])").test(src)) used.classes.add(k);
    }
  }

  const crit = fontsCss + minify(critical(rules, used));
  const rel = "css/style.css?v=" + CSS_VERSION;
  const block = `<!-- critical:start (generated by tools/critical-css.mjs - do not edit by hand) -->
<link rel="preload" href="/fonts/playfair-display-latin.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/montserrat-latin.woff2" as="font" type="font/woff2" crossorigin />
<style>${crit}</style>
<link rel="preload" href="${rel}" as="style" onload="this.onload=null;this.rel='stylesheet'" />
<noscript><link rel="stylesheet" href="${rel}" /></noscript>
<!-- critical:end -->`;

  if (html.includes("<!-- critical:start")) {
    html = html.replace(/<!-- critical:start[\s\S]*?<!-- critical:end -->/, block);
  } else {
    // First run: drop Google Fonts + the blocking stylesheet link, insert the block where the stylesheet was.
    html = html
      .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"[^>]*>/, "")
      .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>/, "")
      .replace(/\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/, "");
    const linkRe = /<link rel="stylesheet" href="css\/style\.css[^"]*" \/>/;
    if (!linkRe.test(html)) { console.log("SKIP (no stylesheet link):", f); continue; }
    html = html.replace(linkRe, block);
  }
  fs.writeFileSync(file, html);
  console.log(f.padEnd(48), (crit.length / 1024).toFixed(1) + " KB inline");
}
