// Environment regression checks for staging vs production (review round 3).
//
//   node tools/check-env.mjs            # check both hosts
//   node tools/check-env.mjs staging    # or just one
//
// Staging: every response type carries X-Robots-Tag noindex; robots.txt advertises
// no sitemap; /sitemap.xml and /llms.txt are not served.
// Production: public pages are NOT noindexed; every sitemap URL returns 200 with a
// matching production canonical; llms.txt links resolve without redirects.
// Read-only: GET/HEAD requests only, one at a time.

const STAGING = "https://staging--primegateconsultancy.netlify.app";
const PROD = "https://primegateconsultancy.com";
const only = process.argv[2];
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FAIL ") + msg); if (!cond) failures++; };
const get = (url, opts = {}) => fetch(url, { redirect: "manual", ...opts });
const noindex = (res) => /noindex/i.test(res.headers.get("x-robots-tag") || "");

async function staging() {
  console.log("Staging " + STAGING);
  for (const p of ["/", "/programmes", "/programmes?subject=computing_data_ai", "/higher-education", "/contact",
    "/data/programmes.json", "/downloads/IDEA-College-Prospectus-2026.pdf", "/robots.txt", "/this-page-does-not-exist"]) {
    const r = await get(STAGING + p);
    ok(noindex(r), `${p} -> ${r.status}, X-Robots-Tag: ${r.headers.get("x-robots-tag") || "none"}`);
  }
  const robots = await (await get(STAGING + "/robots.txt")).text();
  ok(!/sitemap:/i.test(robots), "robots.txt advertises no sitemap");
  for (const p of ["/sitemap.xml", "/llms.txt"]) {
    const r = await get(STAGING + p);
    ok(r.status === 404, `${p} not served (status ${r.status})`);
  }
  const home = await (await get(STAGING + "/")).text();
  ok(/<meta name="robots" content="noindex/.test(home), "home page meta robots is noindex");
}

async function production() {
  console.log("Production " + PROD);
  const home = await get(PROD + "/");
  ok(home.status === 200 && !noindex(home), `/ -> ${home.status}, no noindex header`);
  const sm = await (await get(PROD + "/sitemap.xml")).text();
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok(urls.length > 0 && urls.every((u) => u.startsWith(PROD)), `sitemap has ${urls.length} URLs, all on ${PROD}`);
  for (const u of urls) {
    const r = await get(u);
    const html = r.status === 200 ? await r.text() : "";
    const canon = (/<link rel="canonical" href="([^"]+)"/.exec(html) || [])[1];
    ok(r.status === 200 && !noindex(r) && canon === u, `${u.replace(PROD, "") || "/"} -> ${r.status}${noindex(r) ? " NOINDEX" : ""}${canon === u ? "" : ", canonical " + canon}`);
  }
  const llms = await (await get(PROD + "/llms.txt")).text();
  for (const u of new Set([...llms.matchAll(/\((https:\/\/primegateconsultancy\.com[^)]*)\)/g)].map((m) => m[1]))) {
    const r = await get(u, { method: "HEAD" });
    ok(r.status === 200, `llms.txt link ${u.replace(PROD, "")} -> ${r.status}`);
  }
}

if (only !== "production") await staging();
if (only !== "staging") await production();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
