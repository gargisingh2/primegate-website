# Primegate Consultancy - Website

A fast, SEO-friendly, fully static website (plain HTML + CSS + JavaScript - **no build step, no framework**). You can open it locally by double-clicking `index.html`, and you deploy it by uploading the files to SiteGround. No Node, no compiling, nothing to install.

---

## 1. What's in this folder

```
website/
├── index.html                 Home (showcases all 4 audiences)
├── for-universities.html      University recruitment partnerships
├── study-abroad.html          Outbound students (Middle East → world)
├── study-in-middle-east.html  Inbound students (world → Gulf)
├── management-consulting.html Business setup & consulting (4th audience)
├── partner-with-us.html       Education agents / sub-agents (+ application form)
├── about.html                 Founder story & philosophy
├── contact.html               3 tabbed contact forms
├── 404.html                   Branded "page not found"
├── .htaccess                  Apache speed + caching + redirects (HIDDEN FILE - see §3)
├── robots.txt                 Lets Google + AI crawlers (GPTBot, ClaudeBot, etc.) in
├── sitemap.xml                Page list for search engines
├── llms.txt                   Plain-text site summary for AI assistants (LLM/AIO citation)
├── site.webmanifest           App icon / theme metadata
├── css/style.css              The whole design system (colours, type, components)
├── js/main.js                 All interactivity (no libraries)
├── images/                    Logos + photography
│   ├── logo-horizontal.png    Header + footer lockup
│   ├── logo-full.png          Alternate full logo (used as the OG share image)
│   ├── favicon.png            Browser-tab icon
│   ├── hero-*.jpg             Page hero banners (each with a -mobile version)
│   └── card-*.jpg             Section / card photos
└── admin/                     Optional free content editor (Decap CMS) - see §6
    ├── index.html
    └── config.yml
```

Everything is **self-contained**. The only external requests the pages make are to Google Fonts (for the Playfair Display + Montserrat typefaces). If a visitor is offline, the site still works with fallback fonts.

---

## 2. Preview it on your own computer first

1. Open the `website` folder.
2. Double-click `index.html`. It opens in your browser.
3. Click around - every page, menu, accordion, tab, flip card and carousel works locally.

> Tip: the contact/partner **forms won't actually send anything** until you connect a free form service (see §5). Everything else is fully functional offline.

---

## 3. Put it live on SiteGround (the main task)

You are replacing the current WordPress site. Two routes - pick **A** if you want to keep WordPress installed elsewhere, or **B** (recommended) for a clean, fast static site.

### Route B (recommended): upload as a static site

1. Log in to **SiteGround → Site Tools** for primegateconsultancy.com.
2. Go to **Site → File Manager**.
3. Open the **`public_html`** folder. This is what the world sees at your domain.
4. **Back up the old site first:** select everything currently in `public_html`, click **Archive**, and download the resulting `.zip` to your computer. (If anything goes wrong you can restore it.)
5. Delete (or move into a `_old_wordpress` subfolder) the existing WordPress files in `public_html`.
6. Upload your new site:
   - The fastest way: zip the **contents** of this `website` folder (not the folder itself - you want `index.html` at the top level of the zip), then use File Manager's **Upload** button, and **Extract** the zip inside `public_html`.
   - You should end up with `public_html/index.html`, `public_html/css/style.css`, etc. - **not** `public_html/website/index.html`.
7. Visit `https://primegateconsultancy.com` - the new site should appear. If you see the old site, clear your browser cache or wait a few minutes.

> ⚠️ **Don't lose the `.htaccess` file.** It starts with a dot, so File Manager and many zip tools treat it as *hidden* and skip it by default. It powers the site's compression, browser caching, HTTPS/www redirects and the custom 404 page - without it the site still works but loads slower. In SiteGround File Manager, turn on **Settings → Show hidden files (dotfiles)** and confirm `.htaccess` is sitting in `public_html` after upload. The same applies to `llms.txt`, `sitemap.xml`, `robots.txt` and `site.webmanifest` - make sure all of them made it across.

### Domain note (GoDaddy)
Your domain is at **GoDaddy** but hosting is at **SiteGround**, so the domain's nameservers/DNS should *already* point to SiteGround (that's how the current site works). **You don't need to change anything at GoDaddy** - you're only swapping the files inside the same hosting account. The domain keeps working as-is.

### HTTPS / SSL
SiteGround provides a free **Let's Encrypt SSL**. If it isn't already on: **Site Tools → Security → SSL Manager**, install Let's Encrypt for the domain, then enable **HTTPS Enforce** under **Security → HTTPS Enforce**.

---

## 4. Replacing the placeholder visuals with real photos

To keep the site looking complete with **zero broken images**, the hero banners and cards currently use rich navy gradients instead of photographs. They look intentional and premium as-is. When you have real photography, swap them in:

1. Drop your images into the `images/` folder (e.g. `images/hero-home.jpg`). Use compressed JPGs/WebP (aim < 300 KB each) for speed.
2. **Hero banners** - in any page, find the line:
   ```html
   <div class="hero__bg" style="background:radial-gradient(...);"></div>
   ```
   and replace it with an image:
   ```html
   <div class="hero__bg"><img src="images/hero-home.jpg" alt="Description of the photo" /></div>
   ```
   The navy gradient overlay on top of the photo (for white text legibility) is automatic.
3. **Card images** - replace the placeholder div:
   ```html
   <div class="card__img" style="background:linear-gradient(...);"></div>
   ```
   with:
   ```html
   <div class="card__img"><img src="images/your-photo.jpg" alt="Description" /></div>
   ```
4. The art direction the copywriter recommended for each image is in `../Primegate_Website_Copy_AllPages.md` (look for the `[IMAGE: ...]` notes).

**Logos:** `logo-horizontal.png` is the full horizontal PRIMEGATE CONSULTANCY lockup used in **both the navbar and the footer** (it has a transparent background so it sits cleanly on the navy bar and over hero photos; sizes are set in `css/style.css` under `.nav__logo img` and `.footer__brand img`); `logo-full.png` is the alternate full logo used as the social-share (Open Graph) image; `favicon.png` is the bold navy-and-gold browser-tab icon (set via `<link rel="icon">` in each page's `<head>`). Replace any of these files (keep the same names) to update them everywhere at once.

---

## 5. Making the forms actually send (free)

The contact forms (`contact.html`) and the partner application (`partner-with-us.html`) are wired to **Formspree** but use a placeholder address. Pick one free option:

### Option A - Formspree (already wired in)
1. Sign up free at **formspree.io**.
2. Create a form; it gives you an endpoint like `https://formspree.io/f/abcdwxyz`.
3. In `contact.html` and `partner-with-us.html`, find every:
   ```html
   action="https://formspree.io/f/your-form-id"
   ```
   and replace `your-form-id` with your real ID (`abcdwxyz`).
4. Submit a test from the live site to confirm the email arrives. Free tier = 50 submissions/month.

### Option B - Web3Forms (no account, generous free tier)
1. Go to **web3forms.com**, enter the email you want submissions sent to, and copy the **Access Key**.
2. In each `<form>`, change the action to `https://api.web3forms.com/submit` and add near the top of the form:
   ```html
   <input type="hidden" name="access_key" value="YOUR-ACCESS-KEY" />
   ```
3. Test from the live site. Free tier = 250 submissions/month.

Both deliver submissions to your inbox with the audience type tagged (the hidden `enquiry_type` field is already in each form).

---

## 6. Editing content later - the honest options

You asked for a **free editing panel** so you don't have to touch code. Here is the straight truth so there are no surprises:

### The catch with the free CMS
The free editor included here (**Decap CMS**, in the `admin/` folder) is **Git-based** - it saves edits by committing them to a **GitHub repository**, not directly to SiteGround. So to use the visual editor, the site's source needs to live in a free GitHub repo, and you connect the editor to it. This is free, but it's a one-time technical setup. **Three realistic paths:**

| Path | Effort | Who it's for |
|------|--------|--------------|
| **6a. Edit the HTML directly** | None to set up | The text is plain English inside the `.html` files. Open in SiteGround File Manager's editor (or Notepad/VS Code), change the words between the tags, save/upload. Best for occasional small edits. |
| **6b. Decap CMS + GitHub + Netlify** *(recommended if you want a real dashboard)* | ~30 min one-time | Put the site in a free GitHub repo, deploy via **Netlify** (also free, and it gives you the login system Decap needs out of the box), point your domain at Netlify instead of SiteGround. Then `yourdomain/admin` is a friendly editor. |
| **6c. Keep WordPress** | n/a | If a full visual page-builder is essential, the old WordPress is still the easiest CMS - but you lose the speed/SEO benefits of the static build. Not recommended given your goals. |

### If you choose 6b (Decap CMS dashboard)
1. Create a free **GitHub** account and a new repository, e.g. `primegate-website`.
2. Upload this `website` folder's contents to that repo (GitHub's web uploader works fine).
3. Create a free **Netlify** account, "Add new site → Import from GitHub", pick the repo. Netlify publishes it on a free URL instantly.
4. In Netlify: **Identity → Enable**, then **Identity → Services → Enable Git Gateway**. Invite yourself as a user.
5. Edit `admin/config.yml`: set `repo:` to `your-username/primegate-website`. (With Netlify Identity + Git Gateway you can even change `backend` to `git-gateway` for the simplest login.)
6. Visit `your-netlify-site/admin/` → log in → edit Contact details, Testimonials and FAQs through a friendly form. Publishing commits to GitHub and Netlify re-deploys automatically in seconds.
7. To use your real domain, point primegateconsultancy.com at Netlify (Netlify gives exact DNS instructions; free SSL included).

> Note: out of the box the CMS is set up to edit the **safe, frequently-changed bits** - contact details, testimonials, FAQs (stored as small files in a `content/` folder). Turning *every* page's full body copy into CMS-editable fields is a small additional dev task; for now, full-page copy edits are done per Path 6a.

**If you just want the site live with great SEO and don't need a dashboard, you can ignore the `admin/` folder entirely** - the site works perfectly without it.

---

## 7. SEO - what's already done & what to do after launch

**Already baked in:**
- Unique `<title>` and meta description on every page (keyword-targeted).
- Open Graph **and Twitter Card** tags for clean link previews on LinkedIn / WhatsApp / X.
- **JSON-LD structured data on every page** - EducationalOrganization, WebSite and Organization, plus Service (with an OfferCatalog), FAQPage, BreadcrumbList, AboutPage and ContactPage. This is what helps you show up as a rich result in Google *and* get cited by AI assistants. Includes the real NAP, `foundingDate` and `sameAs` (Instagram + LinkedIn).
- `robots.txt` that explicitly welcomes AI crawlers (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web, PerplexityBot, Google-Extended, Applebot-Extended) so Primegate can be cited in AI answers.
- **`llms.txt`** - a plain-text summary of the business and its four service areas written specifically for AI assistants (the emerging standard for LLM / AI-Overview citation).
- **Performance layer:** `.htaccess` adds GZIP compression, browser caching and HTTPS/www redirects; the homepage preloads its hero image (faster LCP); images use responsive `srcset`/`<picture>` and lazy-loading; fonts use `display: swap`. No frameworks, single CSS/JS file.
- `sitemap.xml` (with `lastmod`), `site.webmanifest`, a branded `404.html`, semantic headings, and a mobile-first responsive layout.

**Do this after the site is live:**
1. Add the site to **Google Search Console** (search.google.com/search-console), verify ownership, and submit `https://primegateconsultancy.com/sitemap.xml`.
2. Add/claim the **Google Business Profile** for the Dubai office - strong local-SEO signal.
3. The real **email, phone and office address** are already in place (info@primegateconsultancy.com · +971 55 312 9798 · Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubai). Use the exact same address when you create the Google Business Profile so the NAP (name/address/phone) matches - this consistency is a ranking signal.
4. Add real photography (§4) with descriptive `alt` text - good for both SEO and accessibility.
5. Full keyword strategy and the per-page rationale are in `../Primegate_SEO_AgentSegment_Addendum.docx`.

---

## 8. Quick "change the words" cheat-sheet

- **Phone / email / address:** the live details (info@primegateconsultancy.com · +971 55 312 9798 · Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E) appear in the footer of every page, on `contact.html`, and inside the JSON-LD structured data in each page's `<head>`. To change them, search each file for `info@primegateconsultancy.com` and `971553129798`.
- **A testimonial:** find the `<blockquote>` in the relevant page and edit the text + the `<cite>` line below it.
- **A menu item label:** edit the `<nav class="nav__menu">` block (it's identical near the top of every page).
- **Brand colours:** all defined once at the top of `css/style.css` under `:root` (e.g. `--gold: #D4AF37;`). Change in one place, updates everywhere.

---

## 9. Credits
- Copy: publication-ready, from `Primegate_Website_Copy_AllPages.md`.
- SEO & AI-citation strategy: `Primegate_SEO_AgentSegment_Addendum.docx`.
- Brand system (Navy #0B1F4D · Gold #D4AF37 · Ivory #F7F3ED, Playfair Display + Montserrat): from the Primegate Brand Guidelines.
