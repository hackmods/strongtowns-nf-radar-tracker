# CapRover deployment (GitHub Actions)

Pushes to `main` upload the source as a tarball to CapRover, which builds the Docker image (from `captain-definition` + `Dockerfile`) and deploys it. No container registry is involved.

This static site uses **nginx** to serve HTML, CSS, JS, and the `data/` folder for published results — no build step on the server.

## One-time CapRover setup

1. **Create the app** in the CapRover dashboard (or let CI create it if you set `CAPROVER_PASSWORD`).
   - Use a short lowercase name, e.g. `stnf-radar`
   - This name must match `CAPROVER_APP_NAME` **exactly**
2. Open the app → **Deployment** → **Enable App Token** → copy the token
3. Enable **HTTPS** (Let's Encrypt) and set your public domain in the app settings
4. No environment variables are required — configure `SCRIPT_URL` and `SECRET` in [`app.js`](../app.js) before pushing

## GitHub secrets

| Secret | Required | Example | Notes |
|--------|----------|---------|-------|
| `CAPROVER_SERVER` | Yes | `https://captain.apps.example.com` | CapRover **dashboard** URL |
| `CAPROVER_APP_NAME` | Yes | `stnf-radar` | Exact app name — not a URL |
| `CAPROVER_APP_TOKEN` | Yes* | (Deployment tab) | App deploy token |
| `CAPROVER_PASSWORD` | Optional | Captain password | Auto-creates app if missing; deploys with password auth |
| `CAPROVER_OTP_TOKEN` | Optional | 2FA code | Required if CapRover dashboard has two-factor auth enabled |

\* Use `CAPROVER_APP_TOKEN` **or** `CAPROVER_PASSWORD`. If the app does not exist yet, add `CAPROVER_PASSWORD` once — CI will create the app, then deploy.

**Find `CAPROVER_SERVER`:** open the CapRover dashboard in your browser and copy that URL.

## How the build works

The workflow tars the repo (excluding `.git`, `.github`, `.cursor`) and POSTs it to CapRover's `appData` endpoint. CapRover reads `captain-definition`, builds the nginx image on the server, then deploys it.

Because this is a static site, the Docker build is fast and needs very little RAM (~256 MB).

## Deploy checklist

1. Set `CONFIG.SCRIPT_URL` and `CONFIG.SECRET` in [`app.js`](../app.js)
2. Add GitHub secrets (`CAPROVER_SERVER`, `CAPROVER_APP_NAME`, `CAPROVER_APP_TOKEN`)
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
