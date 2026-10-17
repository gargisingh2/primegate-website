#!/bin/sh
# Netlify build for STAGING and deploy previews only (wired up in netlify.toml).
# Production has no build command, so none of this ever reaches
# primegateconsultancy.com. It only changes the deploy's working copy, never git.
set -e

# 1. Every response (HTML, JSON, PDF, 404) carries noindex. Crawlers must still be
#    allowed to fetch pages, or they never see this header.
printf '/*\n  X-Robots-Tag: noindex, nofollow\n' > _headers

# 2. Minimal robots.txt: no sitemap advertised, no crawler-promotion comments.
cat > robots.txt <<'EOF'
# Non-production preview. Responses carry X-Robots-Tag: noindex, nofollow.
User-agent: *
Allow: /
EOF

# 3. Staging must not present a future production manifest as live guidance:
#    /sitemap.xml and /llms.txt return 404 here.
rm -f sitemap.xml llms.txt

# 4. Make the HTML meta robots tag agree with the header.
sed -i 's#<meta name="robots" content="[^"]*" />#<meta name="robots" content="noindex, nofollow" />#' ./*.html

echo "staging-build: noindex headers, minimal robots.txt, no sitemap/llms.txt"
