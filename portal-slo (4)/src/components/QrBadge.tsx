import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrBadgeProps {
  value: string;
  size?: number;
}

export function QrBadge({ value, size = 124 }: QrBadgeProps) {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500"
        style={{ width: size, height: size }}
      >
        QR
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="QR Code Validasi SLO"
      width={size}
      height={size}
      className="rounded-lg border border-slate-200 bg-white p-1.5"
    />
  );
}
