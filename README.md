# Strong Towns NF Speed Radar Tracker

Mobile-friendly tool for Strong Towns Niagara Falls volunteers to log speed radar readings during community events. Entries are sent to a shared Google Sheet for later analysis.

## Features

- Street name (free text), direction (N / S / E / W, optional), and speed (km/h)
- Automatic timestamp and per-device ID on every entry
- Optional password gate ("Eddie") with a 7-day cookie — controlled by `CONFIG.PASSWORD_REQUIRED` in `app.js` (currently off)
- Offline-friendly: failed submissions queue locally and retry automatically

## Quick start

### 1. Google Sheet + Apps Script

1. Create a new [Google Sheet](https://sheets.google.com).
2. Open **Extensions → Apps Script**.
3. Delete any default code and paste the contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
4. Set `SECRET` at the top of `Code.gs` to a random string (e.g. `stnf-2026-radar`). Remember this value.
5. Click **Deploy → New deployment** (gear icon).
6. Type: **Web app**
7. **Execute as: Me** (`your@gmail.com`) — **not** "User accessing the web app"
8. **Who has access: Anyone** — **not** "Anyone with Google account"
9. Click **Deploy** and complete all authorization prompts.
10. Copy the **Web app URL** from the deployment dialog (ends in `/exec`).

> **Important:** The URL must look like `https://script.google.com/macros/s/DEPLOYMENT_ID/exec` — **no** `/u/0/` or `/u/1/` in the path. If your browser shows `/macros/u/1/s/...`, remove the `/u/1` part or copy the URL from the deployment dialog instead. Account-specific URLs return 404 for volunteers.

### Verify before using the app

Open the test URL in an **incognito/private window** (so you are not signed into Google):

```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?secret=YOUR_SECRET&street=Test&direction=N&speed=25&deviceId=test
```

You must see `{"ok":true}` **without** a Google sign-in page. If you are asked to sign in, the deployment settings are wrong — see [Sign-in redirect / 403](#sign-in-redirect--403-forbidden) below.

### 2. Configure the site

Edit [`app.js`](app.js) and set:

```javascript
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  // or just the deployment ID: 'YOUR_DEPLOYMENT_ID'
  SECRET: 'stnf-2026-radar',  // must match Code.gs
  PASSWORD_REQUIRED: false,  // set true to enable the Eddie password gate
  // ...
};
```

### 3. Host the site

**Option A — GitHub Pages (simplest)**

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Source: **Deploy from branch** → `main` → `/ (root)`.
4. Your site will be at `https://<username>.github.io/strongtowns-nf-radar-tracker/`.

**Option B — CapRover (custom domain, auto-deploy on push)**

1. Add GitHub secrets: `CAPROVER_SERVER`, `CAPROVER_APP_NAME`, `CAPROVER_PASSWORD` — CI auto-creates the app on first deploy.
2. Push to `main` — the workflow builds an nginx container and deploys it.
3. Full setup: **[docs/DEPLOY-CAPROVER.md](docs/DEPLOY-CAPROVER.md)**

Share the URL with volunteers. If `PASSWORD_REQUIRED` is `true`, also share the password (`Eddie`).

## Results page

After an event, publish results at [`results.html`](results.html).

**Event operations (volunteers + organizers):** see **[guide.html](guide.html)** — how to run the activity, enter data, publish results, and present findings.

**Technical publish workflow:** see **[GUIDE.md](GUIDE.md)** for the monthly CSV + manifest checklist. **One-time setup:** see this README.

## Sheet columns

| Timestamp | Street | Direction | Speed (km/h) | DeviceId |
|-----------|--------|-----------|-------|------------|

Download the sheet as CSV after the event for analysis.

## Security notes

| Measure | Protects against |
|---------|------------------|
| Cookie password (`PASSWORD_REQUIRED`) | Casual visitors who find the link |
| Shared secret in payload | Random POST spam to your script |
| Neither | Someone inspecting the public JavaScript |

This is appropriate for a short, community event — not for sensitive data.

## Local testing

Open `index.html` directly in a browser, or use a simple static server:

```bash
npx serve .
```

Note: some browsers restrict `fetch` from `file://` URLs. A local server is recommended for testing submissions.

## Troubleshooting

### Sign-in redirect / 403 Forbidden

If the browser redirects to `accounts.google.com/signin` or the network tab shows a 403 on a Google login URL, **anonymous access is not enabled** on your Apps Script deployment. The radar app cannot fix this in code — you must redeploy.

1. Open **Extensions → Apps Script** on your sheet.
2. **Deploy → Manage deployments** → click the **pencil** icon on the active Web app deployment.
3. Set these **exactly**:
   - **Execute as:** Me (`your@gmail.com`)
   - **Who has access:** Anyone
4. Click **New version** → **Deploy**.
5. Test again in an **incognito window** using the URL from step 4 of [Quick start](#1-google-sheet--apps-script).

| Incognito test result | Fix |
|-----------------------|-----|
| `{"ok":true}` | Deployment is correct |
| Google sign-in page | Wrong "Execute as" or "Who has access" — redeploy with settings above |
| `Unauthorized — secret mismatch` | Set `SECRET` in `Code.gs` to match `app.js`, then redeploy |

**Common mistakes:**
- **Execute as: User accessing the web app** — forces every volunteer to sign into Google. Use **Me** instead.
- **Anyone with Google account** — still requires sign-in. Use **Anyone**.
- Changed `Code.gs` but only saved — must **Deploy → Manage deployments → New version**.
- Used Script ID instead of Deployment ID in `SCRIPT_URL`.

**Workspace accounts:** Some Google Workspace orgs block "Anyone" web apps. Try with a personal `@gmail.com` account, or ask your IT admin.

### 404 Not Found

The URL contains `/u/1/` or `/u/0/` (e.g. `script.google.com/macros/u/1/s/...`). That is an account-specific link that **404s** for anonymous volunteers.

**Correct:** `https://script.google.com/macros/s/YOUR_ID/exec`  
**Wrong:** `https://script.google.com/macros/u/1/s/YOUR_ID/exec`

Copy the URL from **Deploy → Manage deployments**, or let the app strip `/u/N/` automatically (refresh after updating `app.js`).

### Script function not found: doGet

The app uses **POST** (`doPost`), not GET — you should not see this error from the radar form anymore after refreshing.

If you still see it from an old test URL in the browser, ignore it — the radar app uses POST only.

To fix your Apps Script regardless:

1. Open **Extensions → Apps Script** → delete **all** existing code.
2. Paste the **entire** [`google-apps-script/Code.gs`](google-apps-script/Code.gs) file from this repo.
3. Set `SECRET` to match `app.js`.
4. **Save**, then **Deploy → Manage deployments** → pencil → **New version** → **Deploy**.

### 401 Unauthorized

This almost always means the **secret in your deployed Apps Script does not match** `CONFIG.SECRET` in `app.js`.

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Set `SECRET` at the top of `Code.gs` to the **exact same value** as in `app.js`.
3. **Deploy → Manage deployments** → click the pencil icon → **New version** → **Deploy**.
   (Saving the script is not enough — you must redeploy a new version.)
4. Confirm deployment settings: **Execute as: Me**, **Who has access: Anyone**.

**Quick test:** Paste this in your browser (fill in your values):

```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?secret=YOUR_SECRET&street=Test&direction=N&speed=25&deviceId=test
```

| Browser shows | Meaning |
|---------------|---------|
| `{"ok":true}` | Working — check the sheet for a Test row |
| `{"ok":false,"error":"Unauthorized...` | SECRET mismatch — fix Code.gs and redeploy |
| Google sign-in page | Deployment access is not set to **Anyone** |

### Other issues

- **Nothing appears in the sheet** — Confirm `SCRIPT_URL` and `SECRET` match between `app.js` and deployed `Code.gs`. Redeploy after every `Code.gs` change.
- **"Sheet URL not configured"** — Replace the placeholder values in `CONFIG`.
- **Pending queue not clearing** — Check network connection and deployment access.
