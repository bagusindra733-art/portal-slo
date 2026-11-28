import { ISTILAH } from '../data/istilah';

/** Singkatan dengan keterangan saat disentuh/diarahkan kursor (garis titik = ada penjelasan). */
export function Istilah({ k, children }: { k: string; children?: string }) {
  const item = ISTILAH[k];
  if (!item) return <>{children ?? k}</>;
  return (
    <abbr
      title={`${item.panjang} — ${item.arti}`}
      className="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-2"
    >
      {children ?? k}
    </abbr>
  );
}

export default Istilah;
