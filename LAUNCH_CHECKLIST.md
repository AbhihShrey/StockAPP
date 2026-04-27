# Vertex — Launch Checklist (Free `*.onrender.com` path)

Everything below is something **you** do — clicking buttons in third-party
dashboards, generating credentials, copying values into env-var fields. The
code is already done.

Estimated total time: ~90 minutes. Estimated cost: ~$8/month (Render Starter
+ 1 GB disk). **No domain purchase, no DNS work.**

---

## Phase A — Accounts & credentials (~30 min)

### A1. Create a GitHub account (skip if you have one)
- [ ] Sign up at https://github.com.

### A2. Push the code to a private GitHub repo
- [ ] At https://github.com/new, create a **private** repo named `vertex`.
      Leave "Initialize this repository" unchecked.
- [ ] In your terminal, from `/Users/abhihkodavanty/StockAppV1`:
      ```
      git remote add origin git@github.com:<your-username>/vertex.git
      git branch -M main
      git push -u origin main
      ```

### A3. Create a Render account
- [ ] Sign up at https://render.com.
- [ ] Connect your GitHub account when prompted (OAuth).
- [ ] Add a payment method (you'll spend ~$8/mo on the Starter plan).

### A4. Get your Financial Modeling Prep (FMP) API key
- [ ] You already have one — it's in your local `server/.env` as `FMP_API_KEY`.
      Copy that exact value somewhere temporary (a notes app); you'll paste
      it into Render in Phase B.

### A5. Set up SMTP for transactional email
You need this for password resets, email verification, alert fires, and
daily digests. **Pick one:**

**Option A — Gmail (free, easiest, ~10 emails/min cap)**
- [ ] Turn on 2FA at https://myaccount.google.com/security.
- [ ] Generate an App Password at https://myaccount.google.com/apppasswords →
      "Mail" → "Other" → name it "Vertex".
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

**Option C — Postmark, Mailgun, etc.** — same shape, different host.

### A6. Generate a JWT secret
- [ ] In your terminal, run: `openssl rand -hex 32`
- [ ] Copy the 64-character output. Save it somewhere temporary — this is
      `JWT_SECRET`. **Do not commit it. Do not reuse anywhere else.**

---

## Phase B — Deploy the backend (~20 min)

### B1. Create the backend Web Service
- [ ] On Render → **New → Web Service**.
- [ ] Pick the `vertex` repo.
- [ ] Fill in:
      - **Name:** `vertex-api`
      - **Region:** pick the one closest to you (Oregon for US West, Virginia for US East)
      - **Branch:** `main`
      - **Root Directory:** `server`
      - **Runtime:** Node
      - **Build Command:** `npm install`
      - **Start Command:** `node index.js`
      - **Plan:** **Starter** ($7/mo). Do NOT pick Free — it sleeps after
        15 min idle and breaks the alert engine.

### B2. Add a persistent disk for the database
- [ ] Scroll down on the same form → **Disks → Add Disk**.
      - **Name:** `vertex-data`
      - **Mount Path:** `/var/data`
      - **Size:** 1 GB ($1/mo)

### B3. Add environment variables
On the same form, scroll to **Environment Variables** and add each of these:

- [ ] `NODE_ENV` = `production`
- [ ] `JWT_SECRET` = (the 64-char string from A6)
- [ ] `FMP_API_KEY` = (your FMP key from A4)
- [ ] `SMTP_HOST` = (from A5)
- [ ] `SMTP_PORT` = `587`
- [ ] `SMTP_USER` = (from A5)
- [ ] `SMTP_PASS` = (from A5)
- [ ] `SMTP_FROM_NAME` = `Vertex`
- [ ] `DB_DIR` = `/var/data`

Leave the next two **blank for now** — you'll fill them in B5 once you have
the static-site URL:

- [ ] `PUBLIC_BASE_URL` = (placeholder, fill in B5)
- [ ] `CORS_ORIGINS` = (placeholder, fill in B5)

### B4. Deploy
- [ ] Click **Create Web Service**. Wait ~3 minutes for the first build.
- [ ] When it goes green, copy the URL Render shows you (looks like
      `https://vertex-api.onrender.com`). Save it.

### B5. Skip until after B7
You'll come back here.

---

## Phase C — Deploy the frontend (~15 min)

### C1. Create the static site
- [ ] Render → **New → Static Site**.
- [ ] Same `vertex` repo.
- [ ] Fill in:
      - **Name:** `vertex-web`
      - **Branch:** `main`
      - **Root Directory:** `client`
      - **Build Command:** `npm install && npm run build`
      - **Publish Directory:** `dist`

### C2. Add environment variables
- [ ] `VITE_API_BASE` = the backend URL from B4 (e.g.
      `https://vertex-api.onrender.com`)
- [ ] `VITE_FEATURE_BACKTEST` = `0`
- [ ] `VITE_FEEDBACK_EMAIL` = the email address you want feedback to go to
      (your personal email is fine)

### C3. Deploy
- [ ] Click **Create Static Site**. Wait ~2 minutes.
- [ ] Copy the URL Render assigns (e.g. `https://vertex-web.onrender.com`).

---

## Phase D — Wire the two together (~5 min)

### D1. Update backend env vars now that you have the static-site URL
- [ ] Go back to `vertex-api` → **Environment** tab.
- [ ] Set `PUBLIC_BASE_URL` = the static-site URL from C3 (e.g.
      `https://vertex-web.onrender.com`).
- [ ] Set `CORS_ORIGINS` = the same static-site URL.
- [ ] Click **Save Changes**. Render auto-redeploys (~2 min).

### D2. Wait for the redeploy to finish.

---

## Phase E — Smoke test (~15 min)

Open the static-site URL in an incognito window and walk through every flow.
**Check off each item only after it passes:**

### E1. Signup + email verification
- [ ] Click "Get started" → create an account with a real email address.
- [ ] Within 30 seconds you should receive a verification email.
- [ ] Click the link in the email → land on `/verify-email` with a green
      success state.
- [ ] Refresh the dashboard → the amber "Verify your email" banner is gone.

### E2. Forgot password
- [ ] Sign out (top right user menu → Sign out).
- [ ] Click "Sign in" → "Forgot password?" → enter your email.
- [ ] Within 30 s a reset email arrives. Click the link.
- [ ] Set a new password → you should be redirected to the sign-in screen.
- [ ] Sign in with the new password.

### E3. Two-factor authentication
- [ ] Settings → Two-factor authentication → "Set up 2FA".
- [ ] Scan the QR code with Google Authenticator, Authy, or 1Password.
- [ ] **Save the 8 backup codes somewhere safe** (password manager). They
      are only shown once.
- [ ] Enter the 6-digit code → "Enabled" badge appears.
- [ ] Sign out → sign in → enter a 6-digit code at the challenge screen →
      land on the dashboard.
- [ ] Settings → Disable 2FA, enter your password → 2FA off.

### E4. Alerts (price + email)
- [ ] Alerts page → create a new price alert on a stock you can move
      (e.g. SPY > $1 — guaranteed to fire).
- [ ] Within 60 seconds an in-app toast and an email should arrive.

### E5. Watchlist
- [ ] Watchlist → add SPY, QQQ, AAPL.
- [ ] Refresh → they're still there (proves the persistent disk works).

### E6. Download my data
- [ ] Settings → Download my data → JSON file downloads.
- [ ] Open it — you should see your email, watchlist, alerts.

### E7. Delete account (use a throwaway test account, not your real one)
- [ ] Sign up a second test account.
- [ ] Settings → Delete account → enter password → type `DELETE` → confirm.
- [ ] Redirected to `/welcome`. Try to sign in with that account → fails.

### E8. Legal pages
- [ ] Visit each footer link from `/welcome`: Privacy, Terms, Disclaimer,
      Cookies. All four should render.

### E9. Hidden Strategies
- [ ] Visit `/strategies` directly in the URL bar → you should be redirected
      to `/dashboard` (this confirms the feature flag is working).

---

## Phase F — Customize legal templates (~30 min, do within first week)

The four legal pages are templates with placeholders. **Search-and-replace
these before you share the link with anyone:**

- [ ] `client/src/pages/legal/PrivacyPolicy.jsx` — fill in `[Your Name]`,
      `[contact email]`, your jurisdiction.
- [ ] `client/src/pages/legal/TermsOfService.jsx` — same placeholders +
      governing law.
- [ ] `client/src/pages/legal/Disclaimer.jsx` — verify the financial
      disclaimer reads well for your situation.
- [ ] `client/src/pages/legal/CookiePolicy.jsx` — same placeholders.
- [ ] Commit, push to GitHub. Render auto-redeploys.

> The templates are starting points, not legal advice. If you start charging
> money or accept EU users, have a lawyer review.

---

## Phase G — Day-2 ops (set up once, then forget)

### G1. Bookmark the Render dashboard
- [ ] https://dashboard.render.com — your service URLs, logs, and shell are
      all here.

### G2. Verify nightly backups (after first night)
- [ ] On day 2, go to `vertex-api` → Shell tab → run:
      `ls /var/data/backups`
- [ ] You should see a file named `app-YYYY-MM-DD.db`.

### G3. Decide whether you want a real domain later
You can add one any time — buy from Cloudflare, add CNAMEs, point Render at
it, and update three env vars. No code changes. The free `*.onrender.com`
URL keeps working until you remove it.

---

## Quick reference — env vars you'll have set

**vertex-api (backend):**
| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 64-char hex from `openssl rand -hex 32` |
| `FMP_API_KEY` | your FMP key |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | from your SMTP provider |
| `SMTP_FROM_NAME` | `Vertex` |
| `DB_DIR` | `/var/data` |
| `PUBLIC_BASE_URL` | `https://vertex-web.onrender.com` |
| `CORS_ORIGINS` | `https://vertex-web.onrender.com` |

**vertex-web (frontend):**
| Key | Value |
|---|---|
| `VITE_API_BASE` | `https://vertex-api.onrender.com` |
| `VITE_FEATURE_BACKTEST` | `0` |
| `VITE_FEEDBACK_EMAIL` | your email |

---

## Estimated monthly cost

| Item | Cost |
|---|---|
| Render Web Service (Starter) | $7 |
| Render Disk (1 GB) | $1 |
| Render Static Site | $0 |
| Domain | $0 (using `*.onrender.com`) |
| Gmail SMTP | $0 |
| **Total** | **~$8/mo** |
