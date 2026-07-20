const CONFIG = {
  SCRIPT_URL: 'AKfycbzcLKEZ9c39ZvtLrvfRNQvtnPseQc_bZaHb0bGTqN1p7k-YFGrdraiFhcvgKSUxT-HVbA',
  SECRET: 'fk4BGdEGYd5GZRYkwNvjC3s5',
  PASSWORD_REQUIRED: false,
  PASSWORD: 'Eddie',
  COOKIE_NAME: 'stnf_radar_unlocked',
  COOKIE_DAYS: 7,
  DEVICE_ID_KEY: 'stnf_device_id',
  QUEUE_KEY: 'stnf_pending_queue',
  DIRECTION_KEY: 'stnf_direction',
  STREET_KEY: 'stnf_street',
  RECENT_KEY: 'stnf_recent_log',
  MAX_RECENT: 20,
  SPEED_MAX: 250,
};

const SPEED_UNIT = 'km/hr';

const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const app = document.getElementById('app');
const radarForm = document.getElementById('radar-form');
const formError = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');
const deviceIdEl = document.getElementById('device-id');
const queueLine = document.getElementById('queue-line');
const queueCountEl = document.getElementById('queue-count');
const streetInput = document.getElementById('street');
const speedInput = document.getElementById('speed');
const recentSection = document.getElementById('recent-section');
const recentList = document.getElementById('recent-list');
const dirButtons = document.querySelectorAll('.dir-btn');

let selectedDirection = localStorage.getItem(CONFIG.DIRECTION_KEY) || '';

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
}

function isUnlocked() {
  if (!CONFIG.PASSWORD_REQUIRED) return true;
  return getCookie(CONFIG.COOKIE_NAME) === '1';
}

function unlock() {
  setCookie(CONFIG.COOKIE_NAME, '1', CONFIG.COOKIE_DAYS);
  loginOverlay.hidden = true;
  app.hidden = false;
}

function showLogin() {
  loginOverlay.hidden = false;
  app.hidden = true;
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getDeviceId() {
  let id = localStorage.getItem(CONFIG.DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(CONFIG.DEVICE_ID_KEY, id);
  }
  return id;
}

function truncateId(id) {
  return id.slice(0, 8) + '…';
}

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function setQueue(queue) {
  localStorage.setItem(CONFIG.QUEUE_KEY, JSON.stringify(queue));
}

function updateQueueUI() {
  const count = getQueue().length;
  queueLine.hidden = count === 0;
  queueCountEl.textContent = String(count);
}

function updateDirectionUI() {
  dirButtons.forEach((btn) => {
    const active = btn.dataset.direction === selectedDirection;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function initDirectionButtons() {
  dirButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.direction;
      if (selectedDirection === dir) {
        selectedDirection = '';
        localStorage.removeItem(CONFIG.DIRECTION_KEY);
      } else {
        selectedDirection = dir;
        localStorage.setItem(CONFIG.DIRECTION_KEY, dir);
      }
      updateDirectionUI();
    });
  });
  updateDirectionUI();
}

function getRecentLog() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentEntry(entry) {
  const log = getRecentLog();
  log.unshift(entry);
  localStorage.setItem(CONFIG.RECENT_KEY, JSON.stringify(log.slice(0, CONFIG.MAX_RECENT)));
  renderRecentLog();
}

function formatRecentTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

function renderRecentLog() {
  const log = getRecentLog();
  recentSection.hidden = log.length === 0;
  recentList.innerHTML = '';

  log.forEach((entry) => {
    const li = document.createElement('li');
    const dir = entry.direction ? ' ' + entry.direction : '';
    li.innerHTML =
      '<span class="recent-main">' + escapeHtml(entry.street) + dir + ' · ' + entry.speed + ' ' + SPEED_UNIT + '</span>' +
      '<span class="recent-meta">' + formatRecentTime(entry.timestamp) + '</span>';
    recentList.appendChild(li);
  });
}

function persistStreet() {
  const street = streetInput.value.trim();
  if (street) {
    localStorage.setItem(CONFIG.STREET_KEY, street);
  } else {
    localStorage.removeItem(CONFIG.STREET_KEY);
  }
}

function restoreFormState() {
  const savedStreet = localStorage.getItem(CONFIG.STREET_KEY);
  if (savedStreet) {
    streetInput.value = savedStreet;
  }
  selectedDirection = localStorage.getItem(CONFIG.DIRECTION_KEY) || '';
  updateDirectionUI();
  renderRecentLog();
}

function buildPayload(street, direction, speed) {
  return {
    secret: CONFIG.SECRET,
    timestamp: new Date().toISOString(),
    street,
    direction: direction || '',
    speed,
    unit: 'km/h',
    deviceId: getDeviceId(),
  };
}

function getScriptUrl() {
  const raw = CONFIG.SCRIPT_URL.trim();

  if (!raw.includes('/')) {
    return 'https://script.google.com/macros/s/' + raw + '/exec';
  }

  const match = raw.match(/\/macros(?:\/u\/\d+)?\/s\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return 'https://script.google.com/macros/s/' + match[1] + '/exec';
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.split('?')[0];
  }

  return 'https://script.google.com/macros/s/' + raw + '/exec';
}

function isConfigured() {
  return (
    CONFIG.SCRIPT_URL &&
    CONFIG.SCRIPT_URL !== 'PASTE_YOUR_APPS_SCRIPT_URL_HERE' &&
    CONFIG.SECRET &&
    CONFIG.SECRET !== 'PASTE_YOUR_SECRET_HERE'
  );
}

async function sendToSheet(payload) {
  if (!isConfigured()) {
    throw new Error('Sheet URL not configured. See README for setup.');
  }

  await fetch(getScriptUrl(), {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });
}

async function flushQueue() {
  if (!isConfigured()) return;

  const queue = getQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const payload of queue) {
    try {
      await sendToSheet(payload);
    } catch {
      remaining.push(payload);
    }
  }
  setQueue(remaining);
  updateQueueUI();
}

async function submitReading(street, direction, speed) {
  const payload = buildPayload(street, direction, speed);

  try {
    await sendToSheet(payload);
    await flushQueue();
    addRecentEntry({
      timestamp: payload.timestamp,
      street,
      direction,
      speed,
    });
    return true;
  } catch {
    const queue = getQueue();
    queue.push(payload);
    setQueue(queue);
    updateQueueUI();
    return false;
  }
}

function validateForm(street, speed) {
  if (!street) return 'Street is required.';
  if (!Number.isFinite(speed) || speed < 1 || speed > CONFIG.SPEED_MAX) {
    return 'Speed must be between 1 and ' + CONFIG.SPEED_MAX + ' ' + SPEED_UNIT + '.';
  }
  return null;
}

function showFormError(message) {
  if (message) {
    formError.textContent = message;
    formError.hidden = false;
    formError.setAttribute('aria-hidden', 'false');
  } else {
    formError.textContent = '';
    formError.hidden = true;
    formError.setAttribute('aria-hidden', 'true');
  }
}

function flashSuccess() {
  const original = submitBtn.textContent;
  submitBtn.textContent = 'Logged!';
  submitBtn.classList.add('success');
  submitBtn.disabled = true;

  setTimeout(() => {
    submitBtn.textContent = original;
    submitBtn.classList.remove('success');
    submitBtn.disabled = false;
  }, 1200);
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  if (password === CONFIG.PASSWORD) {
    loginError.hidden = true;
    unlock();
    document.getElementById('password').value = '';
  } else {
    loginError.hidden = false;
  }
});

radarForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showFormError(null);

  const street = streetInput.value.trim();
  const direction = selectedDirection;
  const speed = Number(speedInput.value);
  const error = validateForm(street, speed);
  if (error) {
    showFormError(error);
    if (!street) streetInput.focus();
    else speedInput.focus();
    return;
  }

  submitBtn.disabled = true;
  const ok = await submitReading(street, direction, speed);
  submitBtn.disabled = false;

  persistStreet();
  speedInput.value = '';
  flashSuccess();
  speedInput.focus();

  if (!ok) {
    showFormError('Saved locally — will retry when connection allows.');
  }
});

streetInput.addEventListener('change', persistStreet);

function init() {
  if (isUnlocked()) {
    unlock();
  } else {
    showLogin();
  }

  initDirectionButtons();
  restoreFormState();

  try {
    deviceIdEl.textContent = truncateId(getDeviceId());
  } catch {
    deviceIdEl.textContent = 'unknown';
  }
  updateQueueUI();

  if (isConfigured()) {
    flushQueue();
  }
}

init();
