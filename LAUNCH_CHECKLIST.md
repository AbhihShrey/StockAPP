# Ember Finances — Launch Checklist (Custom domain via Cloudflare + Render)

Everything below is something **you** do — clicking buttons in third-party
dashboards, generating credentials, copying values into form fields. The
code is already done.

**Estimated total time:** ~2 hours of clicking (not counting DNS propagation
waits, which are background time you can spend doing other things).

**Estimated cost:** ~$10/year domain + ~$8/month hosting = ~$110 first year,
~$96/year after.

| Item | Cost |
|---|---|
| Cloudflare domain (e.g. `.com`) | ~$10/yr (at-cost, no markup) |
| Render Web Service — Starter plan | $7/mo |
| Render persistent disk — 1 GB | $1/mo |
| Render Static Site | $0 |
| Cloudflare DNS | $0 |
| Gmail SMTP | $0 |
| **Total** | **~$8/mo + ~$10/yr domain** |

> Why not Google Domains? Google sold its registrar to Squarespace in 2024,
> and prices went up. Cloudflare Registrar sells at wholesale (no markup),
> includes free WHOIS privacy, and uses the same DNS panel you'll need
> anyway. There is no cheaper or simpler option in 2026.

---

## Phase A — Accounts & credentials (~30 min)

### A1. Create a GitHub account (skip if you have one)
- [ ] Sign up at https://github.com.

### A2. Push the code to a private GitHub repo
- [ ] At https://github.com/new, create a **private** repo named `ember-finances`.
      Leave "Initialize this repository" unchecked.
- [ ] In your terminal, from `/Users/abhihkodavanty/StockAppV1`:
      ```
      git remote add origin git@github.com:<your-username>/ember-finances.git
      git branch -M main
      git push -u origin main
      ```
- [ ] If you already pushed during the free-tier setup, skip this step.

### A3. Create a Render account
- [ ] Sign up at https://render.com.
- [ ] Connect your GitHub account when prompted (OAuth).
- [ ] Add a payment method — you'll be charged ~$8/mo on the Starter plan.

### A4. Create a Cloudflare account
- [ ] Sign up at https://dash.cloudflare.com.
- [ ] Verify your email.
- [ ] Add a payment method (you'll spend ~$10/yr on the domain).

### A5. Get your Financial Modeling Prep (FMP) API key
- [ ] You already have one — it's in your local `server/.env` as `FMP_API_KEY`.
      Copy that exact value somewhere temporary (a notes app); you'll paste
      it into Render in Phase C.

### A6. Set up SMTP for transactional email
You need this for password resets, email verification, alert fires, and
daily digests. **Pick one:**

**Option A — Gmail (free, easiest, ~10 emails/min cap)**
- [ ] Turn on 2FA at https://myaccount.google.com/security.
- [ ] Generate an App Password at https://myaccount.google.com/apppasswords →
      "Mail" → "Other" → name it "Ember Finances".
- [ ] Save these values:
      - `SMTP_HOST` = `smtp.gmail.com`
      - `SMTP_PORT` = `587`
      - `SMTP_USER` = your Gmail address
      - `SMTP_PASS` = the 16-char app password (no spaces)

**Option B — SendGrid (free 100 emails/day, then $20/mo)**
- [ ] Sign up at https://sendgrid.com, verify your email.
- [ ] Create an API key with "Mail Send" permission.
- [ ] Save these values:
      - `SMTP_HOST` = `smtp.sendgrid.net`
      - `SMTP_PORT` = `587`
      - `SMTP_USER` = `apikey` (literally that string)
      - `SMTP_PASS` = the API key starting with `SG.`

### A7. Generate a JWT secret
- [ ] In your terminal, run: `openssl rand -hex 32`
- [ ] Copy the 64-character output. Save it somewhere temporary — this is
      `JWT_SECRET`. **Do not commit it. Do not reuse anywhere else.**

---

## Phase B — Buy your domain on Cloudflare (~15 min)

### B1. Pick a name
- [ ] Brainstorm 5–10 candidate names. Stick to `.com`, `.io`, or `.app`.
      Avoid hyphens and numbers.
- [ ] Examples: `emberfinances.com`, `emberfinances.app`, `getemberfinances.com`.

### B2. Search availability and buy
- [ ] In the Cloudflare dashboard, click **Domain Registration → Register
      Domains** in the left sidebar.
- [ ] Type your candidate domain into the search box. Cloudflare shows
      availability and price (~$10–11/yr for `.com`).
- [ ] Add it to cart, complete checkout. You **don't** need to add any
      add-ons — Cloudflare includes WHOIS privacy and DNS for free.
- [ ] After purchase, Cloudflare auto-creates a "zone" for your domain
      under **Websites** in the sidebar. Click it. You'll come back here
      in Phase E.

> **What you just got:** a domain name that points at Cloudflare's
> nameservers, ready for DNS records. Nothing is hosted yet.

---

## Phase C — Deploy the backend on Render (~25 min)

### C1. Create the backend Web Service
- [ ] Render dashboard → **New → Web Service**.
- [ ] Pick the `ember-finances` repo.
- [ ] Fill in:
      - **Name:** `ember-finances-api`
      - **Region:** Oregon (US West) or Virginia (US East), whichever is
        closer to your home. Pick once — you can't change it later.
      - **Branch:** `main`
      - **Root Directory:** `server`
      - **Runtime:** Node
      - **Build Command:** `npm install`
      - **Start Command:** `node index.js`
      - **Plan:** **Starter ($7/mo)**. Do **NOT** pick Free — it sleeps
        after 15 min idle (breaks the alert engine) and has no persistent
        disk (wipes every account on every restart).

### C2. Add a persistent disk for the database
- [ ] On the same form, scroll to **Disks → Add Disk**.
      - **Name:** `ember-finances-data`
      - **Mount Path:** `/var/data`
      - **Size:** 1 GB ($1/mo)
- [ ] This is critical. Without the disk, accounts vanish on every redeploy.
      The code now refuses to start in production unless `DB_DIR` is set
      (safety net committed in `5b52c28`), so skipping the disk = the
      service won't boot.

### C3. Add environment variables (initial — domain unknown yet)
On the same form, scroll to **Environment Variables** and add each. **Use
the exact key names below — case matters.**

- [ ] `NODE_ENV` = `production`
- [ ] `JWT_SECRET` = (the 64-char string from A7)
- [ ] `FMP_API_KEY` = (your FMP key from A5)
- [ ] `SMTP_HOST` = (from A6)
- [ ] `SMTP_PORT` = `587`
- [ ] `SMTP_USER` = (from A6)
- [ ] `SMTP_PASS` = (from A6)
- [ ] `SMTP_FROM_NAME` = `Ember Finances`
- [ ] `DB_DIR` = `/var/data`

Leave these **blank for now** — you'll fill them in Phase F:

- [ ] `PUBLIC_BASE_URL` = (placeholder, fill in F1)
- [ ] `CORS_ORIGINS` = (placeholder, fill in F1)

### C4. Deploy
- [ ] Click **Create Web Service**. Wait ~3 minutes for the first build.
- [ ] When it goes green, copy the URL Render shows you (looks like
      `https://ember-finances-api.onrender.com`). Save it temporarily — you'll
      use it in C5 and replace it with `api.<your-domain>` in Phase F.
- [ ] **Smoke test:** `curl https://ember-finances-api.onrender.com/api/health`
      should return `{"ok":true,"service":"ember-finances-api"}`.

### C5. Don't proceed until C4 returns green and the smoke test passes.

---

## Phase D — Deploy the frontend on Render (~15 min)

### D1. Create the static site
- [ ] Render → **New → Static Site**.
- [ ] Same `ember-finances` repo.
- [ ] Fill in:
      - **Name:** `ember-finances-web`
      - **Branch:** `main`
      - **Root Directory:** `client`
      - **Build Command:** `npm install && npm run build`
      - **Publish Directory:** `dist`

### D2. Add a Rewrite rule for client-side routing
React Router needs every URL to serve `index.html`. The repo already has
`client/public/_redirects` for this, but **also** add a Rewrite in the
Render dashboard as a belt-and-suspenders safeguard:

- [ ] Scroll to **Redirects/Rewrites** on the same form.
- [ ] Click **Add Rule**.
      - **Source:** `/*`
      - **Destination:** `/index.html`
      - **Action:** Rewrite (NOT Redirect)
- [ ] Without this, hitting `https://your-domain.com/dashboard` directly or
      refreshing on any non-root page returns 404.

### D3. Add environment variables (initial)
- [ ] `VITE_API_BASE` = the backend Render URL from C4 (e.g.
      `https://ember-finances-api.onrender.com`). You'll change it to
      `https://api.<your-domain>` in Phase F.
- [ ] `VITE_FEATURE_BACKTEST` = `0`

### D4. Deploy
- [ ] Click **Create Static Site**. Wait ~2 minutes.
- [ ] Copy the URL Render assigns (e.g. `https://ember-finances-web.onrender.com`).
      Save it.

### D5. Quick test before adding the custom domain
- [ ] Open the static-site URL in an incognito window.
- [ ] You should see the Welcome page. Sign up doesn't have to work yet
      (CORS is still tied to the placeholder URL) — just confirm the page
      renders.

---

## Phase E — Wire your Cloudflare domain to Render (~30 min + propagation)

This is the part that makes `emberfinances.com` actually load your site.
**Plan:** the apex (`emberfinances.com` and `www.emberfinances.com`) serves the
frontend; `api.emberfinances.com` serves the backend.

### E1. Add the custom domain to Render — frontend
- [ ] Render → `ember-finances-web` → **Settings → Custom Domains** → click
      **Add Custom Domain**.
- [ ] Enter your apex domain: `emberfinances.com` (use your real one).
- [ ] Render shows a target like `ember-finances-web.onrender.com`. Copy it.
- [ ] Click **Add Custom Domain** again, this time enter
      `www.emberfinances.com`. Render gives you the same target.

### E2. Add the custom domain to Render — backend
- [ ] Render → `ember-finances-api` → **Settings → Custom Domains** → **Add
      Custom Domain**.
- [ ] Enter `api.emberfinances.com` (use your real domain).
- [ ] Render shows a target like `ember-finances-api.onrender.com`. Copy it.

### E3. Add DNS records on Cloudflare
- [ ] Cloudflare dashboard → **Websites** → click your domain.
- [ ] Left sidebar → **DNS → Records** → **Add record** three times:

      Record 1 (apex):
      - **Type:** `CNAME`
      - **Name:** `@` (Cloudflare flattens this automatically)
      - **Target:** `ember-finances-web.onrender.com` (use the real Render
        target from E1)
      - **Proxy status:** **DNS only (grey cloud)** — click the orange
        cloud to turn it grey
      - **TTL:** Auto

      Record 2 (www):
      - **Type:** `CNAME`
      - **Name:** `www`
      - **Target:** `ember-finances-web.onrender.com`
      - **Proxy status:** **DNS only (grey cloud)**
      - **TTL:** Auto

      Record 3 (api):
      - **Type:** `CNAME`
      - **Name:** `api`
      - **Target:** `ember-finances-api.onrender.com`
      - **Proxy status:** **DNS only (grey cloud)**
      - **TTL:** Auto

- [ ] **Why grey cloud, not orange?** Render handles its own TLS
      certificates. If you proxy through Cloudflare (orange cloud), you
      add a second TLS layer that breaks WebSockets (the alert engine
      uses them) and creates CORS headaches. Stick with grey unless you
      know exactly why you're switching.

### E4. Set Cloudflare SSL/TLS mode
- [ ] Cloudflare → your domain → **SSL/TLS → Overview**.
- [ ] **Encryption mode:** select **Full (strict)**.
- [ ] This is required even with grey-cloud DNS — it controls how
      Cloudflare validates the connection if anyone ever flips the cloud
      orange.

### E5. Wait for TLS to provision on Render
- [ ] Go back to Render → `ember-finances-web` → Custom Domains. Each domain
      shows a "TLS Certificate" status.
- [ ] Wait until all three (`emberfinances.com`, `www.emberfinances.com`,
      `api.emberfinances.com`) show a green checkmark and "Verified."
- [ ] This takes 5–60 minutes. DNS has to propagate first, then Render
      auto-provisions a Let's Encrypt cert.
- [ ] If after 1 hour any of them is stuck, double-check the CNAME target
      matches exactly what Render shows. Typos here are the #1 cause of
      stuck provisioning.

---

## Phase F — Point the apps at the real domain (~10 min)

You can only do this after Phase E shows all three domains green.

### F1. Update backend env vars
- [ ] Render → `ember-finances-api` → **Environment** tab.
- [ ] Edit `PUBLIC_BASE_URL` → `https://emberfinances.com` (your apex domain,
      with `https://`).
- [ ] Edit `CORS_ORIGINS` → `https://emberfinances.com,https://www.emberfinances.com`
      (comma-separated, no spaces, no trailing slash).
- [ ] Click **Save Changes**. Render auto-redeploys (~2 min).

### F2. Update frontend env vars
- [ ] Render → `ember-finances-web` → **Environment** tab.
- [ ] Edit `VITE_API_BASE` → `https://api.emberfinances.com`.
- [ ] Click **Save Changes**. Render auto-rebuilds (~2 min).

### F3. Wait for both redeploys to finish.
- [ ] Both services should show green checkmarks before you smoke-test.

---

## Phase G — Smoke test (~20 min)

Open `https://emberfinances.com` in an incognito window and walk through every
flow. **Check off each only after it passes:**

### G1. Signup + email verification
- [ ] Click "Get started" → create an account with a real email address.
- [ ] Within 30 seconds you should receive a verification email at that
      address.
- [ ] Click the link in the email → land on `/verify-email` with a green
      success state.
- [ ] Refresh the dashboard → the amber "Verify your email" banner is gone.

### G2. Forgot password
- [ ] Sign out (top right user menu → Sign out).
- [ ] Click "Sign in" → "Forgot password?" → enter your email.
- [ ] Within 30 s a reset email arrives. Click the link.
- [ ] Set a new password → you should be redirected to the sign-in screen.
- [ ] Sign in with the new password.

### G3. Two-factor authentication
- [ ] Settings → Two-factor authentication → "Set up 2FA".
- [ ] Scan the QR code with Google Authenticator, Authy, or 1Password.
- [ ] **Save the 8 backup codes somewhere safe** (password manager). They
      are only shown once.
- [ ] Enter the 6-digit code → "Enabled" badge appears.
- [ ] Sign out → sign in → enter a 6-digit code at the challenge screen →
      land on the dashboard.
- [ ] Settings → Disable 2FA, enter your password → 2FA off.

### G4. Alerts (price + email)
- [ ] Alerts page → create a new price alert on a stock you can move
      (e.g. SPY > $1 — guaranteed to fire during market hours).
- [ ] Within 60 seconds an in-app toast and an email should arrive.

### G5. Watchlist persistence (proves the disk works)
- [ ] Watchlist → add SPY, QQQ, AAPL.
- [ ] Refresh → they're still there.
- [ ] Render → `ember-finances-api` → **Manual Deploy → Deploy latest commit**.
      Wait for green.
- [ ] Refresh again → watchlist is **still there**. This is the test that
      proves your persistent disk is working. If the watchlist is gone,
      `DB_DIR` is misconfigured — go back to C3.

### G6. Download my data
- [ ] Settings → Download my data → JSON file downloads.
- [ ] Open it — you should see your email, watchlist, alerts.

### G7. Delete account (use a throwaway test account, not your real one)
- [ ] Sign up a second test account on a different email.
- [ ] Settings → Delete account → enter password → type `DELETE` → confirm.
- [ ] Redirected to `/welcome`. Try to sign in with that account → fails.

### G8. Legal pages
- [ ] Visit each footer link from `/welcome`: Privacy, Terms, Disclaimer,
      Cookies. All four should render.

### G9. Hidden Strategies
- [ ] Visit `https://emberfinances.com/strategies` directly in the URL bar →
      you should be redirected to `/dashboard` (this confirms the feature
      flag is working — backtest service is intentionally not deployed).

### G10. Refresh-on-deep-link
- [ ] Navigate to `https://emberfinances.com/watchlist` → hit Cmd-R / F5 to
      refresh. Should reload the watchlist page, NOT 404. If it 404s,
      Phase D2 wasn't done correctly.

### G11. CORS lockdown
- [ ] In a terminal:
      ```
      curl -i -H "Origin: https://evil.example" https://api.emberfinances.com/api/auth/me
      ```
- [ ] Response should NOT include `Access-Control-Allow-Origin: *` or your
      origin. From your real domain it succeeds.

---

## Phase H — Day-2 ops (set up once, then forget)

### H1. Bookmark the dashboards
- [ ] Render: https://dashboard.render.com
- [ ] Cloudflare: https://dash.cloudflare.com
- [ ] These are the only two places you'll ever click for normal ops.

### H2. Verify nightly backups (after first night)
- [ ] On day 2 of being live, go to `ember-finances-api` → **Shell** tab → run:
      ```
      ls /var/data/backups
      ```
- [ ] You should see a file named `app-YYYY-MM-DD.db` from 03:00 ET that
      morning.
- [ ] If missing, the `cleanupJobs.js` cron didn't fire — check service
      logs.

### H3. Set up uptime monitoring (optional, free)
- [ ] Sign up at https://uptimerobot.com (free for 50 monitors, 5-min checks).
- [ ] Add a monitor: HTTP(s), URL `https://api.emberfinances.com/api/health`,
      interval 5 min, alert email.
- [ ] You'll get an email if the API ever goes down.

---

## Phase I — Customize legal templates (~30 min, do within first week)

The four legal pages already have your name, email, and jurisdiction baked
in (operator: Abhih Kodavanty, contact: support@emberfinances.com, governing
law: State of California, jurisdiction: Alameda County). Re-read each once
to make sure the language reads correctly for your situation:

- [ ] `client/src/pages/legal/PrivacyPolicy.jsx`
- [ ] `client/src/pages/legal/TermsOfService.jsx`
- [ ] `client/src/pages/legal/Disclaimer.jsx`
- [ ] `client/src/pages/legal/CookiePolicy.jsx`

If you change anything, commit and push — Render auto-redeploys.

> The templates are starting points, not legal advice. If you start
> charging money or accept EU users, have a lawyer review.

---

## Quick reference — env vars you'll have set

**ember-finances-api (backend):**
| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 64-char hex from `openssl rand -hex 32` |
| `FMP_API_KEY` | your FMP key |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | from your SMTP provider |
| `SMTP_FROM_NAME` | `Ember Finances` |
| `DB_DIR` | `/var/data` |
| `PUBLIC_BASE_URL` | `https://emberfinances.com` |
| `CORS_ORIGINS` | `https://emberfinances.com,https://www.emberfinances.com` |

**ember-finances-web (frontend):**
| Key | Value |
|---|---|
| `VITE_API_BASE` | `https://api.emberfinances.com` |
| `VITE_FEATURE_BACKTEST` | `0` |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Site loads at `*.onrender.com` but custom domain shows TLS error | DNS not yet propagated, or CNAME target typo'd | Wait 30 min; if still broken, check CNAME target matches Render exactly |
| Refresh on `/dashboard` returns 404 | Phase D2 Rewrite rule missing | Add `/* → /index.html (Rewrite)` in Render → ember-finances-web → Redirects/Rewrites |
| Login works but every API call fails with CORS error | `CORS_ORIGINS` doesn't match the URL the browser is on | Make sure it's exactly `https://emberfinances.com,https://www.emberfinances.com` — no spaces, no trailing slash |
| Account vanishes after a deploy | Disk not mounted at `/var/data`, or `DB_DIR` not set | Phase C2 + C3. Service won't even boot now without `DB_DIR` set in production. |
| Verification email never arrives | SMTP creds wrong or Gmail blocked the App Password | `ember-finances-api` → Logs → search for `[email]` errors. Re-generate the App Password if needed. |
| `api.emberfinances.com` returns Render's "Not Found" page | Custom Domain not added, or DNS pointed at the wrong service | Phase E2 + verify DNS record 3 |
