import { useEffect, useRef, useState } from 'react';
import { Camera, MapPin, X } from 'lucide-react';
import { AttendanceRecord, Inspector, MAX_FILE_BYTES, Project } from '../types/portal';
import { formatDateTime } from '../utils/portalUtils';

interface CameraModalProps {
  project: Project;
  inspector: Inspector;
  type: 'in' | 'out';
  onClose: () => void;
  onCapture: (record: AttendanceRecord) => void;
}

export function CameraModal({
  project,
  inspector,
  type,
  onClose,
  onCapture,
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [statusText, setStatusText] = useState('Menyiapkan kamera dan GPS…');
  const [canLiveSnap, setCanLiveSnap] = useState(false);
  const [showSimFallback, setShowSimFallback] = useState(false);
  const posRef = useRef<GeolocationPosition | null>(null);

  useEffect(() => {
    let active = true;

    const gpsPromise = new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });

    const camPromise = navigator.mediaDevices
      ? navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).catch(() => null)
      : Promise.resolve(null);

    Promise.all([camPromise, gpsPromise]).then(([stream, pos]) => {
      if (!active) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      posRef.current = pos;
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (stream && pos) {
        setStatusText(`Kamera dan GPS siap (akurasi ±${Math.round(pos.coords.accuracy)} m).`);
        setCanLiveSnap(true);
      } else {
        const missing = stream ? 'GPS' : pos ? 'Kamera' : 'Kamera dan GPS';
        setStatusText(
          `${missing} tidak tersedia di tampilan ini. Gunakan mode simulasi untuk mencoba alur absensi.`
        );
        setShowSimFallback(true);
      }
    });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const drawWatermark = (ctx: CanvasRenderingContext2D, w: number, h: number, lines: string[]) => {
    const lh = Math.max(11, Math.round(w / 34));
    const bh = lines.length * (lh + 4) + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, h - bh, w, bh);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${lh}px sans-serif`;
    lines.forEach((line, idx) => {
      ctx.fillText(line, 10, h - bh + 8 + (idx + 1) * (lh + 4) - 4);
    });
  };

  const handleCapture = (isSim: boolean) => {
    const w = 640;
    const h = 480;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isSim || !videoRef.current) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 24px sans-serif';
      ctx.fillText('SIMULASI — Tanpa Kamera Langsung', 110, 220);
    } else {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    const pos = isSim ? null : posRef.current;
    const nowIso = new Date().toISOString();
    drawWatermark(ctx, w, h, [
      `${inspector.nama} · ${type === 'in' ? 'CHECK-IN' : 'CHECK-OUT'}`,
      `${project.perusahaan} — ${project.kota}`,
      formatDateTime(nowIso),
      pos
        ? `GPS ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)} (±${Math.round(pos.coords.accuracy)} m)`
        : 'GPS tidak tersedia (simulasi)',
    ]);

    let q = 0.8;
    let dataUrl = canvas.toDataURL('image/jpeg', q);
    while (dataUrl.length * 0.75 > MAX_FILE_BYTES && q > 0.3) {
      q -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', q);
    }

    onCapture({
      id: `att-${Date.now()}`,
      ins: inspector.id,
      type,
      at: nowIso,
      lat: pos ? pos.coords.latitude : null,
      lon: pos ? pos.coords.longitude : null,
      acc: pos ? pos.coords.accuracy : 0,
      img: dataUrl,
      mode: isSim ? 'sim' : 'live',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <h3 className="font-display text-base font-bold text-slate-900">
              {type === 'in' ? 'Absensi Selfie Masuk (Check-In)' : 'Absensi Selfie Pulang (Check-Out)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-900 rounded-xl overflow-hidden aspect-4/3 max-h-[50vh] flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover -scale-x-100"
          />
        </div>

        <p className="mt-3 text-xs text-slate-600 flex items-start gap-1.5 leading-relaxed">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>{statusText}</span>
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canLiveSnap}
            onClick={() => handleCapture(false)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            Ambil Foto Selfie
          </button>
          {showSimFallback && (
            <button
              type="button"
              onClick={() => handleCapture(true)}
              className="py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
            >
              Gunakan Mode Simulasi (Demo)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
