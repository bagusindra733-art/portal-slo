import React from 'react';

/** Ukuran baku kotak TTD pada dokumen (px, skala kertas A4 794px) agar semua TTD rapi & seragam. */
export const SIGN_W = 92;
export const SIGN_H = 38;

interface Props {
  src?: string;
  alt?: string;
  w?: number;
  h?: number;
}

/**
 * Menempel gambar TTD dalam kotak berukuran tetap (object-fit: contain),
 * sehingga ukuran gambar asli apa pun tampil seragam. Bila belum ada TTD, kotak dibiarkan kosong
 * dengan tinggi yang sama agar tata letak dokumen tidak bergeser.
 */
export function SignatureImg({ src, alt = 'TTD', w = SIGN_W, h = SIGN_H }: Props) {
  return (
    <div
      style={{
        width: w,
        height: h,
        margin: '2px auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : null}
    </div>
  );
}
