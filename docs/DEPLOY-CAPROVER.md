# CapRover deployment (GitHub Actions)

Pushes to `main` upload the source as a tarball to CapRover, which builds the Docker image (from `captain-definition` + `Dockerfile`) and deploys it. No container registry is involved.

This static site uses **nginx** to serve HTML, CSS, JS, and the `data/` folder for published results — no build step on the server.

## One-time setup (recommended: password auto-create)

You do **not** need to create the CapRover app manually. Set these three GitHub secrets and push to `main` — CI logs in with your captain password, **creates the app** if it does not exist, then deploys:

| Secret | Example | Notes |
|--------|---------|-------|
| `CAPROVER_SERVER` | `https://captain.apps.example.com` | CapRover **dashboard** URL (not the app URL) |
| `CAPROVER_APP_NAME` | `stnf-radar` | Short lowercase name — CI creates this app on first run |
| `CAPROVER_PASSWORD` | (your captain password) | Dashboard login password |

**Find `CAPROVER_SERVER`:** open the CapRover dashboard in your browser and copy that URL.

After the first successful deploy:

1. Open the new app in CapRover → enable **HTTPS** (Let's Encrypt)
2. Optional: App → Deployment → **Enable App Token**, add `CAPROVER_APP_TOKEN` secret, then remove `CAPROVER_PASSWORD` from GitHub if you prefer token-only deploys

No CapRover environment variables are required — configure `SCRIPT_URL` and `SECRET` in [`app.js`](../app.js) before pushing.

## Alternative: app token only

If the app already exists in CapRover:

| Secret | Required | Notes |
|--------|----------|-------|
| `CAPROVER_SERVER` | Yes | Dashboard URL |
| `CAPROVER_APP_NAME` | Yes | Must match existing app name exactly |
| `CAPROVER_APP_TOKEN` | Yes | App → Deployment → Enable App Token |

## Optional secrets

| Secret | When needed |
|--------|-------------|
| `CAPROVER_OTP_TOKEN` | CapRover dashboard has two-factor auth enabled (use current 2FA code as secret, or disable 2FA for CI) |

## How the build works

The workflow tars the repo (excluding `.git`, `.github`, `.cursor`) and POSTs it to CapRover's `appData` endpoint. CapRover reads `captain-definition`, builds the nginx image on the server, then deploys it.

Because this is a static site, the Docker build is fast and needs very little RAM (~256 MB).

## Deploy checklist

1. Set `CONFIG.SCRIPT_URL` and `CONFIG.SECRET` in [`app.js`](../app.js)
2. Add GitHub secrets: `CAPROVER_SERVER`, `CAPROVER_APP_NAME`, `CAPROVER_PASSWORD` (auto-creates app on first deploy)
3. Push to `main` — watch **Actions** → **Build and Deploy to CapRover**
4. Open your app URL (e.g. `https://stnf-radar.apps.example.com`) and test with password `Eddie`

After each event, commit new CSV + manifest updates and push — CI redeploys automatically.

## Troubleshooting

### 404 "Nothing here yet" on deploy

The app name in `CAPROVER_APP_NAME` **does not exist** on your CapRover server.

**Fix (pick one):**

1. **Manual:** CapRover dashboard → Apps → Create New App → name it exactly like `CAPROVER_APP_NAME` → Deployment → Enable App Token → update GitHub secrets.
2. **Automatic:** Add GitHub secret `CAPROVER_PASSWORD`. The workflow will create the app on first run, then deploy.

### Self-signed HTTPS

The workflow calls the CapRover API with `curl -k`, so self-signed captain certificates are accepted. Enable Let's Encrypt in CapRover for production.

### Wrong server URL

| Wrong (`CAPROVER_SERVER`) | Right |
|---------------------------|-------|
| `https://stnf-radar.apps.example.com` | `https://captain.apps.example.com` |
| Your app's public URL | CapRover dashboard URL |

Your volunteers use the **app** URL; GitHub Actions uses the **captain** URL.

### Site loads but submissions fail

CapRover hosting only serves static files. Google Sheet submission still depends on Apps Script — see [README.md](../README.md) troubleshooting.

## Local Docker smoke test

```bash
docker build -t stnf-radar .
docker run --rm -p 8080:80 stnf-radar
# Open http://localhost:8080
```
