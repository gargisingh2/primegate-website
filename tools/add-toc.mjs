// Add (or refresh) an "In this article" table of contents on every blog post.
//
//   node tools/add-toc.mjs
//
// - Gives each section heading (<h2> directly in .article) a stable id, keeping
//   any id it already has, so AI assistants and search engines can cite and
//   link to an exact section (/blog-post#section-id).
// - Inserts the list before the first section heading, after the byline,
//   standfirst and any "Key takeaways" box.
// - Skips headings inside the Key takeaways box and the call-to-action box,
//   and "More on ..." reading lists.
// - Safe to re-run: the list lives between <!-- toc:start --> and <!-- toc:end -->.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_TEXT = /^(key takeaways|more on\b|related reads)/i;

const slug = (s) => {
  const full = s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&amp;|&/g, " and ").replace(/&#39;|&rsquo;|['’]/g, "")
    .replace(/&[a-z#0-9]+;/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (full.length <= 60) return full;
  const cut = full.slice(0, 61);
  return cut.slice(0, cut.lastIndexOf("-"));
};
const text = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// Mark the ranges of the boxes whose headings must not appear in the list.
function skipRanges(html) {
  const ranges = [];
  for (const cls of ["key-takeaways", "article-cta"]) {
    const re = new RegExp('<div class="' + cls + '"', "g");
    let m;
    while ((m = re.exec(html))) {
      let depth = 0, i = m.index;
      const tag = /<\/?div\b/g;
      tag.lastIndex = i;
      let t;
      while ((t = tag.exec(html))) { depth += t[0] === "<div" ? 1 : -1; if (depth === 0) { ranges.push([m.index, t.index]); break; } }
    }
  }
  return ranges;
}

const files = fs.readdirSync(ROOT).filter((f) => /^blog-.+\.html$/.test(f));
for (const f of files) {
  const file = path.join(ROOT, f);
  let html = fs.readFileSync(file, "utf8").replace(/\s*<!-- toc:start -->[\s\S]*?<!-- toc:end -->/, "");
  const start = html.indexOf('<div class="article">');
  if (start < 0) { console.log("skip (no .article):", f); continue; }
  const skips = skipRanges(html);
  const used = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const items = [];
  let firstPos = -1;
  html = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (whole, attrs = "", inner, pos) => {
    if (pos < start || skips.some(([a, b]) => pos > a && pos < b)) return whole;
    const label = text(inner);
    if (SKIP_TEXT.test(label)) return whole;
    let id = (/\sid="([^"]+)"/.exec(attrs) || [])[1];
    if (!id) {
      id = slug(label) || "section";
      let n = 2; const base = id;
      while (used.has(id)) id = base + "-" + n++;
      used.add(id);
      attrs = ' id="' + id + '"' + attrs;
    }
    if (firstPos < 0) firstPos = pos;
    items.push([id, label]);
    return "<h2" + attrs + ">" + inner + "</h2>";
  });
  if (items.length < 3) { console.log("skip (fewer than 3 sections):", f); continue; }
  const esc = (s) => s.replace(/&(?![a-z#0-9]+;)/g, "&amp;").replace(/</g, "&lt;");
  const toc = `<!-- toc:start -->
    <nav class="toc" aria-labelledby="toc-title">
      <h2 class="toc__title" id="toc-title">In this article</h2>
      <ol>
${items.map(([id, label]) => `        <li><a href="#${id}">${esc(label)}</a></li>`).join("\n")}
      </ol>
    </nav>
    <!-- toc:end -->
    `;
  // Insert before the first listed section heading (re-find it: ids may have shifted offsets).
  const firstId = items[0][0];
  const at = html.indexOf('<h2 id="' + firstId + '"');
  html = html.slice(0, at) + toc + html.slice(at);
  fs.writeFileSync(file, html);
  console.log(f + ": " + items.length + " sections");
}
