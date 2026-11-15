import React, { useState } from 'react';
import { AlertTriangle, Plus, ShieldCheck, Wrench } from 'lucide-react';
import { Inspector, Tool } from '../types/portal';
import { certStatus, computeAlerts, formatDateShort } from '../utils/portalUtils';

interface ResourcesManagerProps {
  mode: 'peringatan' | 'personel' | 'alat';
  canEdit?: boolean;
  inspectors: Inspector[];
  tools: Tool[];
  paidProjectsCount: number;
  onUpdateInspectorDate: (id: string, field: 'serkom' | 'k3', value: string) => void;
  onAddInspector: (ins: Inspector) => void;
  onUpdateToolDate: (id: string, value: string) => void;
  onAddTool: (tool: Tool) => void;
  onToast: (msg: string) => void;
}

const BADGE_CLASSES: Record<'ok' | 'info' | 'warn' | 'crit', string> = {
  ok: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  info: 'bg-sky-50 text-sky-700 border border-sky-200',
  warn: 'bg-amber-50 text-amber-800 border border-amber-200',
  crit: 'bg-red-50 text-red-700 border border-red-200',
};

export function ResourcesManager({
  mode,
  canEdit = false,
  inspectors,
  tools,
  paidProjectsCount,
  onUpdateInspectorDate,
  onAddInspector,
  onUpdateToolDate,
  onAddTool,
  onToast,
}: ResourcesManagerProps) {
  // Add inspector form state
  const [iNama, setINama] = useState('');
  const [iReg, setIReg] = useState('');
  const [iSerkom, setISerkom] = useState('');
  const [iK3, setIK3] = useState('');

  // Add tool form state
  const [tNama, setTNama] = useState('');
  const [tSn, setTSn] = useState('');
  const [tCal, setTCal] = useState('');

  if (mode === 'peringatan') {
    const alerts = computeAlerts(inspectors, tools);
    const locked = alerts.filter((a) => a.cert.lock).length;
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Peringatan Aktif
            </div>
            <div className="font-display text-3xl font-extrabold text-slate-900 tabular-nums mt-1">
              {alerts.length}
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Terkunci (Kedaluwarsa)
            </div>
            <div className="font-display text-3xl font-extrabold text-red-600 tabular-nums mt-1">
              {locked}
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Menunggu Penugasan
            </div>
            <div className="font-display text-3xl font-extrabold text-blue-600 tabular-nums mt-1">
              {paidProjectsCount}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="font-display text-base font-bold text-slate-900">
              Daftar Peringatan Sertifikat & Kalibrasi
            </h3>
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500">Semua sertifikat dan kalibrasi alat berlaku.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse min-w-[560px]">
                <thead>
                  <tr className="bg-[#0F1E3D] text-white text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3.5">Pemilik / Alat</th>
                    <th className="py-2.5 px-3.5">Jenis</th>
                    <th className="py-2.5 px-3.5">Berakhir</th>
                    <th className="py-2.5 px-3.5">Sisa Hari</th>
                    <th className="py-2.5 px-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {alerts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3.5 font-semibold text-slate-900">{a.owner}</td>
                      <td className="py-2.5 px-3.5 text-slate-600">{a.what}</td>
                      <td className="py-2.5 px-3.5 text-slate-600">{formatDateShort(a.date)}</td>
                      <td className="py-2.5 px-3.5 font-mono tabular-nums text-slate-700">
                        {a.cert.n < 0 ? `lewat ${-a.cert.n} hr` : `${a.cert.n} hr`}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${BADGE_CLASSES[a.cert.k]}`}
                        >
                          {a.cert.t}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'personel') {
    const handleAddIns = (e: React.FormEvent) => {
      e.preventDefault();
      if (!iNama.trim() || !iSerkom || !iK3) {
        onToast('Lengkapi nama inspektor, tanggal Serkom, dan tanggal K3');
        return;
      }
      onAddInspector({
        id: `i-${Date.now()}`,
        nama: iNama.trim(),
        noReg: iReg.trim() || '-',
        serkom: iSerkom,
        k3: iK3,
      });
      setINama('');
      setIReg('');
      setISerkom('');
      setIK3('');
      onToast('Inspektor berhasil ditambahkan');
    };

    return (
      <div className="space-y-5">
        {!canEdit && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-900 font-medium">
            <b>Mode Baca Saja:</b> Input &amp; pembaruan data personel/sertifikat hanya dapat dilakukan oleh <b>Admin</b>.
          </div>
        )}
        <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h3 className="font-display text-base font-bold text-slate-900">
              Personel Inspektor &amp; Sertifikat (Serkom TTK / K3)
            </h3>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-[#0F1E3D] text-white text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3.5">Nama</th>
                  <th className="py-2.5 px-3.5">No. Registrasi</th>
                  <th className="py-2.5 px-3.5">Serkom TTK s.d.</th>
                  <th className="py-2.5 px-3.5">Sertifikat K3 s.d.</th>
                  <th className="py-2.5 px-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {inspectors.map((i) => {
                  const a = certStatus(i.serkom);
                  const b = certStatus(i.k3);
                  const lock = Boolean(a.lock || b.lock);
                  return (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3.5 font-semibold text-slate-900">{i.nama}</td>
                      <td className="py-2.5 px-3.5 font-mono text-slate-600">{i.noReg}</td>
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={i.serkom}
                            disabled={!canEdit}
                            onChange={(e) => onUpdateInspectorDate(i.id, 'serkom', e.target.value)}
                            className="h-8 rounded-lg border border-slate-200 px-2 text-xs disabled:bg-slate-50 disabled:text-slate-600"
                          />
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${BADGE_CLASSES[a.k]}`}
                          >
                            {a.t}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={i.k3}
                            disabled={!canEdit}
                            onChange={(e) => onUpdateInspectorDate(i.id, 'k3', e.target.value)}
                            className="h-8 rounded-lg border border-slate-200 px-2 text-xs disabled:bg-slate-50 disabled:text-slate-600"
                          />
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${BADGE_CLASSES[b.k]}`}
                          >
                            {b.t}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            lock ? BADGE_CLASSES.crit : BADGE_CLASSES.ok
                          }`}
                        >
                          {lock ? 'Terkunci' : 'Dapat ditugaskan'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {canEdit && (
          <form
            onSubmit={handleAddIns}
            className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs"
          >
            <h3 className="font-display text-sm font-bold text-slate-900 mb-3">Tambah Inspektor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nama Lengkap</label>
                <input
                  value={iNama}
                  onChange={(e) => setINama(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">No. Registrasi TTK</label>
                <input
                  value={iReg}
                  onChange={(e) => setIReg(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Serkom Berlaku s.d.</label>
                <input
                  type="date"
                  value={iSerkom}
                  onChange={(e) => setISerkom(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">K3 Berlaku s.d.</label>
                <input
                  type="date"
                  value={iK3}
                  onChange={(e) => setIK3(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Simpan Inspektor
            </button>
          </form>
        )}
      </div>
    );
  }

  // mode === 'alat'
  const handleAddTool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tNama.trim() || !tCal) {
      onToast('Lengkapi nama alat dan tanggal kalibrasi');
      return;
    }
    onAddTool({
      id: `t-${Date.now()}`,
      nama: tNama.trim(),
      sn: tSn.trim() || '-',
      cal: tCal,
    });
    setTNama('');
    setTSn('');
    setTCal('');
    onToast('Alat uji berhasil ditambahkan');
  };

  return (
    <div className="space-y-5">
      {!canEdit && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-900 font-medium">
          <b>Mode Baca Saja:</b> Input &amp; pembaruan inventaris alat uji / kalibrasi hanya dapat dilakukan oleh <b>Admin</b>.
        </div>
      )}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-4 h-4 text-blue-600" />
          <h3 className="font-display text-base font-bold text-slate-900">
            Inventaris Alat Uji &amp; Masa Kalibrasi
          </h3>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-[#0F1E3D] text-white text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Alat Uji</th>
                <th className="py-2.5 px-3.5">No. Seri</th>
                <th className="py-2.5 px-3.5">Kalibrasi s.d.</th>
                <th className="py-2.5 px-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {tools.map((t) => {
                const c = certStatus(t.cal, true);
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">{t.nama}</td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-600">{t.sn}</td>
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={t.cal}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateToolDate(t.id, e.target.value)}
                          className="h-8 rounded-lg border border-slate-200 px-2 text-xs disabled:bg-slate-50 disabled:text-slate-600"
                        />
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${BADGE_CLASSES[c.k]}`}
                        >
                          {c.t}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          c.lock ? BADGE_CLASSES.crit : BADGE_CLASSES.ok
                        }`}
                      >
                        {c.lock ? 'Terkunci' : 'Siap pakai'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && (
        <form
          onSubmit={handleAddTool}
          className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs"
        >
          <h3 className="font-display text-sm font-bold text-slate-900 mb-3">Tambah Alat Uji</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nama Alat</label>
              <input
                value={tNama}
                onChange={(e) => setTNama(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">No. Seri</label>
              <input
                value={tSn}
                onChange={(e) => setTSn(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Kalibrasi Berlaku s.d.</label>
              <input
                type="date"
                value={tCal}
                onChange={(e) => setTCal(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Simpan Alat Uji
          </button>
        </form>
      )}
    </div>
  );
}
