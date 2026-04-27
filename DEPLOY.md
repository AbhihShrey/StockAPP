# StockLine — Deploy Runbook

End-to-end instructions for taking StockLine from your laptop to a public URL. Total
cost: ~$10/year (domain) + ~$8/month (Render Starter + 1 GB disk).
Time: ~2 hours of clicking through provider dashboards.

---

## 0. Prerequisites

- A GitHub account (free).
- A credit/debit card for Cloudflare and Render.
- An SMTP provider account (Gmail with an App Password works for low volume;
  SendGrid / Mailgun / Postmark for production).
- The StockLine source code on your laptop, with all current changes committed.

Confirm the working tree is clean before you start:

```bash
git status        # should report nothing pending
git log -1        # note the commit you're about to deploy
```

---

## 1. Buy a domain (Cloudflare Registrar — ~15 min, ~$10/yr)

1. Brainstorm 5–10 candidate names, .com preferred.
2. Sign up at https://dash.cloudflare.com.
3. In the dashboard, go to **Registrar → Register Domain**.
4. Search for your candidates, pick one, complete checkout. Cloudflare
   charges wholesale (no markup) and includes free WHOIS privacy.
5. After purchase your domain is auto-managed by Cloudflare DNS — no extra
   setup is required at this step.

> Why Cloudflare over Namecheap / GoDaddy: at-cost pricing, free WHOIS
> privacy, and the same DNS panel you'll use in step 5 below.

---

## 2. Push the code to GitHub (~10 min)

1. Confirm the repo `.gitignore` already excludes `.env`, `server/data/`, and
   `node_modules/` — it does.
2. At https://github.com/new create a **private** repo named e.g. `stockline`.
   Do NOT initialize it with a README.
3. Wire and push:

   ```bash
   git remote add origin git@github.com:<you>/stockline.git
   git branch -M main
   git push -u origin main
   ```

---

## 3. Deploy the backend on Render (~20 min, ~$8/mo)

1. Sign up at https://render.com and connect your GitHub account.
2. **New → Web Service →** select the `stockline` repo.
3. Settings:
   - **Name:** `stockline-api`
   - **Root Directory:** `server`
   - **Runtime:** Node 22 (or "Auto")
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Plan:** Starter — $7/mo. Do **not** pick Free; the free tier sleeps
     after 15 min idle and will break the alert-engine cron.
4. **Disks → Add Disk** (right side panel before creating the service):
   - **Name:** `stockline-data`
   - **Mount Path:** `/var/data`
   - **Size:** 1 GB (~$1/mo)
   - This is where SQLite + nightly backups live across deploys.
5. **Environment variables** (Render → Environment tab). Paste these one by
   one:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | run `openssl rand -hex 32` locally, paste the output (must be 32+ chars) |
   | `FMP_API_KEY` | your FMP key |
   | `SMTP_HOST` | e.g. `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | your SMTP username |
   | `SMTP_PASS` | your SMTP password / app password |
   | `SMTP_FROM_NAME` | `StockLine` |
   | `DB_DIR` | `/var/data` |
   | `PUBLIC_BASE_URL` | `https://<your-domain>.com` (set after step 5) |
   | `CORS_ORIGINS` | `https://<your-domain>.com` (set after step 5) |

   **Do NOT set:** `ALERTS_DEBUG_ENDPOINT`, `ALERTS_SIMULATION_ENABLED`,
   `ALERTS_IGNORE_MARKET_HOURS`, `BACKTEST_SERVICE_URL` (Strategies stays
   feature-flagged off — see step 6).

6. Click **Create Web Service**. Wait ~3 min for the first build. Note the
   provisional URL (e.g. `https://stockline-api.onrender.com`) — you'll need it
   in step 4.

---

## 4. Deploy the frontend on Render (~15 min, free)

1. Render dashboard → **New → Static Site →** same `stockline` repo.
2. Settings:
   - **Name:** `stockline-web`
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
3. **Environment variables:**

   | Key | Value |
   |---|---|
   | `VITE_API_BASE` | `https://stockline-api.onrender.com` (use your domain after step 5) |
   | `VITE_FEATURE_BACKTEST` | `0` |
   | `VITE_FEEDBACK_EMAIL` | `feedback@<your-domain>.com` |

4. Click **Create Static Site**. Note the provisional URL (e.g.
   `https://stockline-web.onrender.com`).
5. Back in `stockline-api` → Environment, set
   `CORS_ORIGINS=https://stockline-web.onrender.com` and click **Save** so the
   backend allows the static site origin while you test.

Open the static-site URL in your browser. Sign up, get the verification email,
follow the reset-password / 2FA flows. If everything works, move on to
custom-domain wiring.

---

## 5. Wire your domain (~30 min, including DNS propagation)

Plan: `stockline.com` serves the frontend, `api.stockline.com` serves the backend.

### 5a. Add DNS records in Cloudflare

1. Cloudflare dashboard → your domain → **DNS → Records**.
2. Add records:

   | Type | Name | Target | Proxy |
   |---|---|---|---|
   | `CNAME` | `@` | `stockline-web.onrender.com` | DNS only (grey cloud) |
   | `CNAME` | `www` | `stockline-web.onrender.com` | DNS only |
   | `CNAME` | `api` | `stockline-api.onrender.com` | DNS only |

   Cloudflare flattens `CNAME @` automatically. **Set proxy to "DNS only"
   (grey cloud)** — Render handles its own TLS, and orange-cloud proxying
   adds CORS headaches and breaks WebSockets unless you carefully tune
   page rules.

3. **SSL/TLS → Overview → Encryption mode: Full (strict).**

### 5b. Tell Render about the custom domains

1. `stockline-web` → **Custom Domains → Add** `stockline.com` (and `www.stockline.com`).
2. `stockline-api` → **Custom Domains → Add** `api.stockline.com`.
3. Render will show TLS provisioning. Wait until it goes green for all three
   (5–60 min).

### 5c. Point the apps at the real domain

In `stockline-api` → Environment:

- `CORS_ORIGINS` → `https://stockline.com,https://www.stockline.com`
- `PUBLIC_BASE_URL` → `https://stockline.com`

In `stockline-web` → Environment:

- `VITE_API_BASE` → `https://api.stockline.com`

Trigger a redeploy on each. Wait for both green checkmarks.

---

## 6. (Deferred) Backtest microservice

Strategies is hidden behind `VITE_FEATURE_BACKTEST=0`. To enable later:

1. Render → **New → Background Worker** (or Web Service if you want HTTP).
2. Repo: `stockline`, root directory: `backtest-service`, runtime: Python 3.11.
3. Add `BACKTEST_SERVICE_URL=https://<that-service>.onrender.com` to
   `stockline-api`.
4. Add `VITE_FEATURE_BACKTEST=1` to `stockline-web` and redeploy.

The page, sidebar entry, dashboard tile, and Settings landing-page option all
re-appear automatically.

---

## 7. Smoke test (do this before announcing)

1. **Signup → verify email:** create a new account on `stockline.com`. The
   verification email should arrive within ~30 s. Click the link → land on
   `/verify-email` with a green success state. The amber "Verify your email"
   banner in the layout should disappear after refresh.
2. **Forgot password:** sign out, click *Forgot password?* in the modal,
   enter your email. Click the link in the email → set a new password →
   sign in.
3. **2FA:** Settings → Two-factor authentication → Set up 2FA. Scan the QR
   with Google Authenticator or Authy. Save the 8 backup codes. Enter the
   6-digit code → 2FA enabled. Sign out → sign in → enter the code → land on
   the dashboard.
4. **Delete account:** Settings → Delete account. Enter your password, type
   `DELETE`, confirm. You're redirected to `/welcome` and the account is
   gone — verify by trying to sign in (should fail).
5. **Legal pages:** every footer link from `/welcome` (Privacy, Terms,
   Disclaimer, Cookies) opens correctly.
6. **CORS:** from the terminal,

   ```bash
   curl -i -H "Origin: https://evil.example" https://api.stockline.com/api/auth/me
   ```

   should NOT include `Access-Control-Allow-Origin: *`. From your real
   origin it should succeed.
7. **Rate limit:** hammer the public endpoint —

   ```bash
   for i in {1..70}; do curl -s -o /dev/null -w "%{http_code}\n" https://api.stockline.com/api/market-summary; done
   ```

   should turn into `429`s after 60 requests.
8. **Backups:** wait until 03:00 ET, then on Render → `stockline-api` → Shell:

   ```bash
   ls /var/data/backups
   ```

   should list `app-YYYY-MM-DD.db`.
9. **Hidden Strategies:** visit `https://stockline.com/strategies` — you should
   redirect to `/dashboard`.

When all 9 pass, you can share the link.

---

## Operations cheatsheet

- **Logs:** Render dashboard → service → Logs (tail) or Events.
- **Restart:** Render dashboard → service → Manual Deploy → "Deploy latest commit".
- **Database backup download:** Render dashboard → `stockline-api` → Shell tab,
  then `cat /var/data/backups/app-YYYY-MM-DD.db | base64` and pipe into a
  local file (or use Render's SSH-based file download for the disk).
- **Rotate JWT_SECRET:** changing it logs everyone out (existing tokens fail
  signature). Do it from Render → Environment, redeploy.
- **Add an admin / inspect data:** `stockline-api` Shell, then
  `sqlite3 /var/data/investai.db` for a REPL.

---

## Estimated monthly cost

| Item | Cost |
|---|---|
| Render Web Service (Starter) | $7 |
| Render Disk (1 GB) | $1 |
| Render Static Site | $0 |
| Cloudflare DNS | $0 |
| Domain | ~$1/mo amortized |
| **Total** | **~$9/mo** |

Plus your SMTP provider (Gmail free; SendGrid / Postmark ~$15/mo when you
exceed free tier).
