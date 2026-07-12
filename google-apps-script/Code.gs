/**
 * Strong Towns NF Speed Radar — Google Apps Script
 *
 * SETUP (do all steps):
 * 1. Extensions → Apps Script → delete ALL existing code
 * 2. Paste this ENTIRE file
 * 3. Set SECRET below to match app.js CONFIG.SECRET
 * 4. Save, then Deploy → Manage deployments → pencil → New version → Deploy
 * 5. Execute as: Me | Who has access: Anyone
 *
 * Expected JSON body (text/plain or application/json):
 * {
 *   secret, timestamp, street, direction, speed, unit?, deviceId
 * }
 * Columns: Timestamp | Street | Direction | Speed (km/h) | DeviceId
 */

const SECRET = 'PASTE_YOUR_SECRET_HERE';
const SHEET_NAME = 'Sheet1';
const HEADERS = ['Timestamp', 'Street', 'Direction', 'Speed (km/h)', 'DeviceId'];
const SPEED_MIN = 1;
const SPEED_MAX = 250;
const VALID_DIRECTIONS = ['N', 'S', 'E', 'W', ''];

function doPost(e) {
  try {
    return processSubmission_(parseBody_(e));
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    return processSubmission_(e.parameter || {});
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function parseBody_(e) {
  if (e.parameter && e.parameter.secret) {
    return e.parameter;
  }
  if (e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  return {};
}

function processSubmission_(data) {
  if (data.secret !== SECRET) {
    return jsonResponse({ ok: false, error: 'Unauthorized — secret mismatch' });
  }

  const street = String(data.street || '').trim();
  const direction = String(data.direction || '').trim().toUpperCase();
  const speed = Number(data.speed);
  const timestamp = data.timestamp || new Date().toISOString();
  const deviceId = String(data.deviceId || '').trim();
  // unit is optional metadata from the client (always km/h for this project)
  const unit = String(data.unit || 'km/h').trim().toLowerCase();

  if (!street) return jsonResponse({ ok: false, error: 'Street is required' });
  if (VALID_DIRECTIONS.indexOf(direction) === -1) {
    return jsonResponse({ ok: false, error: 'Invalid direction' });
  }
  if (!Number.isFinite(speed) || speed < SPEED_MIN || speed > SPEED_MAX) {
    return jsonResponse({ ok: false, error: 'Invalid speed' });
  }
  if (unit && unit !== 'km/h' && unit !== 'km/hr' && unit !== 'kmh') {
    return jsonResponse({ ok: false, error: 'Unsupported speed unit' });
  }

  const sheet = getSheet_();
  ensureHeaders_(sheet);
  sheet.appendRow([timestamp, street, direction, speed, deviceId]);

  return jsonResponse({ ok: true });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return;
  }
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (firstRow.every(function (cell) { return cell === '' || cell === null; })) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }
  // Upgrade legacy "Speed" header to "Speed (km/h)" when columns otherwise match
  if (String(firstRow[3]).trim() === 'Speed') {
    sheet.getRange(1, 4).setValue(HEADERS[3]);
  }
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
