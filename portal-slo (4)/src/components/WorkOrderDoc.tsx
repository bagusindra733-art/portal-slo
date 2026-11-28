import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { DOC_CONFIG, JoSoRecord } from '../types/portal';
import { LOGO } from '../constants/logos';
import {
  calcJoSoTotals,
  defaultWoCatatan,
  findSignature,
  getPelanggan,
} from '../utils/portalUtils';
import { exportElementToPdf } from '../utils/pdfExport';
import { SignatureImg } from './SignatureImg';

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const rp = (n: number) => nf.format(Math.round(Number.isFinite(n) ? n : 0));

/** Tanggal gaya dokumen asli, mis. "10 October 2026". */
function fmtTanggal(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function workOrderFilename(rec: JoSoRecord): string {
  const base = (rec.poNo || rec.noPenawaran || rec.title || 'draft').replace(/[^\w.-]+/g, '-');
  return `Work-Order-${base}`;
}

interface PaperProps {
  record: JoSoRecord;
  /** Database TTD (opsional). Bila diberikan, TTD penandatangan ikut tampil. */
  signatures?: Record<string, string>;
  zoom?: number;
}

/** Lembar Work Order A4 (dasar tampilan & PDF). */
export const WorkOrderPaper = React.forwardRef<HTMLElement, PaperProps>(function WorkOrderPaper(
  { record, signatures, zoom = 1 },
  ref
) {
  const wo = DOC_CONFIG.workOrder;
  const pel = getPelanggan(record);
  const totals = calcJoSoTotals(record);
  const items = record.items.filter((it) => it.itemName.trim() || Number(it.price) > 0);

  const alamatFull = (() => {
    const a = pel.alamat.trim();
    const k = pel.kota.trim();
    if (!k) return a;
    return a.toLowerCase().includes(k.toLowerCase()) ? a : [a, k].filter(Boolean).join(', ');
  })();

  const kontak = (() => {
    const n = (record.kontakNama || '').trim();
    const t = (record.kontakTelp || '').trim();
    if (n && t) return `${n} (${t})`;
    return n || t || '-';
  })();

  const customLines = (record.catatanWo || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const catatan = customLines.length > 0 ? customLines : defaultWoCatatan(record.dp);
  const ttdOrang = DOC_CONFIG.penandatangan.find((p) => p.nama === record.penandatangan) ?? wo.penandatangan;
  const ttd = findSignature(signatures, ttdOrang.nama);

  return (
    <article ref={ref} className="wo-paper" style={{ zoom }}>
      <header className="wo-kop">
        <img src={LOGO.kiri} alt="Sabda Duta Paramitha" />
        <div className="wo-alamat">
          {wo.namaKop}
          <br />
          {wo.alamatKop}
          <br />
          {wo.telpKop}
        </div>
      </header>

      <div className="wo-box">
        <div className="wo-title">WORK ORDER</div>
        <div className="wo-info">
          <div>
            <div className="wo-kv">
              <span>Nama</span>
              <span>: {pel.nama || '-'}</span>
            </div>
            <div className="wo-kv">
              <span>NPWP</span>
              <span>: {(record.npwp || '').trim() || '-'}</span>
            </div>
            <div className="wo-kv">
              <span>Alamat</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <span>:</span>
                <span>{alamatFull || '-'}</span>
              </span>
            </div>
          </div>
          <div className="wo-right">
            <div className="wo-kv">
              <span>No PO</span>
              <span>: {record.poNo || '-'}</span>
            </div>
            <div className="wo-kv">
              <span>Tanggal</span>
              <span>: {fmtTanggal(record.poDate)}</span>
            </div>
            <div className="wo-kv">
              <span>Kontak Personal</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <span>:</span>
                <span>{kontak}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <table className="wo-table">
        <thead>
          <tr>
            <th className="no">No</th>
            <th>Uraian</th>
            <th className="jml">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const sub = Math.round((Number(it.price) || 0) * (Number(it.qty) || 0));
            const qtyNote =
              Number(it.qty) !== 1 ? ` (${nf.format(Number(it.qty) || 0)} ${it.satuan})` : '';
            return (
              <tr key={it.id}>
                <td className="no">{i + 1}</td>
                <td>
                  {it.itemName}
                  {qtyNote}
                </td>
                <td className="jml">{rp(sub)}</td>
              </tr>
            );
          })}
          <tr className="blank">
            <td className="no" />
            <td />
            <td className="jml" />
          </tr>
          <tr className="sum">
            <td colSpan={2} className="lbl">
              Sub Total
            </td>
            <td className="jml">{rp(totals.jumlah)}</td>
          </tr>
          <tr>
            <td colSpan={2} className="lbl">
              PPN
            </td>
            <td className="jml">{rp(totals.ppn)}</td>
          </tr>
          <tr>
            <td colSpan={2} className="lbl">
              Total
            </td>
            <td className="jml">{rp(totals.total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="wo-sign">
        <div>
          Approved By:
          <br />
          {pel.nama || ''}
          <div className="wo-space" />
        </div>
        <div>
          Agree By:
          <br />
          {DOC_CONFIG.perusahaan}
          <div className="wo-space" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ttd ? <SignatureImg src={ttd} alt={`TTD ${ttdOrang.jabatan}`} w={120} h={56} /> : null}
          </div>
          <u>{ttdOrang.nama}</u>
          <br />
          {ttdOrang.jabatan}
        </div>
      </div>

      <div className="wo-catatan">
        Catatan:
        <ul>
          {catatan.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>

      <div className="wo-bank">
        Nama Bank: {wo.bank}
        <br />
        AC No &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {wo.noRek}
        <br />
        Atas Nama : {wo.atasNama}
      </div>

      <div className="wo-nb">NB: {wo.nb}</div>
    </article>
  );
});

interface ModalProps {
  record: JoSoRecord;
  signatures?: Record<string, string>;
  onClose: () => void;
  onToast: (msg: string) => void;
}

/** Pratinjau Work Order + unduh PDF. */
export function WorkOrderModal({ record, signatures, onClose, onToast }: ModalProps) {
  const paperRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(() =>
    typeof window === 'undefined' ? 1 : Math.min(1, (window.innerWidth - 40) / 794)
  );

  useEffect(() => {
    const onResize = () => setZoom(Math.min(1, (window.innerWidth - 40) / 794));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = async () => {
    if (!paperRef.current || busy) return;
    setBusy(true);
    try {
      const el = paperRef.current;
      const prevZoom = el.style.zoom;
      el.style.zoom = '1';
      const tall = el.scrollHeight > 1250; // banyak item: izinkan lebih dari satu halaman
      el.style.zoom = prevZoom;
      const name = workOrderFilename(record);
      await exportElementToPdf(el, { filename: `${name}.pdf`, singlePageFit: !tall });
      onToast(`PDF "${name}.pdf" diunduh`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal membuat file PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <div className="min-w-0">
          <div className="font-display text-sm font-extrabold text-slate-900">Pratinjau Work Order</div>
          <div className="text-xs text-slate-500 truncate">{record.poNo || record.noPenawaran || record.title}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Unduh PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Tutup"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <WorkOrderPaper ref={paperRef} record={record} signatures={signatures} zoom={zoom} />
      </div>
    </div>
  );
}
