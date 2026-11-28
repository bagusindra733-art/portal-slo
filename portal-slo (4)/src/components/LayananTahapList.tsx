import { useState, type ReactNode } from 'react';
import { CheckCircle2, Download, FileText, Lock, Trash2, Upload } from 'lucide-react';
import type { DjkPosisi, Inspector, InstalasiTahap, Project, Role, TestReportFile } from '../types/portal';
import {
  closeProjectIfAllTerbit,
  DJK_POSISI_LABEL,
  formatFileSize,
  normAgenda,
  patchInstalasi,
  reportsOfInstalasi,
  TAHAP_LABEL,
  type InstalasiRow,
} from '../utils/portalUtils';
import { deleteVaultFile, getVaultFile, triggerDataUrlDownload } from '../utils/fileVault';
import { uploadReportFile } from '../utils/reportUpload';

type Props = {
  tahap: InstalasiTahap;
  posisi?: DjkPosisi;
  rows: InstalasiRow[];
  allProjects: Project[];
  inspectors: Inspector[];
  role: Role;
  /** Nama & ID Tenaga Teknik pengguna (untuk penanda pengunggah laporan). */
  userName: string;
  inspectorId: string;
  /** noAgenda (normAgenda) -> No. SLO dari data SLO Terbit. */
  noSloByAgenda: Record<string, string>;
  onUpdateProject: (p: Project) => void;
  onOpenProject: (id: string) => void;
  onToast: (msg: string) => void;
};

const input =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:bg-slate-50';
const btnPrimary =
  'h-8 px-3 rounded-lg bg-gradient-to-br from-[#1E3A8A] to-[#2A4A9E] text-white text-xs font-semibold hover:opacity-95 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:hover:opacity-100 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap';
const btnDone =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold cursor-not-allowed whitespace-nowrap';
const btnWait =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 text-xs font-semibold cursor-not-allowed whitespace-nowrap';
const TAHAP_PEMEGANG: Record<InstalasiTahap, string> = {
  verifikasi_lit: 'Admin',
  pengerjaan_tt: 'Tenaga Teknik',
  pengesahan_pjt: 'PJT',
  evaluasi_lit: 'Admin',
  evaluasi_djk: 'DJK',
  generate_slo: 'Admin',
  cetak_slo: 'Admin',
  slo_terbit: '',
};
const btnGhost =
  'h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap';

/** Siapa yang boleh menggerakkan tiap tahap. */
const ACTOR: Record<InstalasiTahap, Role[]> = {
  verifikasi_lit: ['teknis'],
  pengerjaan_tt: ['teknis', 'inspektor'],
  pengesahan_pjt: ['pjt'],
  evaluasi_lit: ['teknis'],
  evaluasi_djk: ['teknis'],
  generate_slo: ['teknis'],
  cetak_slo: ['teknis'],
  slo_terbit: [],
};

const ACTOR_NAME: Record<InstalasiTahap, string> = {
  verifikasi_lit: 'Admin',
  pengerjaan_tt: 'Tenaga Teknik',
  pengesahan_pjt: 'PJT',
  evaluasi_lit: 'Admin',
  evaluasi_djk: 'Admin',
  generate_slo: 'Admin',
  cetak_slo: 'Admin',
  slo_terbit: '',
};

export function LayananTahapList(props: Props) {
  const { tahap, posisi, rows, role } = props;
  const canAct = ACTOR[tahap].includes(role);
  const title = tahap === 'evaluasi_djk' && posisi ? `Evaluasi DJK (${DJK_POSISI_LABEL[posisi]})` : TAHAP_LABEL[tahap];

  return (
    <div className="space-y-3">
      <h2 className="font-display font-extrabold text-lg text-slate-900 tracking-tight">
        {title} <span className="text-slate-500 font-bold">· {rows.length} instalasi</span>
      </h2>
      {!canAct && ACTOR_NAME[tahap] && (
        <p className="text-xs text-slate-500">Tahap ini dikerjakan oleh {ACTOR_NAME[tahap]}. Anda hanya dapat melihat.</p>
      )}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-bold">Proyek</th>
              <th className="px-4 py-3 font-bold">Instalasi &amp; No. Agenda DJK</th>
              <th className="px-4 py-3 font-bold">Tenaga Teknik</th>
              <th className="px-4 py-3 font-bold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <Row key={`${r.p.id}-${r.ins.id}`} row={r} canAct={canAct} {...props} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                  Tidak ada instalasi di tahap ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  row,
  canAct,
  allProjects,
  inspectors,
  role,
  userName,
  inspectorId,
  noSloByAgenda,
  onUpdateProject,
  onOpenProject,
  onToast,
}: Props & { row: InstalasiRow; canAct: boolean }) {
  const { p, ins, tahap } = row;
  const [nama, setNama] = useState(ins.nama);
  const [noAgenda, setNoAgenda] = useState(ins.noAgenda);
  const [teamIds, setTeamIds] = useState<string[]>(ins.teamIds ?? []);
  const [catatan, setCatatan] = useState('');
  const label = ins.nama || p.perusahaan;
  const editing = tahap === 'verifikasi_lit' && canAct;

  const teamNames = (ins.teamIds?.length ? ins.teamIds : p.team ? [p.team.lead, ...p.team.ins] : [])
    .filter((id, i, a) => a.indexOf(id) === i)
    .map((id) => inspectors.find((x) => x.id === id)?.nama ?? id);

  const write = (patch: Parameters<typeof patchInstalasi>[2], msg: string, toast: string) => {
    // Bila ini instalasi terakhir yang SLO Terbit, proyek otomatis ditandai selesai.
    const next = closeProjectIfAllTerbit(patchInstalasi(p, ins.id, patch, `Instalasi "${label}": ${msg}`));
    onUpdateProject(next);
    onToast(next.sloNotice && !p.sloNotice ? `${toast} — semua instalasi selesai, proyek ditutup otomatis` : toast);
  };

  /** Validasi & simpan data input Admin (nama, No. Agenda, Tenaga Teknik). */
  const validated = (): { nama: string; noAgenda: string } | null => {
    const n = nama.trim();
    const a = noAgenda.trim();
    if (!a) {
      onToast('Isi No. Agenda DJK dulu');
      return null;
    }
    const key = normAgenda(a);
    for (const other of allProjects) {
      for (const o of other.instalasi ?? []) {
        if (o.id !== ins.id && o.noAgenda && normAgenda(o.noAgenda) === key) {
          onToast(`No. Agenda ${a} sudah dipakai (${other.perusahaan})`);
          return null;
        }
      }
    }
    return { nama: n, noAgenda: a };
  };

  const saveData = () => {
    const v = validated();
    if (v) write({ ...v, teamIds }, 'data instalasi disimpan', 'Data instalasi tersimpan');
  };
  const advanceVerifikasi = () => {
    const v = validated();
    if (v)
      write(
        { ...v, teamIds, tahap: 'pengerjaan_tt', catatan: '' },
        `diinput ke DJK (${v.noAgenda}) → Pengerjaan TT`,
        'Masuk Pengerjaan TT'
      );
  };

  const reportCount = reportsOfInstalasi(p, ins.id).length;

  let action: ReactNode = null;
  if (canAct) {
    switch (tahap) {
      case 'verifikasi_lit':
        action = (
          <div className="flex flex-col gap-1.5 items-start">
            <button type="button" className={btnPrimary} onClick={advanceVerifikasi}>
              Sudah diinput ke DJK →
            </button>
            <button type="button" className={btnGhost} onClick={saveData}>
              Simpan data
            </button>
          </div>
        );
        break;
      case 'pengerjaan_tt':
        action = (
          <div className="flex flex-col gap-1.5 items-start">
            {reportCount === 0 && (
              <span className="text-xs font-semibold text-red-600">Unggah laporan instalasi ini dulu</span>
            )}
            <button
              type="button"
              className={btnPrimary}
              disabled={reportCount === 0}
              onClick={() => {
                if (reportCount === 0) return onToast('Instalasi ini belum punya laporan — unggah dulu sebelum diteruskan ke PJT');
                write({ tahap: 'pengesahan_pjt' }, `${reportCount} laporan diteruskan ke PJT`, 'Diteruskan ke PJT untuk direview');
              }}
            >
              Teruskan ke PJT →
            </button>
          </div>
        );
        break;
      case 'pengesahan_pjt':
        action = (
          <div className="flex flex-col gap-1.5 items-start min-w-[180px]">
            <button
              type="button"
              className={btnPrimary}
              onClick={() => write({ tahap: 'evaluasi_lit', catatan: '' }, 'laporan disahkan PJT → Evaluasi LIT', 'Disahkan, diteruskan ke Admin')}
            >
              Sahkan &amp; teruskan ke Admin →
            </button>
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan revisi…" className={input} />
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                if (!catatan.trim()) return onToast('Tulis catatan revisi untuk dikembalikan');
                write({ tahap: 'pengerjaan_tt', catatan: catatan.trim() }, `dikembalikan PJT: ${catatan.trim()}`, 'Dikembalikan ke Pengerjaan TT');
              }}
            >
              Kembalikan untuk revisi
            </button>
          </div>
        );
        break;
      case 'evaluasi_lit':
        action = (
          <button
            type="button"
            className={btnPrimary}
            onClick={() =>
              write({ tahap: 'evaluasi_djk', djkPosisi: 'prepare' }, 'diteruskan ke DJK → Evaluasi DJK (Prepare)', 'Diteruskan ke DJK')
            }
          >
            Sudah diteruskan ke DJK →
          </button>
        );
        break;
      case 'evaluasi_djk':
        action = (
          <div className="flex flex-col gap-1.5 items-start">
            {row.posisiDariExcel ? (
              <span className="text-xs text-slate-500">Posisi dari Excel DJK</span>
            ) : (
              <select
                value={row.posisi}
                onChange={(e) =>
                  write(
                    { djkPosisi: e.target.value as DjkPosisi },
                    `posisi DJK → ${DJK_POSISI_LABEL[e.target.value as DjkPosisi]}`,
                    'Posisi DJK diperbarui'
                  )
                }
                className={input}
              >
                {(Object.keys(DJK_POSISI_LABEL) as DjkPosisi[]).map((k) => (
                  <option key={k} value={k}>{DJK_POSISI_LABEL[k]}</option>
                ))}
              </select>
            )}
            <span className="text-xs text-slate-500">Turun otomatis ke Generate SLO saat data SLO terbit masuk</span>
          </div>
        );
        break;
      case 'generate_slo':
        action = (
          <button
            type="button"
            className={btnPrimary}
            onClick={() => write({ tahap: 'cetak_slo' }, 'SLO di-generate → Cetak SLO', 'Masuk Cetak SLO')}
          >
            SLO sudah di-generate →
          </button>
        );
        break;
      case 'cetak_slo':
        action = (
          <button
            type="button"
            className={btnPrimary}
            onClick={() => write({ tahap: 'slo_terbit' }, 'SLO dicetak → SLO Terbit', 'Selesai — tersimpan di SLO Terbit')}
          >
            SLO sudah dicetak ✓
          </button>
        );
        break;
    }
  }

  if (!action) {
    action =
      tahap === 'slo_terbit' ? (
        <button type="button" disabled aria-disabled="true" title="Sudah dikerjakan" className={btnDone}>
          <CheckCircle2 className="w-3.5 h-3.5" /> SLO terbit
        </button>
      ) : (
        <button type="button" disabled aria-disabled="true" title="Bukan giliran Anda" className={btnWait}>
          <Lock className="w-3.5 h-3.5" /> Menunggu {TAHAP_PEMEGANG[tahap]}
        </button>
      );
  }

  const noSlo = noSloByAgenda[normAgenda(ins.noAgenda)];

  return (
    <tr className="align-top hover:bg-blue-50/30">
      <td className="px-4 py-3 min-w-[190px]">
        <div className="font-semibold text-slate-900 leading-snug">{p.perusahaan}</div>
        <div className="text-xs text-slate-500">{p.no} · {p.kota}</div>
        <button type="button" onClick={() => onOpenProject(p.id)} className="mt-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer">
          Buka proyek
        </button>
      </td>
      <td className="px-4 py-3 min-w-[260px]">
        {editing ? (
          <div className="space-y-1.5">
            <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama instalasi" className={input} />
            <input value={noAgenda} onChange={(e) => setNoAgenda(e.target.value)} placeholder="No. Agenda DJK" className={`${input} font-mono`} />
          </div>
        ) : (
          <>
            <div className="text-xs text-slate-800 leading-snug">{ins.nama || <span className="text-slate-500">(tanpa nama)</span>}</div>
            <div className="font-mono text-xs text-slate-500">{ins.noAgenda || '-'}</div>
            {noSlo && <div className="font-mono text-xs text-emerald-700 mt-0.5">SLO: {noSlo}</div>}
            {ins.catatan && tahap === 'pengerjaan_tt' && (
              <div className="text-xs text-red-600 mt-1">Revisi PJT: {ins.catatan}</div>
            )}
            {(tahap === 'pengerjaan_tt' || tahap === 'pengesahan_pjt') && (
              <RowReports
                p={p}
                ins={ins}
                label={label}
                canUpload={tahap === 'pengerjaan_tt' && canAct}
                canDelete={(r) =>
                  tahap === 'pengerjaan_tt' &&
                  role === 'inspektor' &&
                  (r.uploadedById === inspectorId || p.team?.lead === inspectorId)
                }
                userName={userName}
                inspectorId={inspectorId}
                onUpdateProject={onUpdateProject}
                onToast={onToast}
              />
            )}
          </>
        )}
      </td>
      <td className="px-4 py-3 min-w-[190px]">
        {editing ? (
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {inspectors.map((i) => (
              <label key={i.id} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teamIds.includes(i.id)}
                  onChange={(e) => setTeamIds((t) => (e.target.checked ? [...t, i.id] : t.filter((x) => x !== i.id)))}
                />
                {i.nama}
              </label>
            ))}
            <p className="text-xs text-slate-500 pt-1">Kosong = ikut tim proyek</p>
          </div>
        ) : (
          <div className="text-xs text-slate-700 leading-snug">
            {teamNames.length ? teamNames.join(', ') : <span className="text-slate-500">-</span>}
          </div>
        )}
      </td>
      <td className="px-4 py-3">{action}</td>
    </tr>
  );
}


/** Laporan satu instalasi: daftar + unduh (semua peran), unggah/hapus (Tenaga Teknik di Pengerjaan TT). */
function RowReports({
  p,
  ins,
  label,
  canUpload,
  canDelete,
  userName,
  inspectorId,
  onUpdateProject,
  onToast,
}: {
  p: Project;
  ins: InstalasiRow['ins'];
  label: string;
  canUpload: boolean;
  canDelete: (r: TestReportFile) => boolean;
  userName: string;
  inspectorId: string;
  onUpdateProject: (p: Project) => void;
  onToast: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const reports = reportsOfInstalasi(p, ins.id);

  const download = async (r: TestReportFile) => {
    const rec = await getVaultFile(r.vaultFileId);
    if (!rec) return onToast('Berkas tidak ditemukan di server maupun perangkat ini');
    triggerDataUrlDownload(rec.dataUrl, r.name);
  };

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadReportFile(file, {
        title,
        uploadedBy: userName,
        uploadedById: inspectorId,
        instalasiId: ins.id,
      });
      if (!res.rec) return onToast(res.error || 'Gagal mengunggah laporan');
      if (res.synced === false) onToast('Laporan tersimpan di perangkat ini saja — server dokumen tidak terjangkau');
      // patchInstalasi memastikan instalasi tercatat di proyek sebelum laporan ditautkan.
      const base = patchInstalasi(p, ins.id, {}, `${userName} mengunggah laporan instalasi "${label}": ${res.rec.title}`);
      onUpdateProject({ ...base, reports: [...(p.reports ?? []), res.rec] });
      setTitle('');
      onToast(`Laporan "${res.rec.title}" diunggah`);
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Gagal mengunggah laporan');
    } finally {
      setBusy(false);
    }
  };

  const remove = (r: TestReportFile) => {
    void deleteVaultFile(r.vaultFileId);
    const base = patchInstalasi(p, ins.id, {}, `Laporan "${r.title}" instalasi "${label}" dihapus`);
    onUpdateProject({ ...base, reports: (p.reports ?? []).filter((x) => x.id !== r.id) });
    onToast('Laporan dihapus');
  };

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2 space-y-1.5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Laporan ({reports.length})</div>
      {reports.length === 0 && <p className="text-xs text-slate-500">Belum ada laporan untuk instalasi ini.</p>}
      {reports.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 flex items-center gap-1.5 text-slate-800">
            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate" title={`${r.name} · ${formatFileSize(r.size)} · ${r.uploadedBy}`}>
              {r.title || r.name}
            </span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => void download(r)} className={btnGhost} title="Unduh">
              <Download className="w-3.5 h-3.5" />
            </button>
            {canDelete(r) && (
              <button
                type="button"
                onClick={() => remove(r)}
                className="h-8 px-3 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                title="Hapus"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        </div>
      ))}
      {canUpload && (
        <div className="space-y-1.5 pt-1">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul laporan (opsional)" className={input} />
          <label className={`${btnPrimary} inline-flex items-center gap-1.5 ${busy ? 'opacity-40 pointer-events-none' : ''}`}>
            <Upload className="w-3.5 h-3.5" /> {busy ? 'Mengunggah…' : 'Unggah laporan'}
            <input
              type="file"
              className="hidden"
              disabled={busy}
              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          <p className="text-xs text-slate-500">PDF / Word / Excel / foto, maks. 5 MB.</p>
        </div>
      )}
    </div>
  );
}
