/**
 * PORTAL SLO - Server login berbasis Google Sheet.
 * VERSI AMAN: hak akses per peran ditegakkan di server (database & dokumen), hash password berulang,
 * logout di server, cadangan database otomatis.
 * Tempel di Extensions > Apps Script pada spreadsheet yang berisi tab "Akun".
 * Password dicek di sini (di sisi Google); browser hanya menerima data akun tanpa password.
 * Penyimpanan dokumen juga lewat sini: file disimpan di Google Drive PEMILIK script (akun 1),
 * bukan Drive pengunjung. Setiap permintaan file wajib membawa token hasil login.
 */
var SHEET_NAME = 'Akun';
var HEADERS = ['username', 'password', 'nama', 'email', 'role', 'group', 'inspectorId', 'pjtName', 'aktif'];
var ROLES = ['direktur', 'teknis', 'sales', 'pjt', 'inspektor', 'klien'];
var MAX_FAIL = 5;      // salah berturut-turut sebelum dikunci
var LOCK_SECONDS = 600; // lama kunci (detik)
var SESSION_SECONDS = 21600; // masa berlaku token sesi (maks. 6 jam, batas CacheService)
var FOLDER_NAME = 'Portal SLO - Dokumen';
var MAX_FILE_BYTES = 5 * 1024 * 1024; // sama dengan MAX_FILE_BYTES di aplikasi
var MAX_DB_CHARS = 20 * 1024 * 1024;  // batas ukuran database.json
var HASH_ITER = 400;                  // putaran hash password (Apps Script tidak punya bcrypt; jangan terlalu besar agar login tidak lambat)
var FAIL_DELAY_MS = 800;              // jeda tiap login gagal, memperlambat tebak-tebakan password
var BACKUP_EVERY_MS = 10 * 60 * 1000; // cadangan database.json paling cepat tiap 10 menit
var DB_BACKUP_FILE = 'database-backup.json';

/* ====================================================================
 * HAK AKSES (RBAC) - DITEGAKKAN DI SERVER
 * Mode lewat Script Property RBAC_MODE: 'enforce' (default, tolak) atau 'log' (hanya catat di Log eksekusi).
 * Bila ada alur yang tiba-tiba ditolak (error FORBIDDEN), ubah sementara ke 'log', lihat Log eksekusi,
 * lalu sesuaikan tabel di bawah ini.
 * ==================================================================== */
var WRITERS = ['direktur', 'teknis', 'sales', 'pjt', 'inspektor']; // semua peran selain klien
var DOC_ROLES = ['teknis', 'pjt', 'inspektor', 'direktur'];

/** Bagian tingkat-atas database.json -> peran yang boleh mengubahnya. Bagian lain (tak terdaftar) = hanya teknis. 'proj' diatur terpisah. */
var DB_SECTION_ROLES = {
  seq: WRITERS,
  seq2: WRITERS,
  insp: ['teknis'],
  tools: ['teknis'],
  signatures: ['teknis'],
  suratTugas: DOC_ROLES,
  suratJalan: DOC_ROLES,
  jsa: DOC_ROLES,
  docArchives: DOC_ROLES,
  joSoRecords: ['teknis', 'sales', 'direktur'],
  companyDocs: ['teknis', 'sales', 'pjt', 'inspektor']
};

/** Kolom proyek yang boleh diubah semua peran penulis (penanda status alur & riwayat). */
var PROJ_COMMON = ['log', 'status', 'workflowStage'];
/** Kolom proyek tambahan per peran. Peran teknis = semua kolom. Sales boleh menambah proyek baru; hapus proyek hanya teknis. */
var PROJ_FIELDS = {
  sales: ['no', 'perusahaan', 'kota', 'jenis', 'sub', 'kap', 'files', 'penawaran', 'po', 'transfer', 'joSoId', 'salesReadiness', 'salesMessage', 'publishedToWorkMenu'],
  pjt: ['pjtName', 'team', 'pjt', 'docs', 'prepReview', 'reportReview', 'sloNotice', 'leaderMessages', 'adminForwardNote', 'publishedToWorkMenu'],
  inspektor: ['att', 'form', 'finds', 'bap', 'files', 'reports', 'leaderStatus', 'leaderMessages', 'signedScans', 'docTte', 'docs'],
  direktur: ['directorReview', 'docTte', 'signedScans', 'leaderMessages']
};

/** Folder dokumen -> peran yang boleh membaca (r) dan menulis/menghapus (w). Klien hanya boleh ID berawalan "klien-". */
var FILE_ROLES = {
  'surat-tugas': { r: DOC_ROLES, w: DOC_ROLES },
  'surat-jalan': { r: DOC_ROLES, w: DOC_ROLES },
  'jsa': { r: DOC_ROLES, w: DOC_ROLES },
  'scan-ttd': { r: DOC_ROLES, w: DOC_ROLES },
  'laporan': { r: DOC_ROLES, w: ['teknis', 'pjt', 'inspektor'] },
  'inventaris': { r: WRITERS, w: ['teknis', 'sales', 'pjt', 'inspektor'] },
  'skttk': { r: WRITERS, w: ['teknis', 'sales', 'pjt', 'inspektor'] },
  '': { r: ['teknis'], w: ['teknis'] }
};

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var action = String(req.action || 'login');
    if (action === 'login') {
      out = login_(String(req.username || '').trim().toLowerCase(), String(req.password || ''));
    } else if (action === 'logout') {
      CacheService.getScriptCache().remove('sess:' + String(req.token || ''));
      out = { ok: true };
    } else {
      var sess = getSession_(req.token);
      if (!sess) {
        out = { ok: false, error: 'Sesi berakhir. Silakan login ulang.', code: 'AUTH' };
      } else if (action === 'putFile') {
        out = putFile_(req.file, sess.role);
      } else if (action === 'getFile') {
        out = getFile_(String(req.id || ''), sess.role);
      } else if (action === 'getDb') {
        out = sess.role === 'klien' ? { ok: false, error: 'Akun klien tidak punya akses database.' } : getDb_();
      } else if (action === 'putDb') {
        out = (sess.role === 'klien')
          ? { ok: false, error: 'Peran ini tidak boleh menyimpan database.' }
          : putDb_(String(req.state || ''), sess.u, String(req.baseUpdatedAt || ''), sess.role);
      } else if (action === 'dbInfo') {
        out = sess.role === 'klien' ? { ok: false, error: 'Akun klien tidak punya akses database.' } : dbInfo_();
      } else if (action === 'deleteFile') {
        out = deleteFile_(String(req.id || ''), sess.role);
      } else {
        out = { ok: false, error: 'Aksi tidak dikenal.' };
      }
    }
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

  var sheet = getSS_().getSheetByName(SHEET_NAME);
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
    var chk = checkPassword_(String(row[col.password]), password);
    if (!chk.ok) break;
    // Password lama (teks biasa / hash lama) otomatis ditingkatkan ke hash baru saat login berhasil
    if (chk.upgrade) {
      try { sheet.getRange(i + 1, col.password + 1).setNumberFormat('@').setValue(makeHash_(password)); } catch (e) { /* abaikan */ }
    }
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
    return { ok: true, account: acc, token: createSession_(username, role) };
  }

  cache.put(failKey, String(fails + 1), LOCK_SECONDS);
  Utilities.sleep(FAIL_DELAY_MS); // perlambat tebak-tebakan
  return { ok: false, error: 'Username atau password tidak sesuai.' };
}

/* ---------- Sesi (token) ---------- */

function createSession_(username, role) {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('sess:' + token, JSON.stringify({ u: username, role: role }), SESSION_SECONDS);
  return token;
}

function getSession_(token) {
  token = String(token || '');
  if (token.length < 32) return null;
  var raw = CacheService.getScriptCache().get('sess:' + token);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/* ---------- Helper konteks (aman dijalankan dari editor, menu, maupun project standalone) ---------- */

/** Spreadsheet aktif; bila script standalone, pakai Script Property SPREADSHEET_ID. */
function getSS_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('Script ini tidak terikat ke spreadsheet. Buka Apps Script lewat Extensions > Apps Script di spreadsheet, atau isi Script Property SPREADSHEET_ID.');
}

/** Tampilkan pesan: dialog bila ada UI, jika tidak (editor standalone/trigger) cukup dicatat di log. */
function notify_(msg) {
  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    /* tidak ada konteks UI: pesan sudah masuk ke Log eksekusi */
  }
}

/* ---------- Penyimpanan dokumen di Drive pemilik script ---------- */

function getFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* folder terhapus: buat ulang */ }
  }
  var folder = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

/* Subfolder per jenis dokumen (di dalam folder 'Portal SLO - Dokumen'). database.json tetap di folder utama. */
var SUBFOLDERS = {
  'surat-tugas': '1. Surat Tugas',
  'surat-jalan': '2. Surat Jalan Alat',
  'jsa': '3. JSA',
  'scan-ttd': '4. Scan TTD Manual',
  'laporan': '5. Laporan Pengujian',
  'inventaris': '6. Inventaris Perusahaan',
  'skttk': '7. Sertifikat Kompetensi (SKTTK) & K3'
};

/** Tentukan subfolder: pakai petunjuk dari aplikasi, atau tebak dari awalan ID file (kompatibel dengan file lama). */
function folderKeyFor_(id, hint) {
  if (hint && SUBFOLDERS[hint]) return hint;
  var m = /^vault-pdf-doc-(surat-tugas|surat-jalan|jsa)-/.exec(id);
  if (m) return m[1];
  if (/^scan-/.test(id)) return 'scan-ttd';
  if (/^rpt-/.test(id)) return 'laporan';
  if (/^cdoc-/.test(id)) return 'inventaris';
  return '';
}

function getSubFolder_(key) {
  var root = getFolder_();
  if (!key || !SUBFOLDERS[key]) return root;
  var props = PropertiesService.getScriptProperties();
  var pid = props.getProperty('SUB_' + key);
  if (pid) {
    try {
      var cached = DriveApp.getFolderById(pid);
      if (!cached.isTrashed()) return cached;
    } catch (e) { /* folder terhapus: buat ulang */ }
  }
  var it = root.getFoldersByName(SUBFOLDERS[key]);
  var folder = it.hasNext() ? it.next() : root.createFolder(SUBFOLDERS[key]);
  props.setProperty('SUB_' + key, folder.getId());
  return folder;
}

/** Cari file berdasarkan nama (= ID) di folder utama lalu di semua subfolder. */
function findFileAnywhere_(id) {
  var root = getFolder_();
  var f = findFile_(root, id);
  if (f) return f;
  var subs = root.getFolders();
  while (subs.hasNext()) {
    f = findFile_(subs.next(), id);
    if (f) return f;
  }
  return null;
}

function validId_(id) {
  return /^[A-Za-z0-9._-]{1,120}$/.test(id);
}

function findFile_(folder, id) {
  var it = folder.getFilesByName(id);
  return it.hasNext() ? it.next() : null;
}

var FORBIDDEN_FILE = { ok: false, code: 'FORBIDDEN', error: 'Peran Anda tidak boleh mengakses dokumen ini.' };

/** Boleh/tidak peran mengakses folder tertentu. mode: 'r' baca, 'w' tulis/hapus. */
function canFile_(role, key, mode, id) {
  if (role === 'klien') return /^klien-/.test(id);
  var rule = FILE_ROLES[key] || FILE_ROLES[''];
  return rule[mode].indexOf(role) >= 0;
}

/** Folder (kunci) tempat file benar-benar berada. */
function keyOfFile_(file) {
  var it = file.getParents();
  if (!it.hasNext()) return '';
  var pid = it.next().getId();
  var props = PropertiesService.getScriptProperties();
  for (var k in SUBFOLDERS) {
    if (props.getProperty('SUB_' + k) === pid) return k;
  }
  return '';
}

/** Izin harus lolos untuk: folder tujuan, folder menurut awalan ID, dan folder file lama (bila menimpa). */
function fileAllowed_(role, id, hintKey, existing, mode) {
  var keys = [hintKey, folderKeyFor_(id, '')];
  if (existing) keys.push(keyOfFile_(existing));
  for (var i = 0; i < keys.length; i++) {
    if (!canFile_(role, keys[i], mode, id)) return false;
  }
  return true;
}

function putFile_(f, role) {
  if (!f || !validId_(String(f.id || ''))) return { ok: false, error: 'ID file tidak valid.' };
  var m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(String(f.dataUrl || ''));
  if (!m || !m[2]) return { ok: false, error: 'Format file tidak valid.' };
  var bytes = Utilities.base64Decode(m[3]);
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, error: 'File melebihi batas 5 MB.' };
  var mime = String(f.mimeType || m[1] || 'application/octet-stream');
  var key = folderKeyFor_(String(f.id), String(f.folder || ''));
  var old = findFileAnywhere_(f.id);
  if (!fileAllowed_(role, String(f.id), key, old, 'w')) return FORBIDDEN_FILE;
  var folder = getSubFolder_(key);
  if (old) old.setTrashed(true);
  var file = folder.createFile(Utilities.newBlob(bytes, mime, f.id));
  file.setDescription(JSON.stringify({
    name: String(f.name || f.id),
    mimeType: mime,
    size: Number(f.size) || bytes.length,
    savedAt: String(f.savedAt || new Date().toISOString())
  }));
  return { ok: true };
}

function getFile_(id, role) {
  if (!validId_(id)) return { ok: false, error: 'ID file tidak valid.' };
  var file = findFileAnywhere_(id);
  if (!file) return { ok: false, error: 'File tidak ditemukan.', code: 'NOT_FOUND' };
  if (!fileAllowed_(role, id, keyOfFile_(file), null, 'r')) return FORBIDDEN_FILE;
  var meta = {};
  try { meta = JSON.parse(file.getDescription() || '{}'); } catch (e) {}
  var mime = meta.mimeType || file.getMimeType();
  var blob = file.getBlob();
  return {
    ok: true,
    file: {
      id: id,
      name: meta.name || id,
      mimeType: mime,
      size: meta.size || blob.getBytes().length,
      savedAt: meta.savedAt || '',
      dataUrl: 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes())
    }
  };
}

function deleteFile_(id, role) {
  if (!validId_(id)) return { ok: false, error: 'ID file tidak valid.' };
  var file = findFileAnywhere_(id);
  if (file) {
    if (role === 'klien' || !fileAllowed_(role, id, keyOfFile_(file), null, 'w')) return FORBIDDEN_FILE;
    file.setTrashed(true);
  }
  return { ok: true };
}

/* ---------- Database proyek (satu file JSON di folder yang sama) ---------- */

var DB_FILE = 'database.json';

function dbMeta_(f) {
  try { return JSON.parse(f.getDescription() || '{}'); } catch (e) { return {}; }
}

/** baseUpdatedAt = versi server yang dipegang klien; bila server sudah lebih baru -> CONFLICT (cegah menimpa data orang lain). */
function putDb_(stateJson, username, baseUpdatedAt, role) {
  if (stateJson.length > MAX_DB_CHARS) return { ok: false, error: 'Data database terlalu besar.' };
  var newState;
  try { newState = JSON.parse(stateJson); } catch (e) { return { ok: false, error: 'Data database tidak valid.' }; }
  if (!newState || typeof newState !== 'object' || Array.isArray(newState)) return { ok: false, error: 'Data database tidak valid.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var folder = getFolder_();
    var f = findFile_(folder, DB_FILE);
    if (f && String(dbMeta_(f).updatedAt || '') !== baseUpdatedAt) {
      return { ok: false, code: 'CONFLICT', error: 'Data di server sudah diperbarui pengguna lain.' };
    }
    if (f) {
      // Hak akses: bandingkan dengan isi di server; tolak perubahan di bagian yang bukan hak peran ini.
      var oldRaw = f.getBlob().getDataAsString();
      var oldState = {};
      try { oldState = JSON.parse(oldRaw); } catch (e) { /* database lama rusak: lewati pembandingan */ }
      var bad = rbacCheck_(role, oldState, newState);
      if (bad) {
        Logger.log('RBAC: ' + username + ' (' + role + ') mengubah ' + bad);
        var mode = PropertiesService.getScriptProperties().getProperty('RBAC_MODE') || 'enforce';
        if (mode !== 'log') {
          return { ok: false, code: 'FORBIDDEN', error: 'Perubahan pada ' + bad + ' tidak diizinkan untuk peran ini.' };
        }
      }
      backupDb_(folder, oldRaw);
      f.setContent(stateJson);
    } else {
      f = folder.createFile(DB_FILE, stateJson, 'application/json');
    }
    var at = new Date().toISOString();
    f.setDescription(JSON.stringify({ updatedAt: at, updatedBy: username }));
    return { ok: true, updatedAt: at, folderUrl: folder.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

/** Salinan cadangan database.json (paling cepat tiap 10 menit) untuk memulihkan data bila ada yang rusak. */
function backupDb_(folder, oldRaw) {
  try {
    var b = findFile_(folder, DB_BACKUP_FILE);
    if (b) {
      if (Date.now() - b.getLastUpdated().getTime() < BACKUP_EVERY_MS) return;
      b.setContent(oldRaw);
    } else {
      folder.createFile(DB_BACKUP_FILE, oldRaw, 'application/json');
    }
  } catch (e) { /* cadangan gagal tidak boleh menggagalkan penyimpanan */ }
}

/** Bentuk kanonik (urutan kunci diurutkan) agar perbandingan JSON tidak terpengaruh urutan properti. */
function canon_(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canon_).join(',') + ']';
  return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon_(v[k]); }).join(',') + '}';
}

/** null bila perubahan sah; selain itu teks nama bagian yang dilanggar. */
function rbacCheck_(role, oldS, newS) {
  if (role === 'teknis') return null;
  var keys = {};
  Object.keys(oldS || {}).forEach(function (k) { keys[k] = 1; });
  Object.keys(newS || {}).forEach(function (k) { keys[k] = 1; });
  var names = Object.keys(keys);
  for (var i = 0; i < names.length; i++) {
    var k = names[i];
    if (k === 'role') continue; // peran milik sesi masing-masing, tidak dipakai
    if (k === 'proj') {
      var m = checkProj_(role, oldS.proj || [], newS.proj || []);
      if (m) return m;
      continue;
    }
    var allowed = DB_SECTION_ROLES[k];
    if (allowed && allowed.indexOf(role) >= 0) continue;
    if (canon_(oldS[k]) !== canon_(newS[k])) return 'bagian "' + k + '"';
  }
  return null;
}

function checkProj_(role, oldP, newP) {
  if (!Array.isArray(oldP) || !Array.isArray(newP)) return 'bagian "proj"';
  var oldMap = {}, newMap = {};
  oldP.forEach(function (p) { if (p && p.id) oldMap[p.id] = p; });
  newP.forEach(function (p) { if (p && p.id) newMap[p.id] = p; });
  var id;
  for (id in oldMap) {
    if (!newMap[id]) return 'hapus proyek ' + id; // hapus proyek hanya teknis
  }
  var allowed = PROJ_COMMON.concat(PROJ_FIELDS[role] || []);
  for (id in newMap) {
    if (!oldMap[id]) {
      if (role !== 'sales') return 'tambah proyek ' + id;
      continue;
    }
    var o = oldMap[id], n = newMap[id], seen = {};
    var fields = Object.keys(o).concat(Object.keys(n));
    for (var j = 0; j < fields.length; j++) {
      var f = fields[j];
      if (seen[f]) continue;
      seen[f] = 1;
      if (allowed.indexOf(f) >= 0) continue;
      if (canon_(o[f]) !== canon_(n[f])) return 'proyek ' + id + ' kolom "' + f + '"';
    }
  }
  return null;
}

/** Ringan: hanya versi terakhir, dipakai untuk cek perubahan berkala. */
function dbInfo_() {
  var f = findFile_(getFolder_(), DB_FILE);
  if (!f) return { ok: false, code: 'NOT_FOUND', error: 'Belum ada database di server.' };
  return { ok: true, updatedAt: dbMeta_(f).updatedAt || '' };
}

function getDb_() {
  var folder = getFolder_();
  var f = findFile_(folder, DB_FILE);
  if (!f) return { ok: false, error: 'Belum ada database di server. Simpan dulu dari akun Admin.', code: 'NOT_FOUND' };
  var meta = dbMeta_(f);
  return { ok: true, state: f.getBlob().getDataAsString(), updatedAt: meta.updatedAt || '', updatedBy: meta.updatedBy || '', folderUrl: folder.getUrl() };
}

/** Jalankan SEKALI setelah menempel kode baru: membuat folder dokumen & meminta izin Drive. */
function setupDokumen() {
  var f = getFolder_();
  Object.keys(SUBFOLDERS).forEach(function (k) { getSubFolder_(k); });
  notify_('Folder dokumen siap di Drive Anda:\n' + f.getName() + '\n' + f.getUrl());
}

/**
 * Jalankan SEKALI untuk merapikan file lama: memindahkan PDF Surat Tugas / Surat Jalan / JSA,
 * scan TTD, laporan, dan dokumen inventaris dari folder utama ke subfolder masing-masing.
 * database.json tidak dipindah. Aman dijalankan berulang.
 */
function rapikanFolder() {
  var root = getFolder_();
  var list = [];
  var it = root.getFiles();
  while (it.hasNext()) list.push(it.next());
  var moved = 0;
  list.forEach(function (file) {
    var name = file.getName();
    if (name === DB_FILE) return;
    var key = folderKeyFor_(name, '');
    if (!key) return;
    file.moveTo(getSubFolder_(key));
    moved++;
  });
  notify_('Folder dirapikan. File dipindahkan: ' + moved + '\n' + root.getUrl());
}

function isActive_(v) {
  var s = String(v).trim().toLowerCase();
  return !(s === 'false' || s === 'tidak' || s === 'n' || s === '0' || s === 'nonaktif');
}

function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** SHA-256 berulang (HASH_ITER putaran) dengan salt. */
function hashPw_(salt, pw, iter) {
  var base = Utilities.newBlob(salt + ':' + pw).getBytes();
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, base);
  for (var i = 1; i < iter; i++) h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h.concat(base));
  return hex_(h);
}

/** Format tersimpan: sha256i:<putaran>:<salt>:<hash> */
function makeHash_(pw) {
  var salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  return 'sha256i:' + HASH_ITER + ':' + salt + ':' + hashPw_(salt, pw, HASH_ITER);
}

function safeEq_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * Password di sheet: teks biasa (lama), "sha256:<salt>:<hash>" (lama), atau "sha256i:..." (baru).
 * upgrade=true bila cocok tetapi masih format lama -> akan ditulis ulang ke format baru.
 */
function checkPassword_(stored, input) {
  var p;
  if (stored.indexOf('sha256i:') === 0) {
    p = stored.split(':');
    var iter = Number(p[1]);
    if (p.length !== 4 || !(iter > 0) || iter > 5000) return { ok: false, upgrade: false };
    return { ok: safeEq_(hashPw_(p[2], input, iter), p[3]), upgrade: false };
  }
  if (stored.indexOf('sha256:') === 0) {
    p = stored.split(':');
    var okOld = p.length === 3 && safeEq_(sha256_(p[1] + input), p[2]);
    return { ok: okOld, upgrade: okOld };
  }
  var okPlain = safeEq_(stored, input);
  return { ok: okPlain, upgrade: okPlain };
}

function randomPassword_() {
  var chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var hex = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var out = '';
  for (var i = 0; i < 14; i++) out += chars.charAt(parseInt(hex.substr(i * 2, 2), 16) % chars.length);
  return out;
}

/** Jalankan SEKALI: membuat tab "Akun" berisi akun awal dengan password ACAK (ditampilkan satu kali). */
function setupAkun() {
  var ss = getSS_();
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
  notify_('Catat username / password awal (password juga ada di tab Akun):\n\n' + report.join('\n'));
}

/** Menu di Google Sheet: ubah password teks biasa menjadi hash agar tidak terbaca. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Portal SLO')
    .addItem('Amankan password (hash)', 'hashAllPasswords')
    .addToUi();
}

function hashAllPasswords() {
  var sheet = getSS_().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Tab "Akun" tidak ditemukan.');
  var head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var c = head.indexOf('password') + 1;
  if (c < 1 || sheet.getLastRow() < 2) return;
  var range = sheet.getRange(2, c, sheet.getLastRow() - 1, 1);
  range.setNumberFormat('@');
  var n = 0;
  var vals = range.getValues().map(function (r) {
    var v = String(r[0]);
    if (!v || v.indexOf('sha256i:') === 0) return [v];
    n++;
    return [makeHash_(v)];
  });
  range.setValues(vals);
  var done = n + ' password diamankan (hash baru). Password baru tetap bisa diketik biasa lalu jalankan menu ini lagi.';
  Logger.log(done);
  try { getSS_().toast(done); } catch (e) { /* tanpa UI */ }
}
