import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock, Download, ImageIcon, Info, Upload } from 'lucide-react';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const FONT = 'Roboto, Arial, sans-serif';
const MAX_SIZE = 3000; // sisi terpanjang hasil (px)
const BASE = 1200; // lebar acuan untuk skala teks
const ACCENT = '#f5a623';
const TEXT_SCALE = 0.8;

const TIPS = {
  photo: ['Upload foto', 'Ketuk kotak upload atau seret foto ke sana. Format JPG, PNG atau WEBP. Pratinjau langsung tampil.'],
  date: ['Tanggal & tahun', 'Pilih tanggal pada kolom. Nama hari tercetak otomatis pada foto. Tombol "Sekarang" mengisi tanggal sesuai perangkat Anda.'],
  time: ['Waktu', 'Pilih jam pada kolom Waktu, atau tekan "Sekarang" untuk memakai jam perangkat Anda.'],
  coord: ['Titik koordinat', 'Salin dari Google Maps: tekan lama pada titik lokasi, lalu salin angkanya. Contoh: -7.314318992981337, 112.72693176654602.'],
  addr: ['Alamat', 'Salin titik koordinat, tempel di kolom pencarian Google Maps, lalu salin alamat yang muncul dan tempel di sini. Atau ketik alamat lengkap secara manual. Teks otomatis turun ke baris berikutnya bila panjang.'],
} as const;
type TipKey = keyof typeof TIPS;

const ROBOTO_URL = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400&display=swap';

/** Font Roboto hanya dimuat saat menu Tagging Foto dibuka; selesai bila font siap (maks. 3 detik). */
function loadRoboto(): Promise<void> {
  let link = document.getElementById('font-roboto-tagging') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'font-roboto-tagging';
    link.rel = 'stylesheet';
    link.href = ROBOTO_URL;
    document.head.appendChild(link);
  }
  const el = link;
  const sheetReady = new Promise<void>((resolve) => {
    if (el.sheet) return resolve();
    el.addEventListener('load', () => resolve(), { once: true });
    el.addEventListener('error', () => resolve(), { once: true });
    setTimeout(resolve, 3000);
  });
  return sheetReady
    .then(() => Promise.all([document.fonts.load('300 40px Roboto'), document.fonts.load('400 40px Roboto')]))
    .then(() => undefined)
    .catch(() => undefined);
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const nowStr = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

function formatDate(value: string) {
  if (!value) return '';
  const p = value.split('-');
  return `${p[2]} ${MONTHS[+p[1] - 1]} ${p[0]}`;
}

function getDayName(value: string) {
  if (!value) return '';
  const p = value.split('-');
  return DAYS[new Date(+p[0], +p[1] - 1, +p[2]).getDay()];
}

const INPUT =
  'w-full px-3.5 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl transition focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/15';

function SectionTitle({ n, label, tip }: { n: number; label: string; tip: TipKey }) {
  return (
    <div className="flex items-center gap-2.5 mb-2.5">
      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
        {n}
      </span>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <span className="relative group inline-flex">
        <button
          type="button"
          aria-label={`Info: ${TIPS[tip][0]}`}
          className="w-4 h-4 rounded-full bg-slate-800 text-white inline-flex items-center justify-center cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Info className="w-2.5 h-2.5" />
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-6 z-30 w-64 max-w-[70vw] rounded-xl bg-slate-900 text-slate-100 text-[11px] leading-relaxed p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition"
        >
          <b className="block text-[#38BDF8] mb-0.5">{TIPS[tip][0]}</b>
          {TIPS[tip][1]}
        </span>
      </span>
    </div>
  );
}

export function TaggingFoto() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<CanvasImageSource & { width: number; height: number } | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [fileName, setFileName] = useState('');
  const [dragOn, setDragOn] = useState(false);
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState(nowStr);
  const [coord, setCoord] = useState('');
  const [addr, setAddr] = useState('');
  const [msg, setMsg] = useState('');

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const photo = photoRef.current;
    if (!canvas || !photo) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setShadow = (on: boolean) => {
      ctx.shadowColor = on ? 'rgba(0,0,0,.75)' : 'transparent';
      ctx.shadowBlur = on ? 8 : 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = on ? 2 : 0;
    };
    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const wrapText = (text: string, maxWidth: number) => {
      const lines: string[] = [];
      let line = '';
      text.split(/\s+/).forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      });
      if (line) lines.push(line);
      return lines;
    };

    const ratio = Math.min(1, MAX_SIZE / Math.max(photo.width, photo.height));
    const w = Math.round(photo.width * ratio);
    const h = Math.round(photo.height * ratio);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(photo, 0, 0, w, h);
    ctx.textBaseline = 'alphabetic';

    const s = (Math.min(w, h) / BASE) * TEXT_SCALE;
    const left = 36 * s;

    // Kotak koordinat
    let boxTop = h - 24 * s;
    const coordText = coord.trim();
    if (coordText) {
      const boxH = 88 * s;
      const boxX = 26 * s;
      const boxY = h - 24 * s - boxH;
      const label = `Koordinat: ${coordText}`;
      ctx.font = `400 ${44 * s}px ${FONT}`;
      const boxW = ctx.measureText(label).width + 44 * s;
      setShadow(false);
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      roundRect(boxX, boxY, boxW, boxH, 16 * s);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, boxX + 22 * s, boxY + boxH / 2 + 15 * s);
      boxTop = boxY;
    }

    // Alamat
    let addrTop = boxTop - 10 * s;
    const addrText = addr.trim();
    if (addrText) {
      const lineHeight = 58 * s;
      const lastBaseline = boxTop - 26 * s;
      ctx.font = `400 ${40 * s}px ${FONT}`;
      const lines = wrapText(addrText, Math.min(w - left * 2, w * 0.7));
      setShadow(true);
      ctx.fillStyle = '#fff';
      lines.forEach((line, i) => {
        ctx.fillText(line, left, lastBaseline - (lines.length - 1 - i) * lineHeight);
      });
      addrTop = lastBaseline - (lines.length - 1) * lineHeight - 40 * s;
    }

    // Waktu + tanggal
    const baseline = addrTop - 34 * s;
    ctx.font = `300 ${150 * s}px ${FONT}`;
    ctx.fillStyle = '#fff';
    setShadow(true);
    ctx.fillText(time || '', left, baseline);
    const dividerX = left + ctx.measureText(time || '').width + 26 * s;
    setShadow(false);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(dividerX, baseline - 112 * s, 4 * s, 112 * s);
    setShadow(true);
    ctx.fillStyle = '#fff';
    ctx.font = `400 ${40 * s}px ${FONT}`;
    ctx.fillText(formatDate(date), dividerX + 24 * s, baseline - 62 * s);
    ctx.fillText(getDayName(date), dividerX + 24 * s, baseline - 4 * s);
    setShadow(false);
  }, [addr, coord, date, time]);

  // Gambar ulang setiap input berubah
  useEffect(() => {
    if (hasPhoto) render();
  }, [hasPhoto, render]);

  // Muat font Roboto saat menu dibuka, lalu gambar ulang begitu font siap
  const renderRef = useRef(render);
  renderRef.current = render;
  useEffect(() => {
    let alive = true;
    void loadRoboto().then(() => {
      if (alive && photoRef.current) renderRef.current();
    });
    return () => {
      alive = false;
    };
  }, []);

  const showPhoto = (img: CanvasImageSource & { width: number; height: number }) => {
    photoRef.current = img;
    setMsg('');
    setHasPhoto(true);
    // Pastikan font Roboto siap lalu gambar ulang
    try {
      Promise.race([
        Promise.all([document.fonts.load('300 40px Roboto'), document.fonts.load('400 40px Roboto')]),
        new Promise((r) => setTimeout(r, 1200)),
      ]).then(() => render());
    } catch {
      /* abaikan */
    }
  };

  const photoFailed = () =>
    setMsg('Foto tidak bisa dibuka. Gunakan format JPG, PNG atau WEBP (foto HEIC dari iPhone: ubah ke JPG / pilih "Paling Kompatibel").');

  const readWithFileReader = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => showPhoto(img);
      img.onerror = photoFailed;
      img.src = String(reader.result);
    };
    reader.onerror = photoFailed;
    reader.readAsDataURL(file);
  };

  const loadPhoto = (file?: File | null) => {
    if (!file) return;
    if (file.type && !file.type.startsWith('image')) {
      photoFailed();
      return;
    }
    setFileName(file.name);
    if (typeof createImageBitmap === 'function') {
      createImageBitmap(file).then(showPhoto, () => readWithFileReader(file));
    } else {
      readWithFileReader(file);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `foto-tag-${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        setMsg('Jika tidak terunduh, tekan lama / klik kanan pada gambar pratinjau lalu simpan.');
      },
      'image/jpeg',
      0.95
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-stretch">
      {/* Form */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5 space-y-5">
        <div>
          <SectionTitle n={1} label="Upload foto" tip="photo" />
          <label
            onDragEnter={(e) => { e.preventDefault(); setDragOn(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragOn(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOn(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOn(false);
              loadPhoto(e.dataTransfer.files[0]);
            }}
            className={`relative block px-4 py-6 text-center cursor-pointer rounded-2xl border-2 transition ${
              dragOn
                ? 'border-[#2563EB] bg-blue-50 border-dashed'
                : hasPhoto
                  ? 'border-[#2563EB] bg-slate-50 border-solid'
                  : 'border-slate-200 bg-slate-50 border-dashed hover:border-[#2563EB] hover:bg-blue-50/60'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => loadPhoto(e.target.files?.[0])}
            />
            <Upload className="w-7 h-7 mx-auto text-slate-400" />
            <b className="block mt-1.5 text-sm text-slate-800">Ketuk atau seret foto ke sini</b>
            <span className="text-xs text-slate-500">JPG, PNG, WEBP</span>
            {fileName && (
              <span className="block mt-1.5 text-xs font-medium text-[#2563EB] break-all">{fileName}</span>
            )}
          </label>
        </div>

        <div>
          <SectionTitle n={2} label="Tanggal" tip="date" />
          <div className="grid grid-cols-2 gap-2.5">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Tanggal" className={INPUT} />
            <button
              type="button"
              onClick={() => setDate(todayStr())}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer"
            >
              <CalendarDays className="w-4 h-4" /> Sekarang
            </button>
          </div>
        </div>

        <div>
          <SectionTitle n={3} label="Waktu" tip="time" />
          <div className="grid grid-cols-2 gap-2.5">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Waktu" className={INPUT} />
            <button
              type="button"
              onClick={() => setTime(nowStr())}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer"
            >
              <Clock className="w-4 h-4" /> Sekarang
            </button>
          </div>
        </div>

        <div>
          <SectionTitle n={4} label="Titik koordinat" tip="coord" />
          <input
            type="text"
            value={coord}
            onChange={(e) => setCoord(e.target.value)}
            placeholder="-7.314318, 112.726931"
            className={INPUT}
          />
        </div>

        <div>
          <SectionTitle n={5} label="Alamat" tip="addr" />
          <textarea
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            rows={3}
            className={`${INPUT} min-h-[78px] resize-y`}
          />
        </div>

        <div>
          <button
            type="button"
            disabled={!hasPhoto}
            onClick={handleDownload}
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white text-sm font-semibold shadow-sm shadow-blue-500/30 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity"
          >
            <Download className="w-4 h-4" /> Unduh foto
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">{msg || 'SEMOGA BERMANFAAT'}</p>
        </div>
      </div>

      {/* Pratinjau */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5 flex flex-col order-first lg:order-none">
        <div className="flex items-center justify-between mb-3">
          <b className="text-sm text-slate-800">Pratinjau</b>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] text-[11px] font-semibold">Langsung</span>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-[170px] lg:min-h-[260px] overflow-hidden rounded-xl bg-slate-50 border border-slate-200">
          {!hasPhoto && (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              Pratinjau akan tampil di sini
              <br />
              setelah foto diunggah.
            </div>
          )}
          <canvas
            ref={canvasRef}
            hidden={!hasPhoto}
            className="block w-auto h-auto max-w-full max-h-[42vh] lg:max-h-[78vh]"
          />
        </div>
      </div>
    </div>
  );
}
