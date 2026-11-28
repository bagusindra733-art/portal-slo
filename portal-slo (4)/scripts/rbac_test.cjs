// Uji simulasi: jalankan rbacCheck_ dari Code.gs dengan perubahan yang ditulis klien tiap peran.
// Pakai: npm run test:rbac   (atau: node scripts/rbac_test.cjs [path/ke/Code.gs])
// Tambahkan kasus baru bila ada tombol yang ditolak server (FORBIDDEN).
const vm = require('vm'), fs = require('fs');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'google-apps-script', 'Code.gs');
const ctx = vm.createContext({ Logger: { log() {} } });
vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
const rbac = ctx.rbacCheck_;

const clone = (x) => JSON.parse(JSON.stringify(x));
const base = () => ({
  seq: 1, seq2: 1, insp: [], tools: [], signatures: {},
  suratTugas: { projectId: 'p1' }, suratJalan: {}, jsa: {}, docArchives: [],
  joSoRecords: [], pelanggan: [], suratPenawaran: [], companyDocs: [],
  proj: [{
    id: 'p1', status: 'paid', log: [], docs: { issued: false, ack: false },
    team: { lead: 'i1', ins: ['i1', 'i2'], tools: [] }, pjtName: 'Kusno',
    workflowStage: 'leader_assigned',
    prepReview: { status: 'approved', submittedAt: 'x', submittedBy: 'Bagus' },
    directorReview: { status: 'pending', comments: [{ id: 'c1', text: 'ok' }] },
    pjt: { at: 'a', note: 'n' }
  }]
});
const results = [];
function t(name, role, mutate, expectOk, inspectorId, prep) {
  const o = base(); if (prep) prep(o);
  const n = clone(o); mutate(n);
  const bad = rbac(role, o, n, inspectorId || '');
  const ok = bad === null;
  results.push({ name, ok, pass: ok === expectOk, bad });
}

// 1. Direktur: Review & TTD (signNow)
t('Direktur: Review & TTD Surat Tugas', 'direktur', (s) => {
  const p = s.proj[0];
  p.docTte = { suratTugas: { enabled: true } };
  p.docs = { issued: true, ack: true };
  p.status = 'scheduled'; p.flowVersion = 2; p.workflowStage = 'published_work'; p.publishedToWorkMenu = true;
  p.directorReview = { ...p.directorReview, status: 'signed', signedBy: 'Dir', signedAt: 't' };
  p.log.push(['t', 'ttd']);
}, true);
// 2. Direktur: kembalikan untuk revisi
t('Direktur: Kembalikan untuk Revisi', 'direktur', (s) => {
  const p = s.proj[0];
  p.directorReview = { ...p.directorReview, status: 'revision', comments: [...p.directorReview.comments, { id: 'c2' }] };
  p.prepReview = { ...p.prepReview, status: 'revision', pjtBy: 'Dir', pjtNote: 'x' };
  p.log.push(['t', 'rev']);
}, true);
// 3. Leader/anggota: Kirim ke Direktur
const resetDr = (o) => { o.proj[0].directorReview = undefined; o.proj[0].prepReview = undefined; };
t('Leader: Kirim ke Direktur', 'inspektor', (s) => {
  const p = s.proj[0];
  p.prepReview = { status: 'approved', submittedAt: 't', submittedBy: 'Bagus' };
  p.directorReview = { status: 'pending', comments: [] };
  p.log.push(['t', 'kirim']);
}, true, 'i1', resetDr);
t('Anggota: Kirim ke Direktur', 'inspektor', (s) => {
  const p = s.proj[0];
  p.prepReview = { status: 'approved', submittedAt: 't', submittedBy: 'Frizal' };
  p.directorReview = { status: 'pending', comments: [] };
}, true, 'i2', resetDr);
t('Leader kirim ulang setelah revisi Direktur', 'inspektor', (s) => {
  const p = s.proj[0];
  p.prepReview = { status: 'approved', submittedAt: 't2', submittedBy: 'Bagus' };
  p.directorReview = { status: 'pending', comments: p.directorReview.comments };
}, true, 'i1', (o) => { o.proj[0].directorReview.status = 'revision'; o.proj[0].prepReview.status = 'revision'; });
// 4. Keamanan: Leader TIDAK boleh memalsukan TTD / menghapus komentar Direktur
t('KEAMANAN: Leader memalsukan directorReview=signed', 'inspektor', (s) => {
  s.proj[0].directorReview = { ...s.proj[0].directorReview, status: 'signed', signedBy: 'Dir', signedAt: 't' };
}, false, 'i1');
t('KEAMANAN: Leader menghapus komentar Direktur', 'inspektor', (s) => {
  s.proj[0].directorReview = { status: 'pending', comments: [] };
}, false, 'i1');
t('KEAMANAN: Leader menimpa review yang sudah signed', 'inspektor', (s) => {
  s.proj[0].directorReview = { status: 'pending', comments: s.proj[0].directorReview.comments };
}, false, 'i1', (o) => { o.proj[0].directorReview.status = 'signed'; });
// 5. PJT tunjuk Leader
t('PJT: Tunjuk Leader & Tim', 'pjt', (s) => {
  const p = s.proj[0];
  p.team = { lead: 'i2', ins: ['i2', 'i1'], tools: [] };
  p.workflowStage = 'leader_assigned'; p.status = 'paid'; p.log.push(['t', 'x']);
}, true);
t('PJT: Teruskan ke Direktur (alur lama)', 'pjt', (s) => {
  s.proj[0].directorReview = { status: 'pending', comments: [] };
  s.proj[0].prepReview = { ...s.proj[0].prepReview, status: 'approved', pjtBy: 'K' };
}, true, '', (o) => { o.proj[0].prepReview.status = 'submitted'; o.proj[0].directorReview = undefined; });
t('KEAMANAN: PJT memalsukan directorReview=signed', 'pjt', (s) => {
  s.proj[0].directorReview = { ...s.proj[0].directorReview, status: 'signed' };
}, false);
// 6. Laporan alur lama (Leader kirim ke PJT)
t('Leader: Kirim laporan ke PJT (alur lama)', 'inspektor', (s) => {
  const p = s.proj[0];
  p.status = 'submitted'; p.form = { items: {}, photos: [], submitted: true }; p.pjt = null; p.reportReview = { status: 'pending' };
}, true, 'i1');
t('KEAMANAN: Leader memalsukan reportReview=approved', 'inspektor', (s) => {
  s.proj[0].reportReview = { status: 'approved', by: 'x' };
}, false, 'i1');
// 7. Anggota tidak boleh ubah team; Leader boleh
t('Anggota: ubah team (harus ditolak)', 'inspektor', (s) => { s.proj[0].team.tools = ['t1']; }, false, 'i2');
t('Leader: ubah team', 'inspektor', (s) => { s.proj[0].team.tools = ['t1']; }, true, 'i1');
// 8. Peran lain tak boleh menyentuh kolom di luar haknya
t('Direktur: ubah team (harus ditolak)', 'direktur', (s) => { s.proj[0].team.lead = 'i9'; }, false);
t('Sales: ubah team (harus ditolak)', 'sales', (s) => { s.proj[0].team.lead = 'i9'; }, false);
// 9. Layanan SLO
t('Tenaga Teknik: unggah laporan per instalasi', 'inspektor', (s) => {
  s.proj[0].instalasi = [{ id: 'a', nama: 'x', noAgenda: '1' }]; s.proj[0].reports = [{ id: 'r' }]; s.proj[0].log.push(['t', 'u']);
}, true, 'i1');
t('PJT: sahkan instalasi', 'pjt', (s) => { s.proj[0].instalasi = [{ id: 'a', tahap: 'evaluasi_lit' }]; s.proj[0].log.push(['t', 's']); }, true);
// 10. Marketing sync
t('Marketing: sinkron Sales Order -> proyek', 'sales', (s) => {
  const p = s.proj[0]; p.perusahaan = 'PT A'; p.kota = 'SBY'; p.jenis = 'TM'; p.sub = 's'; p.kap = '1MW';
  p.penawaran = { no: 'x' }; p.po = { k: 'PO' }; p.joSoId = 'j1'; p.salesReadiness = 'ready'; p.salesMessage = 'm';
  s.joSoRecords.push({ id: 'j1' }); s.pelanggan.push({ id: 'c' }); s.suratPenawaran.push({ id: 'sp' });
}, true);

let fail = 0;
for (const r of results) {
  if (!r.pass) fail++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.bad ? '   -> ' + r.bad : ''}`);
}
console.log(`\n${results.length - fail}/${results.length} lulus`);
process.exit(fail ? 1 : 0);
