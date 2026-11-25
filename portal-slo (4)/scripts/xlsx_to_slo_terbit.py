"""Ubah Excel 'permohonan_slo' (unduhan portal DJK) menjadi src/data/sloTerbit.json.

Pemakaian:  python3 scripts/xlsx_to_slo_terbit.py <file.xlsx>
Perlu: pip install openpyxl. Jalankan ulang tiap kali ada Excel terbaru, lalu build/deploy ulang.
"""
import json, sys, pathlib
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

src = pathlib.Path(sys.argv[1])
ws = openpyxl.load_workbook(src, read_only=True).active
rows = list(ws.iter_rows(values_only=True))
head = [str(h).strip() if h else '' for h in rows[0]]
out = []
for r in rows[1:]:
    rec = dict(zip(head, r))
    if str(rec.get('Posisi') or '').strip() != 'SLO Terbit' or not rec.get('No. SLO'):
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
    out.append(item)
out.sort(key=lambda x: x['tglTerbit'], reverse=True)
dest = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'data' / 'sloTerbit.json'
dest.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(out)} SLO terbit -> {dest}')
