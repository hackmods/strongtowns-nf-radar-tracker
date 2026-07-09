const DEFAULT_THRESHOLD = 50;
const SPEED_UNIT = 'km/hr';
const MIN_STREET_READINGS = 3;
const SPEED_BUCKETS = [
  { label: '<30', min: 0, max: 30 },
  { label: '30–40', min: 30, max: 40 },
  { label: '40–50', min: 40, max: 50 },
  { label: '50–60', min: 50, max: 60 },
  { label: '60+', min: 60, max: Infinity },
];

const CHART_COLORS = {
  navy: '#1a2f4d',
  navyMid: '#2a4570',
  accent: '#8ecae6',
  accentDark: '#5a9cb5',
  palette: ['#1a2f4d', '#2a4570', '#5a9cb5', '#8ecae6', '#a8c5d9', '#c4d9e8'],
};

let chartInstances = {};
let currentRows = [];
let currentEvent = null;
let streetGroups = {};

const els = {
  chapterEyebrow: document.getElementById('chapter-eyebrow'),
  eventTitle: document.getElementById('event-title'),
  eventDate: document.getElementById('event-date'),
  eventDescription: document.getElementById('event-description'),
  eventPickerWrap: document.getElementById('event-picker-wrap'),
  eventPicker: document.getElementById('event-picker'),
  loading: document.getElementById('loading'),
  errorState: document.getElementById('error-state'),
  resultsContent: document.getElementById('results-content'),
  credibilityStats: document.getElementById('credibility-stats'),
  speedStats: document.getElementById('speed-stats'),
  thresholdCallout: document.getElementById('threshold-callout'),
  thresholdColHeader: document.getElementById('threshold-col-header'),
  streetTableBody: document.getElementById('street-table-body'),
  streetThresholdWrap: document.getElementById('street-threshold-wrap'),
  streetThresholdTitle: document.getElementById('street-threshold-title'),
  streetDistTabs: document.getElementById('street-dist-tabs'),
  streetDetailGrid: document.getElementById('street-detail-grid'),
  streetDirectionWrap: document.getElementById('street-direction-wrap'),
  streetDirectionTitle: document.getElementById('street-direction-title'),
  hourlySection: document.getElementById('hourly-section'),
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(header) {
  return header.replace(/^\ufeff/, '').trim().toLowerCase();
}

function findHeaderKey(headers, predicates) {
  for (let i = 0; i < headers.length; i++) {
    const norm = normalizeHeader(headers[i]);
    if (predicates.some((fn) => fn(norm, headers[i]))) {
      return headers[i];
    }
  }
  return null;
}

function mapHeaders(headers) {
  return {
    timestamp: findHeaderKey(headers, [
      (h) => h === 'timestamp',
      (h) => h.includes('time') && h.includes('stamp'),
      (h) => h === 'time' || h === 'date',
    ]),
    street: findHeaderKey(headers, [(h) => h === 'street' || h.includes('street')]),
    direction: findHeaderKey(headers, [(h) => h === 'direction' || h === 'dir']),
    speed: findHeaderKey(headers, [
      (h) => h.includes('speed'),
      (h) => h.includes('km/h') || h.includes('kmh') || h.includes('kmhr'),
    ]),
    deviceId: findHeaderKey(headers, [
      (h) => h === 'deviceid' || h.replace(/\s/g, '') === 'deviceid',
      (h) => h === 'device' || h === 'device id',
    ]),
  };
}

function parseSpeedValue(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const cleaned = String(raw).replace(/,/g, '.').replace(/[^\d.-]/g, '');
  const speed = Number(cleaned);
  return Number.isFinite(speed) ? speed : null;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row.');
  }
  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const columnMap = mapHeaders(headers);
  if (!columnMap.speed) {
    throw new Error('Could not find a speed column. Expected a header containing "Speed" (e.g. "Speed (km/h)").');
  }
  if (!columnMap.street) {
    throw new Error('Could not find a Street column in the CSV.');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(normalizeRow(row, columnMap));
  }
  const valid = rows.filter((r) => r.speed !== null && r.street);
  if (valid.length === 0 && rows.length > 0) {
    throw new Error('No rows with a valid street and speed. Check the speed column in your CSV.');
  }
  return valid;
}

function normalizeRow(raw, columnMap) {
  const streetKey = columnMap.street;
  const speedKey = columnMap.speed;
  const directionKey = columnMap.direction;
  const timestampKey = columnMap.timestamp;
  const deviceKey = columnMap.deviceId;

  const street = String(streetKey ? raw[streetKey] : raw.Street || '').trim();
  const speed = parseSpeedValue(speedKey ? raw[speedKey] : raw['Speed (km/h)'] ?? raw.Speed);
  const direction = String(directionKey ? raw[directionKey] : raw.Direction || '').trim().toUpperCase();
  const timestamp = timestampKey ? raw[timestampKey] : raw.Timestamp || '';
  const deviceId = String(deviceKey ? raw[deviceKey] : raw.DeviceId || '').trim();

  return {
    street,
    speed,
    direction: ['N', 'S', 'E', 'W'].includes(direction) ? direction : '',
    timestamp: timestamp ? new Date(timestamp) : null,
    deviceId,
  };
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function pctOver(values, threshold) {
  if (values.length === 0) return 0;
  return Math.round((values.filter((v) => v > threshold).length / values.length) * 100);
}

function normalizeStreetKey(street) {
  return street.trim().toLowerCase();
}

function groupByStreet(rows) {
  const groups = {};
  rows.forEach((row) => {
    const key = normalizeStreetKey(row.street);
    if (!groups[key]) {
      groups[key] = { name: row.street, rows: [] };
    }
    groups[key].rows.push(row);
  });
  return groups;
}

function bucketCounts(speeds) {
  return SPEED_BUCKETS.map((bucket) => {
    return speeds.filter((s) => {
      if (bucket.max === Infinity) return s >= bucket.min;
      return s >= bucket.min && s < bucket.max;
    }).length;
  });
}

function formatDuration(ms) {
  if (ms < 60000) return '<1m';
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return totalMin + 'm';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? h + 'h ' + m + 'm' : h + 'h';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function destroyCharts() {
  Object.values(chartInstances).forEach((c) => c.destroy());
  chartInstances = {};
}

function statCard(value, label, unit, highlight) {
  const unitHtml = unit ? '<span class="stat-unit"> ' + unit + '</span>' : '';
  return (
    '<div class="stat-card' + (highlight ? ' stat-card--highlight' : '') + '">' +
    '<span class="stat-value">' + value + unitHtml + '</span>' +
    '<span class="stat-label">' + label + '</span>' +
    '</div>'
  );
}

function getThreshold(event) {
  const t = Number(event.speedThreshold);
  return Number.isFinite(t) && t > 0 ? t : DEFAULT_THRESHOLD;
}

function computeSessionLength(rows) {
  const times = rows.map((r) => r.timestamp).filter((t) => t && !isNaN(t));
  if (times.length < 2) return '—';
  const min = Math.min(...times.map((t) => t.getTime()));
  const max = Math.max(...times.map((t) => t.getTime()));
  return formatDuration(max - min);
}

function showHourlyChart(rows) {
  const times = rows.map((r) => r.timestamp).filter((t) => t && !isNaN(t));
  if (times.length < 2) return false;
  const min = Math.min(...times.map((t) => t.getTime()));
  const max = Math.max(...times.map((t) => t.getTime()));
  return max - min >= 2 * 60 * 60 * 1000;
}

function directionCounts(rows) {
  const counts = { N: 0, S: 0, E: 0, W: 0, 'Not recorded': 0 };
  rows.forEach((r) => {
    if (counts[r.direction] !== undefined) counts[r.direction]++;
    else counts['Not recorded']++;
  });
  return counts;
}

function getVolunteerCount(event, rows) {
  const override = Number(event.volunteers);
  if (Number.isFinite(override) && override > 0) {
    return Math.round(override);
  }
  return new Set(rows.map((r) => r.deviceId).filter(Boolean)).size;
}

function renderStatGrids(rows, threshold, event) {
  const speeds = rows.map((r) => r.speed);
  const streets = new Set(rows.map((r) => normalizeStreetKey(r.street)));

  els.credibilityStats.innerHTML =
    statCard(rows.length, 'Readings', '') +
    statCard(streets.size, 'Streets', '') +
    statCard(getVolunteerCount(event, rows), 'Volunteers', '') +
    statCard(computeSessionLength(rows), 'Session', '');

  els.speedStats.innerHTML =
    statCard(Math.round(median(speeds)), 'Median', SPEED_UNIT) +
    statCard(Math.round(percentile(speeds, 85)), '85th %', SPEED_UNIT) +
    statCard(Math.max(...speeds), 'Highest', SPEED_UNIT, true) +
    statCard(pctOver(speeds, threshold) + '%', 'Over ' + threshold, '');

  const pct = pctOver(speeds, threshold);
  els.thresholdCallout.textContent =
    pct + '% of observed vehicles were traveling faster than ' + threshold + ' ' + SPEED_UNIT + '.';
  els.thresholdColHeader.textContent = '% over ' + threshold;
}

function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { font: { size: 11 }, color: CHART_COLORS.navy } },
    },
    scales: {
      x: { ticks: { color: CHART_COLORS.navyMid, font: { size: 10 }, maxRotation: 0 }, grid: { color: '#e8edf3' } },
      y: { ticks: { color: CHART_COLORS.navyMid, font: { size: 10 } }, grid: { color: '#e8edf3' } },
    },
  };
}

function setBarChartHeight(canvasId, itemCount, opts = {}) {
  const { barHeight = 36, padding = 56, min = 220, max = 420 } = opts;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const wrap = canvas.closest('.chart-canvas-wrap');
  if (!wrap) return;
  wrap.style.height = Math.min(max, Math.max(min, itemCount * barHeight + padding)) + 'px';
}

function resizeChart(canvasId) {
  const chart = chartInstances[canvasId];
  if (chart) chart.resize();
}

function setStreetDetailLayout(showDirection) {
  els.streetDetailGrid.classList.toggle('street-detail-grid--solo', !showDirection);
}

function renderDistributionChart(canvasId, speeds) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: SPEED_BUCKETS.map((b) => b.label),
      datasets: [{
        label: 'Vehicles',
        data: bucketCounts(speeds),
        backgroundColor: CHART_COLORS.accentDark,
        borderRadius: 4,
      }],
    },
    options: {
      ...chartDefaults(),
      plugins: { legend: { display: false } },
      scales: {
        ...chartDefaults().scales,
        y: { ...chartDefaults().scales.y, beginAtZero: true, ticks: { ...chartDefaults().scales.y.ticks, stepSize: 1 } },
      },
    },
  });
}

function renderStreetsAvgChart(groups) {
  const qualifying = Object.values(groups)
    .filter((g) => g.rows.length >= MIN_STREET_READINGS)
    .map((g) => ({
      name: g.name,
      avg: g.rows.reduce((s, r) => s + r.speed, 0) / g.rows.length,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  setBarChartHeight('chart-streets-avg', qualifying.length);

  const ctx = document.getElementById('chart-streets-avg').getContext('2d');
  if (chartInstances['chart-streets-avg']) chartInstances['chart-streets-avg'].destroy();
  chartInstances['chart-streets-avg'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: qualifying.map((s) => s.name),
      datasets: [{
        label: 'Avg speed',
        data: qualifying.map((s) => Math.round(s.avg * 10) / 10),
        backgroundColor: CHART_COLORS.navy,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      ...chartDefaults(),
      plugins: { legend: { display: false } },
      scales: {
        ...chartDefaults().scales,
      },
    },
  });
}

function renderDirectionChart(canvasId, rows) {
  const counts = directionCounts(rows);
  const labels = Object.keys(counts).filter((k) => counts[k] > 0);
  const data = labels.map((k) => counts[k]);
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.palette.slice(0, labels.length),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, color: CHART_COLORS.navy, boxWidth: 12, padding: 12 },
        },
      },
    },
  });
}

function renderHourlyChart(rows) {
  const hours = {};
  rows.forEach((r) => {
    if (!r.timestamp || isNaN(r.timestamp)) return;
    const h = r.timestamp.getHours();
    hours[h] = (hours[h] || 0) + 1;
  });
  const labels = Object.keys(hours).sort((a, b) => Number(a) - Number(b)).map((h) => {
    const hour = Number(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return h12 + ' ' + ampm;
  });
  const data = Object.keys(hours).sort((a, b) => Number(a) - Number(b)).map((h) => hours[h]);

  const ctx = document.getElementById('chart-hourly').getContext('2d');
  if (chartInstances['chart-hourly']) chartInstances['chart-hourly'].destroy();
  chartInstances['chart-hourly'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Readings',
        data,
        backgroundColor: CHART_COLORS.navyMid,
        borderRadius: 4,
      }],
    },
    options: {
      ...chartDefaults(),
      plugins: { legend: { display: false } },
    },
  });
}

function renderStreetTable(groups, threshold) {
  const streets = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  els.streetTableBody.innerHTML = streets.map((g) => {
    const speeds = g.rows.map((r) => r.speed);
    return (
      '<tr>' +
      '<td>' + escapeHtml(g.name) + '</td>' +
      '<td>' + g.rows.length + '</td>' +
      '<td>' + Math.round(median(speeds)) + '</td>' +
      '<td>' + Math.round(percentile(speeds, 85)) + '</td>' +
      '<td>' + pctOver(speeds, threshold) + '%</td>' +
      '</tr>'
    );
  }).join('');
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

function renderStreetThresholdChart(groups, threshold) {
  const qualifying = Object.values(groups)
    .filter((g) => g.rows.length >= MIN_STREET_READINGS)
    .map((g) => ({
      name: g.name,
      pct: pctOver(g.rows.map((r) => r.speed), threshold),
    }))
    .sort((a, b) => b.pct - a.pct);

  if (qualifying.length < 2) {
    els.streetThresholdWrap.hidden = true;
    return;
  }

  els.streetThresholdWrap.hidden = false;
  els.streetThresholdTitle.textContent = '% over ' + threshold + ' km/h by street';
  setBarChartHeight('chart-street-threshold', qualifying.length);

  const ctx = document.getElementById('chart-street-threshold').getContext('2d');
  if (chartInstances['chart-street-threshold']) chartInstances['chart-street-threshold'].destroy();
  chartInstances['chart-street-threshold'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: qualifying.map((s) => s.name),
      datasets: [{
        label: '% over ' + threshold + ' km/h',
        data: qualifying.map((s) => s.pct),
        backgroundColor: CHART_COLORS.accentDark,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      ...chartDefaults(),
      plugins: { legend: { display: false } },
      scales: {
        ...chartDefaults().scales,
        x: { ...chartDefaults().scales.x, max: 100, ticks: { ...chartDefaults().scales.x.ticks, callback: (v) => v + '%' } },
      },
    },
  });
}

function renderStreetDistTabs(groups, rows) {
  const qualifying = Object.values(groups).filter((g) => g.rows.length >= MIN_STREET_READINGS);
  els.streetDistTabs.innerHTML = '';

  const tabs = [{ id: 'overall', label: 'Overall', speeds: rows.map((r) => r.speed) }];
  qualifying.forEach((g) => {
    tabs.push({ id: normalizeStreetKey(g.name), label: g.name, speeds: g.rows.map((r) => r.speed), rows: g.rows });
  });

  tabs.forEach((tab, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'street-tab' + (idx === 0 ? ' active' : '');
    btn.textContent = tab.label;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
    btn.addEventListener('click', () => {
      els.streetDistTabs.querySelectorAll('.street-tab').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      renderDistributionChart('chart-street-distribution', tab.speeds);
      if (tab.id === 'overall') {
        els.streetDirectionWrap.hidden = true;
        setStreetDetailLayout(false);
      } else {
        const hasDirection = tab.rows.some((r) => r.direction);
        els.streetDirectionWrap.hidden = !hasDirection;
        setStreetDetailLayout(hasDirection);
        if (hasDirection) {
          els.streetDirectionTitle.textContent = 'Direction on ' + tab.label;
          renderDirectionChart('chart-street-direction', tab.rows);
        }
      }
      requestAnimationFrame(() => {
        resizeChart('chart-street-distribution');
        if (!els.streetDirectionWrap.hidden) resizeChart('chart-street-direction');
      });
    });
    els.streetDistTabs.appendChild(btn);
  });

  renderDistributionChart('chart-street-distribution', tabs[0].speeds);
  els.streetDirectionWrap.hidden = true;
  setStreetDetailLayout(false);
}

function renderResults(rows, event) {
  destroyCharts();
  currentRows = rows;
  currentEvent = event;
  streetGroups = groupByStreet(rows);
  const threshold = getThreshold(event);

  renderStatGrids(rows, threshold, event);
  renderDistributionChart('chart-distribution', rows.map((r) => r.speed));
  renderStreetsAvgChart(streetGroups);
  renderDirectionChart('chart-direction', rows);

  if (showHourlyChart(rows)) {
    els.hourlySection.hidden = false;
    renderHourlyChart(rows);
  } else {
    els.hourlySection.hidden = true;
  }

  renderStreetTable(streetGroups, threshold);
  renderStreetThresholdChart(streetGroups, threshold);
  renderStreetDistTabs(streetGroups, rows);
}

function showError(message) {
  els.loading.hidden = true;
  els.resultsContent.hidden = true;
  els.errorState.hidden = false;
  els.errorState.textContent = message;
}

async function loadEvent(manifest, event) {
  els.loading.hidden = false;
  els.resultsContent.hidden = true;
  els.errorState.hidden = true;

  els.chapterEyebrow.textContent = manifest.chapter + ' · Results';
  els.eventTitle.textContent = event.title;
  els.eventDescription.textContent = event.description || '';
  if (event.date) {
    els.eventDate.textContent = formatDate(event.date);
    els.eventDate.hidden = false;
  } else {
    els.eventDate.hidden = true;
  }

  try {
    const res = await fetch(event.csv);
    if (!res.ok) throw new Error('Could not load CSV at ' + event.csv);
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length === 0) throw new Error('No valid readings found in CSV.');
    renderResults(rows, event);
    els.loading.hidden = true;
    els.resultsContent.hidden = false;
  } catch (err) {
    showError(err.message || 'Failed to load results.');
  }
}

function setupEventPicker(manifest, events, initialSlug) {
  if (events.length <= 1) {
    els.eventPickerWrap.hidden = true;
    return;
  }
  els.eventPickerWrap.hidden = false;
  els.eventPicker.innerHTML = events.map((e) =>
    '<option value="' + escapeHtml(e.slug) + '">' + escapeHtml(e.title) + '</option>'
  ).join('');
  els.eventPicker.value = initialSlug;
  els.eventPicker.addEventListener('change', () => {
    const slug = els.eventPicker.value;
    const event = events.find((e) => e.slug === slug);
    if (event) {
      const url = new URL(window.location);
      url.searchParams.set('event', slug);
      history.replaceState(null, '', url);
      loadEvent(manifest, event);
    }
  });
}

async function init() {
  try {
    const res = await fetch('data/manifest.json');
    if (!res.ok) throw new Error('Could not load data/manifest.json');
    const manifest = await res.json();
    const events = (manifest.events || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (events.length === 0) {
      showError('No results published yet.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get('event');
    let event = events.find((e) => e.slug === slugParam) || events[0];

    setupEventPicker(manifest, events, event.slug);
    await loadEvent(manifest, event);
  } catch (err) {
    showError(err.message || 'Failed to load manifest.');
  }
}

init();
