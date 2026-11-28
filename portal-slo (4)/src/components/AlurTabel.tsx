import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { Inspector, Project, Role } from '../types/portal';
import { FLOW_STEPS, FlowStepKey, currentFlowIndex } from '../utils/portalUtils';

/** Kunci baris tabel: 10 langkah alur + 2 baris tambahan. */
export type AlurRowKey = FlowStepKey | 'instalasi' | 'berkas';

/** Peran (efektif) yang memiliki isi/panel pada tiap baris. */
const ROW_ROLES: Record<AlurRowKey, Role[]> = {
  spk: ['teknis', 'direktur'],
  admin: ['teknis', 'direktur'],
  pjt_leader: ['teknis', 'pjt'],
  leader_notice: ['teknis', 'pjt', 'direktur', 'inspektor'],
  prep_docs: ['inspektor'],
  pjt_review: ['pjt'],
  director: ['direktur'],
  report: ['teknis', 'direktur', 'inspektor'],
  pjt_report: ['pjt', 'direktur'],
  slo: ['teknis', 'pjt', 'direktur', 'inspektor', 'sales'],
  instalasi: ['teknis', 'pjt', 'direktur', 'inspektor', 'sales'],
  berkas: ['teknis', 'pjt', 'direktur', 'inspektor', 'sales'],
};

/** Peran yang mengerjakan tiap langkah (untuk label tombol "Kerjakan"). */
const OWNER_ROLE: Partial<Record<AlurRowKey, Role>> = {
  spk: 'sales',
  admin: 'teknis',
  pjt_leader: 'pjt',
  leader_notice: 'inspektor',
  prep_docs: 'inspektor',
  pjt_review: 'pjt',
  director: 'direktur',
  report: 'inspektor',
  pjt_report: 'pjt',
};

interface Props {
  p: Project;
  /** Peran efektif: 'inspektor' bila pengguna bekerja sebagai Tenaga Teknik di proyek ini. */
  effectiveRole: Role;
  inspectors: Inspector[];
  onOpen: (key: AlurRowKey) => void;
}

export function AlurTabel({ p, effectiveRole, inspectors, onOpen }: Props) {
  const idx = currentFlowIndex(p);
  const selesai = idx >= FLOW_STEPS.length;
  const leaderName = p.team?.lead ? inspectors.find((i) => i.id === p.team?.lead)?.nama : undefined;

  const pic = (key: AlurRowKey, fallback: string): string => {
    switch (key) {
      case 'spk':
        return 'Marketing';
      case 'admin':
        return 'Admin';
      case 'pjt_leader':
      case 'pjt_review':
      case 'pjt_report':
        return p.pjtName || 'PJT';
      case 'leader_notice':
      case 'prep_docs':
        return leaderName ? `Leader: ${leaderName}` : 'Leader (belum ditunjuk)';
      case 'report':
        return leaderName ? `${leaderName} & tim` : 'Tenaga Teknik';
      case 'director':
        return 'Direktur Utama';
      case 'slo':
        return 'Admin & PJT';
      default:
        return fallback;
    }
  };

  const rows: { key: AlurRowKey; label: string; owner: string; no: string; state: 'done' | 'active' | 'wait' | 'extra' }[] = [
    ...FLOW_STEPS.map((s, i) => ({
      key: s.key as AlurRowKey,
      label: s.label,
      owner: pic(s.key, s.owner),
      no: String(i + 1),
      state: (i < idx || selesai ? 'done' : i === idx ? 'active' : 'wait') as 'done' | 'active' | 'wait',
    })),
    { key: 'instalasi', label: 'Instalasi & No. Agenda DJK', owner: 'Admin, PJT & Tenaga Teknik', no: '•', state: 'extra' },
    { key: 'berkas', label: 'Berkas & Riwayat', owner: 'Semua peran', no: '•', state: 'extra' },
  ];

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-violet-50/60 border-b border-slate-200/70 text-sm text-slate-700">
        Alur Pekerjaan SLO — tombol <b>Kerjakan</b> / <b>Lihat</b> membuka panel langkah tersebut.
      </div>
      <div className="p-5 md:p-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse" style={{ minWidth: 760 }}>
            <thead>
              <tr className="bg-violet-50/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                <th className="px-4 py-3 w-14 border-r border-slate-200">No</th>
                <th className="px-4 py-3 border-r border-slate-200">Langkah</th>
                <th className="px-4 py-3 border-r border-slate-200">Penanggung Jawab</th>
                <th className="px-4 py-3 border-r border-slate-200">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hasContent = ROW_ROLES[r.key].includes(effectiveRole);
                const mine = OWNER_ROLE[r.key] === effectiveRole;
                const kerjakan = mine && r.state === 'active';
                return (
                  <tr
                    key={r.key}
                    className={`border-t border-slate-100 text-sm text-slate-700 ${r.state === 'active' ? 'bg-violet-50/40' : ''}`}
                  >
                    <td className="px-4 py-3.5 tabular-nums">{r.no}</td>
                    <td className={`px-4 py-3.5 ${r.state === 'active' ? 'font-bold text-violet-800' : r.state === 'wait' ? 'text-slate-500' : 'font-medium text-slate-800'}`}>
                      {r.label}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{r.owner}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {r.state === 'done' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" /> Selesai
                        </span>
                      )}
                      {r.state === 'active' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700">
                          <Clock className="w-4 h-4" /> Sedang berjalan
                        </span>
                      )}
                      {r.state === 'wait' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <Circle className="w-4 h-4" /> Menunggu
                        </span>
                      )}
                      {r.state === 'extra' && <span className="text-xs text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {hasContent ? (
                        <button
                          type="button"
                          onClick={() => onOpen(r.key)}
                          className={`inline-flex items-center px-3 h-9 rounded-lg text-xs font-bold cursor-pointer ${
                            kerjakan
                              ? 'bg-gradient-to-br from-violet-500 to-purple-400 text-white shadow-sm shadow-violet-500/30'
                              : 'bg-gradient-to-br from-cyan-500 to-sky-400 text-white shadow-sm shadow-cyan-500/30'
                          }`}
                        >
                          {kerjakan ? 'Kerjakan' : 'Lihat'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AlurTabel;
