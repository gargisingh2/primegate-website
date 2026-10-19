// Serve WebP with a JPG/PNG fallback and give every <img> explicit width/height.
//
//   npm install --no-save sharp      (once, dev only - not needed by the live site)
//   node tools/optimise-images.mjs
//
// For every image a page references under images/:
//   - creates images/<name>.webp next to the original (kept only if smaller);
//   - wraps a lone <img> in <picture> with a WebP <source>;
//   - inside an existing <picture>, adds a WebP <source> before each JPG/PNG one;
//   - points <link rel="preload" as="image"> at the WebP version;
//   - writes the intrinsic width/height on <img> and on art-directed <source>s.
// Safe to re-run: skips images and tags it has already handled.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let sharp;
try { sharp = createRequire(import.meta.url)(process.env.SHARP_PATH || "sharp"); }
catch { console.error("sharp is not installed. Run: npm install --no-save sharp"); process.exit(1); }

const meta = new Map(); // "images/x.jpg" -> { w, h, webp: "images/x.webp" | null }

async function info(rel) {
  if (meta.has(rel)) return meta.get(rel);
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { meta.set(rel, null); return null; }
  let rec;
  if (rel.endsWith(".svg")) {
    const svg = fs.readFileSync(abs, "utf8");
    const vb = /viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/.exec(svg);
    const w = /<svg[^>]*\swidth="([\d.]+)/.exec(svg), h = /<svg[^>]*\sheight="([\d.]+)/.exec(svg);
    rec = { w: Math.round(w ? +w[1] : vb ? +vb[1] : 0), h: Math.round(h ? +h[1] : vb ? +vb[2] : 0), webp: null };
  } else {
    const m = await sharp(abs).metadata();
    rec = { w: m.width, h: m.height, webp: null };
    if (/\.(jpe?g|png)$/i.test(rel)) {
      const webpRel = rel.replace(/\.(jpe?g|png)$/i, ".webp");
      const webpAbs = path.join(ROOT, webpRel);
      if (!fs.existsSync(webpAbs) || fs.statSync(webpAbs).mtimeMs < fs.statSync(abs).mtimeMs) {
        const isPng = /\.png$/i.test(rel);
        await sharp(abs).webp(isPng ? { quality: 88, alphaQuality: 90, effort: 6 } : { quality: 78, effort: 6 }).toFile(webpAbs);
      }
      if (fs.statSync(webpAbs).size < fs.statSync(abs).size) rec.webp = webpRel;
      else fs.unlinkSync(webpAbs);
    }
  }
  meta.set(rel, rec);
  return rec;
}

const attr = (tag, name) => (new RegExp("\\s" + name + '="([^"]*)"').exec(tag) || [])[1];
const setDims = (tag, r) => {
  if (!r || !r.w || !r.h || /\swidth="/.test(tag)) return tag;
  return tag.replace(/\s*\/?>$/, ` width="${r.w}" height="${r.h}"$&`.replace(/^\s*/, " "));
};

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !f.startsWith("mock-"));
let converted = 0, sized = 0;
for (const f of pages) {
  const file = path.join(ROOT, f);
  let html = fs.readFileSync(file, "utf8");
  // Pre-compute metadata for every referenced image (async), then rewrite synchronously.
  const refs = new Set([...html.matchAll(/(?:src|srcset|href)="(images\/[^"]+\.(?:jpe?g|png|svg))"/gi)].map((m) => m[1]));
  for (const r of refs) await info(r);

  // 1. Existing <picture> blocks: WebP sources + dimensions.
  html = html.replace(/<picture>([\s\S]*?)<\/picture>/g, (whole, inner) => {
    if (/type="image\/webp"/.test(inner)) {                       // already handled: just make sure img is sized
      return whole.replace(/<img\b[^>]*>/, (t) => { const r = meta.get(attr(t, "src")); const n = setDims(t, r); if (n !== t) sized++; return n; });
    }
    let out = inner.replace(/<source\b[^>]*>/g, (s) => {
      const src = attr(s, "srcset"); const r = meta.get(src);
      let s2 = setDims(s, r);
      if (r && r.webp) { converted++; return s2.replace(/srcset="[^"]*"/, `type="image/webp" srcset="${r.webp}"`) + "\n      " + s2; }
      return s2;
    });
    out = out.replace(/(\s*)(<img\b[^>]*>)/, (m, ws, t) => {
      const r = meta.get(attr(t, "src"));
      const t2 = setDims(t, r); if (t2 !== t) sized++;
      return (r && r.webp ? (converted++, `${ws}<source type="image/webp" srcset="${r.webp}" />`) : "") + ws + t2;
    });
    return "<picture>" + out + "</picture>";
  });

  // 2. Lone <img> tags (not inside a picture): wrap with a WebP source when one exists.
  const parts = html.split(/(<picture>[\s\S]*?<\/picture>)/);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(/<img\b[^>]*>/g, (t) => {
      const src = attr(t, "src"); const r = src && meta.get(src);
      if (!r) return t;
      const t2 = setDims(t, r); if (t2 !== t) sized++;
      if (!r.webp) return t2;
      converted++;
      return `<picture><source type="image/webp" srcset="${r.webp}" />${t2}</picture>`;
    });
  }
  html = parts.join("");

  // 3. Image preloads -> WebP (otherwise the browser would fetch both formats).
  html = html.replace(/<link rel="preload" as="image" href="(images\/[^"]+)"([^>]*)>/g, (t, href, rest) => {
    const r = meta.get(href);
    return r && r.webp ? `<link rel="preload" as="image" href="${r.webp}" type="image/webp"${rest.replace(/\stype="[^"]*"/, "")}>` : t;
  });

  fs.writeFileSync(file, html);
}
let before = 0, after = 0;
for (const [rel, r] of meta) if (r && r.webp) { before += fs.statSync(path.join(ROOT, rel)).size; after += fs.statSync(path.join(ROOT, r.webp)).size; }
console.log(`WebP sources added: ${converted}, <img> sized: ${sized}; images with WebP: ${[...meta.values()].filter((r) => r && r.webp).length}; ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`);
const missing = [...meta].filter(([, r]) => !r).map(([k]) => k);
if (missing.length) console.log("Referenced but missing:", missing.join(", "));
