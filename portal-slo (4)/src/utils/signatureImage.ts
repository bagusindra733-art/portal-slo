/**
 * Menyiapkan gambar TTD yang diunggah: memangkas margin kosong, membuat latar putih
 * menjadi transparan, lalu mengecilkan ke ukuran wajar (hemat penyimpanan & seragam di PDF).
 */
const MAX_W = 420;
const MAX_H = 170;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('File gambar TTD tidak dapat dibaca.'));
    img.src = url;
  });
}

export async function prepareSignatureImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('File TTD harus berupa gambar (PNG/JPG).');
  if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran gambar TTD maksimal 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    const scale0 = Math.min(1, 1200 / Math.max(sw, sh));
    const w0 = Math.max(1, Math.round(sw * scale0));
    const h0 = Math.max(1, Math.round(sh * scale0));
    const c0 = document.createElement('canvas');
    c0.width = w0;
    c0.height = h0;
    const x0 = c0.getContext('2d');
    if (!x0) throw new Error('Canvas tidak tersedia di browser ini.');
    x0.drawImage(img, 0, 0, w0, h0);
    const data = x0.getImageData(0, 0, w0, h0);
    const px = data.data;
    let minX = w0, minY = h0, maxX = -1, maxY = -1;
    for (let y = 0; y < h0; y++) {
      for (let x = 0; x < w0; x++) {
        const i = (y * w0 + x) * 4;
        const a = px[i + 3];
        const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
        // latar putih / hampir putih -> transparan
        if (a < 10 || lum > 235) {
          px[i + 3] = 0;
          continue;
        }
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) throw new Error('Gambar TTD tampak kosong. Gunakan tinta gelap di latar terang.');
    x0.putImageData(data, 0, 0);
    const pad = 4;
    const cx = Math.max(0, minX - pad);
    const cy = Math.max(0, minY - pad);
    const cw = Math.min(w0 - cx, maxX - minX + 1 + pad * 2);
    const ch = Math.min(h0 - cy, maxY - minY + 1 + pad * 2);
    const scale = Math.min(1, MAX_W / cw, MAX_H / ch);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cw * scale));
    out.height = Math.max(1, Math.round(ch * scale));
    const xo = out.getContext('2d');
    if (!xo) throw new Error('Canvas tidak tersedia di browser ini.');
    xo.drawImage(c0, cx, cy, cw, ch, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
