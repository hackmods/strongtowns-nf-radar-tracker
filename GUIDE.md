# Strong Towns Speed Radar — Activity Guide

> **Shareable web version:** [guide.html](guide.html) — email this link to volunteers and chapter organizers.

A playbook for local Strong Towns chapters running a monthly community speed radar event, collecting data with the tracker, and publishing results for advocacy.

## Overview

1. **Before** — set up Google Sheet, tracker site, and volunteers
2. **During** — log speeds on priority streets
3. **After** — export CSV, publish results page, share with chapter and council

---

## Before the event

### One-time setup

Follow [README.md](README.md) to configure:

- Google Sheet + Apps Script
- [`app.js`](app.js) with your `SCRIPT_URL` and `SECRET`
- GitHub Pages hosting
- [`logo.png`](logo.png) for your chapter (optional)

### Plan the session

- Pick **2–5 streets** where speeding is a known concern
- Agree on a **speed threshold** for results (default **50 km/h** in manifest; use **40** for residential-focused events)
- Assign volunteers with radar guns or phone apps that read speed
- Share the tracker URL and password with volunteers

---

## During the event

1. Volunteers open the tracker (`index.html`) on their phones
2. For each reading: enter **street**, **direction** (optional), and **speed (km/h)**
3. Street name and direction persist between entries for fast logging on the same block
4. Data syncs to your shared Google Sheet in near real time

**Tips:**

- Use consistent street spelling (e.g. always "Main St", not "main street")
- Record direction when it matters (one-way pairs, uphill vs downhill)
- Aim for **at least 3 readings per street** so results charts include that street

---

## After the event — publish results

### 1. Export CSV from Google Sheets

1. Open your Google Sheet
2. **File → Download → Comma Separated Values (.csv)**
3. Save as `data/events/<slug>.csv` (e.g. `data/events/2026-06-june.csv`)

### 2. Update the manifest

Edit [`data/manifest.json`](data/manifest.json) and add an event entry:

```json
{
  "slug": "2026-06-june",
  "title": "June 2026 Community Speed Radar",
  "description": "What streets you monitored and why — plain language for the public.",
  "date": "2026-06-28",
  "csv": "data/events/2026-06-june.csv",
  "speedThreshold": 50
}
```

Optional: add `"volunteers": 5` when the real headcount differs from unique devices in the CSV (e.g. shared phones).

| Field | Required | Notes |
|-------|----------|-------|
| `slug` | Yes | URL-safe id, used in `results.html?event=slug` |
| `title` | Yes | Shown in results header |
| `description` | Yes | Context for readers and council |
| `date` | Yes | ISO date `YYYY-MM-DD` |
| `csv` | Yes | Path to committed CSV file |
| `speedThreshold` | No | km/h for "% over X" stats; **defaults to 50** |
| `volunteers` | No | Headcount override for the Event snapshot; **defaults to unique device IDs in the CSV** |

Add new events to the `events` array. The results page shows the newest event by default.

### 3. Push to GitHub

```bash
git add data/
git commit -m "Publish June 2026 speed radar results"
git push
```

Results go live at `https://<username>.github.io/<repo>/results.html` after GitHub Pages deploys.

### 4. Share

- Chapter email / social media
- Local council or traffic committee
- Monthly meetup discussion

---

## Understanding the results

The results page computes stats from your CSV — no manual analysis needed.

| Stat | What it means |
|------|----------------|
| **Median speed** | The middle value — typical driver, not skewed by one outlier |
| **85th percentile** | Speed at or below which 85% of drivers traveled; familiar to traffic engineers |
| **% over threshold** | Share of vehicles faster than your `speedThreshold` (default 50 km/h) |
| **Highest recorded** | Worst single reading — useful as a headline, not the typical speed |

**Per-street section** compares streets side-by-side: median, 85th percentile, and % over threshold for each location.

When presenting to council, lead with:

1. How many readings and streets (credibility)
2. % over threshold (the problem in one number)
3. Which streets scored worst (where to act)

---

## Replicating for other chapters

1. **Fork** this repository
2. Configure [`app.js`](app.js) and Google Apps Script (see README)
3. Replace [`logo.png`](logo.png) and set `chapter` in [`data/manifest.json`](data/manifest.json)
4. Customize header text in [`index.html`](index.html) if desired
5. Run monthly — export CSV and add a new manifest entry each time

No build tools or server required. Everything runs on GitHub Pages.

---

## Shutting down after you're done

1. **Deploy → Manage deployments** — disable or delete the Apps Script web app
2. Optionally take down GitHub Pages
3. Archive or delete the Google Sheet

See README security notes — the tracker password and script secret are not high-security measures; they're fine for a community event but should be retired when the event ends.
