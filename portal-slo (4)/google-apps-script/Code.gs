/**
 * PORTAL SLO - Server login berbasis Google Sheet.
 * Tempel di Extensions > Apps Script pada spreadsheet yang berisi tab "Akun".
 * Password dicek di sini (di sisi Google); browser hanya menerima data akun tanpa password.
 */
var SHEET_NAME = 'Akun';
var HEADERS = ['username', 'password', 'nama', 'email', 'role', 'group', 'inspectorId', 'pjtName', 'aktif'];
var ROLES = ['direktur', 'teknis', 'sales', 'pjt', 'inspektor', 'klien'];
var MAX_FAIL = 5;      // salah berturut-turut sebelum dikunci
var LOCK_SECONDS = 600; // lama kunci (detik)

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    out = login_(String(req.username || '').trim().toLowerCase(), String(req.password || ''));
  } catch (err) {
    out = { ok: false, error: 'Permintaan tidak valid.' };
  }
  return json_(out);
}

function doGet() {
  return json_({ ok: true, service: 'Portal SLO Login' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function login_(username, password) {
  if (!username || !password) return { ok: false, error: 'Username dan password wajib diisi.' };

  var cache = CacheService.getScriptCache();
  var failKey = 'fail:' + username;
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_FAIL) {
    return { ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.' };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, error: 'Tab "Akun" belum dibuat di Google Sheet.' };

  var data = sheet.getDataRange().getValues();
  var head = data[0].map(function (h) { return String(h).trim(); });
  var col = {};
  HEADERS.forEach(function (h) { col[h] = head.indexOf(h); });
  if (col.username < 0 || col.password < 0 || col.role < 0) {
    return { ok: false, error: 'Header tab "Akun" tidak lengkap.' };
  }

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[col.username]).trim().toLowerCase() !== username) continue;
    if (!isActive_(col.aktif < 0 ? 'TRUE' : row[col.aktif])) break;
    if (!checkPassword_(String(row[col.password]), password)) break;
    var role = String(row[col.role]).trim().toLowerCase();
    if (ROLES.indexOf(role) < 0) return { ok: false, error: 'Role akun tidak valid di Google Sheet.' };
    cache.remove(failKey);
    var get = function (k) { return col[k] < 0 ? '' : String(row[col[k]]).trim(); };
    var acc = {
      id: 'acc-' + username,
      username: username,
      name: get('nama') || username,
      email: get('email'),
      role: role,
      group: get('group') || 'Klien'
    };
    if (get('inspectorId')) acc.inspectorId = get('inspectorId');
    if (get('pjtName')) acc.pjtName = get('pjtName');
    return { ok: true, account: acc };
  }

  cache.put(failKey, String(fails + 1), LOCK_SECONDS);
  return { ok: false, error: 'Username atau password tidak sesuai.' };
}

function isActive_(v) {
  var s = String(v).trim().toLowerCase();
  return !(s === 'false' || s === 'tidak' || s === 'n' || s === '0' || s === 'nonaktif');
}

function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Password di sheet bisa teks biasa, atau "sha256:<salt>:<hash>" setelah diamankan. */
function checkPassword_(stored, input) {
  if (stored.indexOf('sha256:') === 0) {
    var p = stored.split(':');
    return p.length === 3 && sha256_(p[1] + input) === p[2];
  }
  return stored === input;
}

function randomPassword_() {
  var chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < 10; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

/** Jalankan SEKALI: membuat tab "Akun" berisi akun awal dengan password ACAK (ditampilkan satu kali). */
function setupAkun() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() > 1) throw new Error('Tab "Akun" sudah berisi data. Hapus isinya dulu bila ingin membuat ulang.');
  var seed = [
    ["direktur", "", "Direktur Utama PT. SDP", "direktur@sabdadutaparamitha.co.id", "direktur", "Direktur", "", "", "TRUE"],
    ["admin", "", "Admin Teknis SDP", "admin@sabdadutaparamitha.co.id", "teknis", "Admin", "", "", "TRUE"],
    ["marketing1", "", "Marketing 1 (Tim Sales)", "marketing1@sabdadutaparamitha.co.id", "sales", "Marketing", "", "", "TRUE"],
    ["marketing2", "", "Marketing 2 (Tim Sales)", "marketing2@sabdadutaparamitha.co.id", "sales", "Marketing", "", "", "TRUE"],
    ["kusno", "", "Kusno Hadi Bitoyo", "kusno@sabdadutaparamitha.co.id", "pjt", "PJT", "i6", "Kusno Hadi Bitoyo", "TRUE"],
    ["fauzan", "", "Ahmad Fauzan Hamdhani", "fauzan@sabdadutaparamitha.co.id", "pjt", "PJT", "i3", "Ahmad Fauzan Hamdhani", "TRUE"],
    ["bagus", "", "Bagus Indra Surya Binardo", "bagus@sabdadutaparamitha.co.id", "inspektor", "Tenaga Teknik", "i1", "", "TRUE"],
    ["frizal", "", "Frizal Aditya Junitio R", "frizal@sabdadutaparamitha.co.id", "inspektor", "Tenaga Teknik", "i2", "", "TRUE"],
    ["ahmad.fauzan", "", "Ahmad Fauzan Hamdhani", "ahmad.fauzan@sabdadutaparamitha.co.id", "inspektor", "Tenaga Teknik", "i3", "", "TRUE"],
    ["yudi", "", "Yudi Surya Prakasa", "yudi@sabdadutaparamitha.co.id", "inspektor", "Tenaga Teknik", "i4", "", "TRUE"],
    ["rozaq", "", "Abdul Rozaq", "rozaq@sabdadutaparamitha.co.id", "inspektor", "Tenaga Teknik", "i5", "", "TRUE"],
    ["klien", "", "Perwakilan Pemohon SLO", "klien@pemohon-slo.id", "klien", "Klien", "", "", "TRUE"]
  ];
  var report = [];
  seed.forEach(function (r) {
    r[1] = randomPassword_();
    report.push(r[0] + '  /  ' + r[1]);
  });
  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#DBEAFE');
  sheet.getRange(2, 1, seed.length, HEADERS.length).setNumberFormat('@').setValues(seed);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
  SpreadsheetApp.getUi().alert('Catat username / password awal (password juga ada di tab Akun):\n\n' + report.join('\n'));
}

/** Menu di Google Sheet: ubah password teks biasa menjadi hash agar tidak terbaca. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Portal SLO')
    .addItem('Amankan password (hash)', 'hashAllPasswords')
    .addToUi();
}

function hashAllPasswords() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Tab "Akun" tidak ditemukan.');
  var head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var c = head.indexOf('password') + 1;
  if (c < 1 || sheet.getLastRow() < 2) return;
  var range = sheet.getRange(2, c, sheet.getLastRow() - 1, 1);
  range.setNumberFormat('@');
  var n = 0;
  var vals = range.getValues().map(function (r) {
    var v = String(r[0]);
    if (!v || v.indexOf('sha256:') === 0) return [v];
    var salt = Utilities.getUuid().slice(0, 8);
    n++;
    return ['sha256:' + salt + ':' + sha256_(salt + v)];
  });
  range.setValues(vals);
  SpreadsheetApp.getActiveSpreadsheet().toast(n + ' password diamankan. Password baru tetap bisa diketik biasa lalu jalankan menu ini lagi.');
}
