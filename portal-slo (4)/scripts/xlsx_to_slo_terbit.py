"""Ubah Excel 'permohonan_slo' (unduhan portal DJK) menjadi data portal.

Pemakaian:  python3 scripts/xlsx_to_slo_terbit.py <file1.xlsx> [file2.xlsx ...]
Hasil:
  src/data/sloTerbit.json  -> baris berposisi "SLO Terbit" (halaman SLO Terbit & Generate SLO otomatis)
  src/data/djkPosisi.json  -> No. Agenda -> tulisan kolom "Posisi" untuk baris yang BELUM terbit
                              (mengisi Evaluasi DJK: Prepare / Review 1 / Review 2 / Approve)
Beberapa file boleh diberikan sekaligus (digabung). Perlu: pip install openpyxl.
Jalankan ulang tiap kali ada Excel terbaru, lalu build/deploy ulang.
"""
import json, re, sys, pathlib
import openpyxl

COLS = {
    'Tgl. Permohonan Sertifikasi': 'tglPermohonan',
    'Tgl. Permohonan Registrasi': 'tglRegistrasi',
    'No. Agenda': 'noAgenda',
    'Nama Pemilik': 'pemilik',
    'Nama Instalasi': 'instalasi',
    'Jenis Instalasi': 'jenis',
    'Kapasitas/Daya': 'kapasitas',
    'Verifikator': 'verifikator',
    'NIDI': 'nidi',
    'Bidang': 'bidang',
    'Sub Bidang': 'subBidang',
    'Tipe Layanan': 'tipe',
    'Lokasi Instalasi': 'lokasi',
    'Desa / Kelurahan': 'desa',
    'Kecamatan': 'kecamatan',
    'Kota / Kabupaten': 'kota',
    'Provinsi': 'provinsi',
    'Longitude': 'lon',
    'Latitude': 'lat',
    'Tanggal Terbit': 'tglTerbit',
    'Tanggal Habis Masa Berlaku': 'tglHabis',
    'No. SLO': 'noSlo',
    'No. Register SLO': 'noRegister',
}
DATE_FIELDS = {'tglPermohonan', 'tglRegistrasi', 'tglTerbit', 'tglHabis'}

def norm_agenda(v):
    return re.sub(r'\s+', '', str(v or '')).upper()


terbit = {}
posisi = {}
for arg in sys.argv[1:]:
    ws = openpyxl.load_workbook(pathlib.Path(arg), read_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    head = [str(h).strip() if h else '' for h in rows[0]]
    for r in rows[1:]:
        rec = dict(zip(head, r))
        pos = str(rec.get('Posisi') or '').strip()
        if pos != 'SLO Terbit' or not rec.get('No. SLO'):
            agenda = norm_agenda(rec.get('No. Agenda'))
            if agenda and pos:
                posisi[agenda] = pos
            continue
        item = {}
        for src_name, key in COLS.items():
            v = rec.get(src_name)
            if v is None:
                v = ''
            if hasattr(v, 'strftime'):
                v = v.strftime('%Y-%m-%d')
            elif key in DATE_FIELDS:
                v = str(v)[:10]
            elif key in ('lon', 'lat'):
                v = round(float(v), 6) if v != '' else None
            else:
                v = str(v).strip()
            item[key] = v
        terbit[item['noSlo']] = item

out = sorted(terbit.values(), key=lambda x: x['tglTerbit'], reverse=True)
# Instalasi yang sudah terbit tidak perlu muncul lagi di daftar posisi
for item in out:
    posisi.pop(norm_agenda(item['noAgenda']), None)

data_dir = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'data'
(data_dir / 'sloTerbit.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(data_dir / 'djkPosisi.json').write_text(json.dumps(posisi, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(out)} SLO terbit, {len(posisi)} permohonan belum terbit -> {data_dir}')
