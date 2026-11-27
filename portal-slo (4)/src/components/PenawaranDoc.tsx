import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { DOC_CONFIG, Pelanggan, SuratPenawaran } from '../types/portal';
import { LOGO } from '../constants/logos';
import { findSignature } from '../utils/portalUtils';
import { exportElementToPdf } from '../utils/pdfExport';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { SignatureImg } from './SignatureImg';
import { namaPelangganLengkap } from './PelangganMenu';
import { DEFAULT_UP, hitungPenawaran, stripHeadingPersyaratan, terbilangRupiah } from '../utils/penawaranUtils';

/** Format angka ala surat penawaran: 11.000.000,00 */
const money = (n: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round(n || 0));
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

function fmtTanggal(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function penawaranFilename(rec: SuratPenawaran): string {
  return `SuratPenawaran-${(rec.noPenawaran || 'draft').replace(/[^\w.-]+/g, '-')}`;
}

const PAGE_H = 1123;
const page: React.CSSProperties = { padding: '34px 48px 36px', minHeight: PAGE_H, boxSizing: 'border-box' };
const rowLine: React.CSSProperties = { borderBottom: '1px solid #000' };
const tdBase: React.CSSProperties = { padding: '5px 4px', verticalAlign: 'top' };

interface PaperProps {
  record: SuratPenawaran;
  pelanggan?: Pelanggan;
  signatures?: Record<string, string>;
  zoom?: number;
}

function Kop() {
  return (
    <header className="wo-kop" style={{ alignItems: 'center' }}>
      <img src={LOGO.kiri} alt="Sabda Duta Paramitha" />
      <img src={LOGO.kanan} alt="ISO 9001:2015" />
    </header>
  );
}

/** Lembar surat penawaran A4: halaman 1 = surat & rincian harga, halaman 2 = lampiran persyaratan. */
export const PenawaranPaper = React.forwardRef<HTMLElement, PaperProps>(function PenawaranPaper(
  { record, pelanggan, signatures, zoom = 1 },
  ref,
) {
  const wo = DOC_CONFIG.workOrder;
  const { jumlah, ppn, total, rate } = hitungPenawaran(record.items, record.ppn);
  const ttdOrang = DOC_CONFIG.penandatangan.find((p) => p.nama === record.penandatangan) ?? wo.penandatangan;
  const ttd = findSignature(signatures, ttdOrang.nama);
  const alamat = [pelanggan?.alamat, pelanggan?.kabKota].filter(Boolean).join(' ');
  const kepada = pelanggan ? namaPelangganLengkap(pelanggan) : record.pelangganNama;
  const persyaratan = stripHeadingPersyaratan(record.caraPembayaran);
  const dataPers = record.dataPersyaratan ?? '';
  const adaLampiran = Boolean(persyaratan.trim() || dataPers.trim());
  const labelPpn = rate ? `PPN ${rate}%` : 'PPN';

  return (
    <article ref={ref} className="wo-paper" style={{ zoom, padding: 0, minHeight: 0 }}>
      {/* ---------------- Halaman 1 ---------------- */}
      <section data-pnw-page="1" style={page}>
        <Kop />

        <div style={{ textAlign: 'right', marginTop: 8 }}>Surabaya, {fmtTanggal(record.tanggal)}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 2 }}>
          <table style={{ borderCollapse: 'collapse', alignSelf: 'flex-start' }}>
            <tbody>
              {[
                ['No', record.noPenawaran],
                ['Hal', record.perihal],
                ['Lampiran', record.lampiran],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: '1px 10px 1px 4px', verticalAlign: 'top' }}>{k}</td>
                  <td style={{ padding: '1px 0', verticalAlign: 'top' }}>: &nbsp;{v || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ width: 300 }}>
            <div>Kepada</div>
            <div>{kepada}</div>
            {alamat && <div>{alamat}</div>}
          </div>
        </div>

        <div style={{ marginTop: 26 }}>Up {record.up || DEFAULT_UP}</div>

        <div className="rte-content" style={{ marginTop: 14, fontSize: 12, textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(record.denganHormat) }} />

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20, fontSize: 12 }}>
          <tbody>
            {record.items.map((it, i) => (
              <tr key={it.id} style={i === record.items.length - 1 ? rowLine : undefined}>
                <td style={{ ...tdBase, width: 30 }}>{i + 1}</td>
                <td style={tdBase}>
                  {it.nama}
                  {it.qty !== 1 && (
                    <div style={{ fontSize: 10.5, color: '#334155' }}>
                      {nf.format(it.qty)} {it.satuan} × Rp {money(it.harga)}
                    </div>
                  )}
                </td>
                <td style={{ ...tdBase, width: 28 }}>Rp</td>
                <td style={{ ...tdBase, width: 110, textAlign: 'right' }}>{money(it.qty * it.harga)}</td>
              </tr>
            ))}
            {record.items.length === 0 && (
              <tr style={rowLine}>
                <td colSpan={4} style={{ ...tdBase, color: '#64748b' }}>
                  (belum ada item)
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={2} style={tdBase}>
                Jumlah
              </td>
              <td style={tdBase}>Rp</td>
              <td style={{ ...tdBase, textAlign: 'right' }}>{money(jumlah)}</td>
            </tr>
            <tr style={rowLine}>
              <td colSpan={2} style={tdBase}>
                {labelPpn}
              </td>
              <td style={tdBase}>Rp</td>
              <td style={{ ...tdBase, textAlign: 'right' }}>{money(ppn)}</td>
            </tr>
            <tr>
              <td colSpan={2} style={tdBase}>
                Jumlah Total
              </td>
              <td style={tdBase}>Rp</td>
              <td style={{ ...tdBase, textAlign: 'right' }}>{money(total)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 12, fontWeight: 700 }}>
          <div>Terbilang : {terbilangRupiah(total)}</div>
          <div>({rate ? `Biaya sudah termasuk PPN ${rate}%` : 'Biaya belum termasuk PPN'})</div>
        </div>

        {record.catatan && (
          <div className="rte-content" style={{ marginTop: 12, fontSize: 12 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(record.catatan) }} />
        )}

        <div style={{ marginTop: 2 }}>Demikian disampaikan, terima kasih atas kepercayaan dan kesempatan yang telah diberikan.</div>

        <div style={{ marginTop: 22, width: 230, marginLeft: 'auto', textAlign: 'center', breakInside: 'avoid' }}>
          <div style={{ fontWeight: 700 }}>PT. Sabda Duta Paramitha</div>
          {ttd ? <SignatureImg src={ttd} alt="TTD Direktur" w={120} h={56} /> : <div style={{ height: 78 }} />}
          <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{ttdOrang.nama}</div>
          <div style={{ fontWeight: 700 }}>{ttdOrang.jabatan}</div>
        </div>
      </section>

      {/* ---------------- Halaman 2: Lampiran ---------------- */}
      {adaLampiran && (
        <section data-pnw-page="2" style={page}>
          <Kop />
          <div style={{ marginTop: 14 }}>
            Lamp Surat Penawaran Nomor <b>{record.noPenawaran}</b>
            <br />
            Tanggal <b>{fmtTanggal(record.tanggal)}</b>
          </div>

          {persyaratan.trim() && (
            <>
              <div style={{ marginTop: 22, fontWeight: 700 }}>Persyaratan SLO Pembangkit:</div>
              <div className="rte-content" style={{ marginTop: 10, fontSize: 12, paddingLeft: 14 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(persyaratan) }} />
            </>
          )}

          {dataPers.trim() && (
            <>
              <div style={{ marginTop: 22, fontWeight: 700 }}>Data-data untuk keperluan Uji Laik Operasi disediakan oleh Kontraktor/Pemilik Instalasi, yaitu :</div>
              <div className="rte-content" style={{ marginTop: 6, fontSize: 12, paddingLeft: 40 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(dataPers) }} />
            </>
          )}
        </section>
      )}
    </article>
  );
});

interface ModalProps {
  record: SuratPenawaran;
  pelanggan?: Pelanggan;
  signatures?: Record<string, string>;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function PenawaranModal({ record, pelanggan, signatures, onClose, onToast }: ModalProps) {
  const paperRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(() => (typeof window === 'undefined' ? 1 : Math.min(1, (window.innerWidth - 40) / 794)));

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
      const p1 = el.querySelector<HTMLElement>('[data-pnw-page="1"]');
      const hasP2 = Boolean(el.querySelector('[data-pnw-page="2"]'));
      const prevMin = p1?.style.minHeight ?? '';
      // Lampiran harus mulai tepat di awal halaman A4 kedua (kelipatan tinggi A4).
      if (p1 && hasP2) p1.style.minHeight = `${Math.max(1, Math.ceil(p1.offsetHeight / 1123 - 0.01)) * 1123}px`;
      const tall = el.scrollHeight > 1250;
      el.style.zoom = prevZoom;
      const restore = () => {
        if (p1) p1.style.minHeight = prevMin;
      };
      const name = penawaranFilename(record);
      try {
        await exportElementToPdf(el, { filename: `${name}.pdf`, singlePageFit: !tall });
      } finally {
        restore();
      }
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
          <div className="font-display text-sm font-extrabold text-slate-900">Pratinjau SuratPenawaran</div>
          <div className="text-[11px] text-slate-500 truncate">{record.noPenawaran}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-60 text-white text-xs font-semibold shadow-xs cursor-pointer"
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
        <PenawaranPaper ref={paperRef} record={record} pelanggan={pelanggan} signatures={signatures} zoom={zoom} />
      </div>
    </div>
  );
}
