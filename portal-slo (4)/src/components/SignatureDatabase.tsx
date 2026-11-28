import React, { useMemo, useRef, useState } from 'react';
import { PenLine, Trash2, Upload } from 'lucide-react';
import { DOC_CONFIG, Inspector } from '../types/portal';
import { findSignature } from '../utils/portalUtils';
import { prepareSignatureImage } from '../utils/signatureImage';
import { SignatureImg } from './SignatureImg';

interface Props {
  canEdit: boolean;
  inspectors: Inspector[];
  signatures: Record<string, string>;
  /** dataUrl null = hapus TTD untuk nama tersebut. */
  onSetSignature: (name: string, dataUrl: string | null) => void;
  onToast: (msg: string) => void;
}

/**
 * Database TTD: satu gambar tanda tangan per nama. Dokumen Surat Jalan Alat & JSA
 * otomatis menempelkan TTD sesuai nama yang dipilih pada kolom tanda tangan.
 */
export function SignatureDatabase({ canEdit, inspectors, signatures, onSetSignature, onToast }: Props) {
  const [extraName, setExtraName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingName = useRef<string>('');
  const [busy, setBusy] = useState(false);

  const names = useMemo(() => {
    const out: string[] = [];
    const add = (n?: string) => {
      const v = String(n || '').trim();
      if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
    };
    DOC_CONFIG.penandatangan.forEach((p) => add(p.nama));
    DOC_CONFIG.pjt.forEach(add);
    DOC_CONFIG.tenagaTeknik.forEach(add);
    inspectors.forEach((i) => add(i.nama));
    Object.keys(signatures).forEach(add);
    return out;
  }, [inspectors, signatures]);

  const pick = (name: string) => {
    if (!canEdit) return;
    const n = name.trim();
    if (!n) {
      onToast('Isi nama terlebih dahulu');
      return;
    }
    pendingName.current = n;
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !pendingName.current) return;
    setBusy(true);
    try {
      const dataUrl = await prepareSignatureImage(f);
      onSetSignature(pendingName.current, dataUrl);
      onToast(`TTD ${pendingName.current} tersimpan`);
      setExtraName('');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Gagal memproses gambar TTD');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
      <div className="flex items-center gap-2 mb-1">
        <PenLine className="w-4 h-4 text-blue-600" />
        <h3 className="font-display text-base font-bold text-slate-900">Database TTD (Tanda Tangan)</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Unggah satu gambar TTD per nama. Pada Surat Jalan Alat &amp; JSA, kolom tanda tangan terisi otomatis
        sesuai nama yang dipilih. Ukuran gambar diseragamkan otomatis (margin dipangkas, latar putih
        dibuat transparan) sehingga rapi di hasil PDF. Surat Tugas tetap memakai TTE Direktur.
      </p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse min-w-[520px]">
          <thead>
            <tr className="bg-[#0F1E3D] text-white text-xs uppercase tracking-wider">
              <th className="py-2.5 px-3.5">Nama</th>
              <th className="py-2.5 px-3.5">TTD</th>
              {canEdit && <th className="py-2.5 px-3.5">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {names.map((n) => {
              const sig = findSignature(signatures, n);
              const own = Object.keys(signatures).find((k) => k.toLowerCase() === n.toLowerCase());
              return (
                <tr key={n} className="hover:bg-slate-50">
                  <td className="py-2 px-3.5 font-semibold text-slate-900">{n}</td>
                  <td className="py-2 px-3.5">
                    {sig ? (
                      <div className="rounded-lg border border-slate-200 bg-white inline-block px-1">
                        <SignatureImg src={sig} alt={`TTD ${n}`} />
                      </div>
                    ) : (
                      <span className="text-slate-500">Belum ada</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-2 px-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => pick(n)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5" /> {own ? 'Ganti' : 'Unggah'}
                        </button>
                        {own && (
                          <button
                            type="button"
                            onClick={() => {
                              onSetSignature(own, null);
                              onToast(`TTD ${own} dihapus`);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nama lain (mis. Tool Keeper)</label>
            <input
              value={extraName}
              onChange={(e) => setExtraName(e.target.value)}
              placeholder="Nama persis seperti di dokumen"
              className="h-9 w-64 rounded-lg border border-slate-200 px-2.5 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => pick(extraName)}
            className="h-9 px-3.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> Unggah TTD
          </button>
        </div>
      )}
    </div>
  );
}
