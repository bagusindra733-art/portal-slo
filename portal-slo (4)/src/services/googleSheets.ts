import {
  AppDatabaseState,
  DocArchiveRecord,
  Inspector,
  JoSoRecord,
  JsaData,
  Project,
  SavedDocType,
  SuratJalanData,
  SuratTugasData,
  Tool,
} from '../types/portal';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export const DATABASE_TABS = [
  'Proyek',
  'Inspektor',
  'AlatUji',
  'SuratTugas',
  'SuratJalan',
  'JSA',
  'RekapSOJO',
  'RekapDokumen',
] as const;

export type DatabaseTabName = (typeof DATABASE_TABS)[number];

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties: { title: string };
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
      index: number;
    };
  }>;
}

async function apiFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `Google API Error (${res.status})`;
    try {
      const errJson = await res.json();
      msg = errJson?.error?.message || msg;
    } catch {
      // ignore json parse failure
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function listAppSpreadsheets(accessToken: string): Promise<DriveSpreadsheetFile[]> {
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,webViewLink,modifiedTime)');
  const data = await apiFetch<{ files?: DriveSpreadsheetFile[] }>(
    `${DRIVE_API}?q=${q}&orderBy=modifiedTime desc&pageSize=25&fields=${fields}`,
    accessToken
  );
  return data.files || [];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  return apiFetch<SpreadsheetMetadata>(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title,index)`,
    accessToken
  );
}

export async function ensureDatabaseTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.properties.title));
  const missingTabs = DATABASE_TABS.filter((t) => !existingTitles.has(t));

  if (missingTabs.length > 0) {
    await apiFetch(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        requests: missingTabs.map((title) => ({
          addSheet: {
            properties: {
              title,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        })),
      }),
    });
    return getSpreadsheetMetadata(accessToken, spreadsheetId);
  }
  return meta;
}

function serializeStateToTabRows(state: AppDatabaseState): Record<DatabaseTabName, string[][]> {
  const proyekRows: string[][] = [
    [
      'ID',
      'No_RFQ',
      'Perusahaan',
      'Kota',
      'Jenis',
      'Sub_Jenis',
      'Kapasitas',
      'Status',
      'Penawaran_JSON',
      'Team_JSON',
      'Docs_JSON',
      'Absensi_JSON',
      'Form_LHPP_JSON',
      'Temuan_JSON',
      'BAP_JSON',
      'PJT_JSON',
      'SLO_JSON',
      'PO_JSON',
      'Transfer_JSON',
      'Log_JSON',
      'Files_JSON',
      'Workflow_Meta_JSON',
    ],
    ...state.proj.map((p) => [
      p.id,
      p.no,
      p.perusahaan,
      p.kota,
      p.jenis,
      p.sub,
      p.kap,
      p.status,
      JSON.stringify(p.penawaran),
      JSON.stringify(p.team),
      JSON.stringify(p.docs),
      JSON.stringify(p.att),
      JSON.stringify(p.form),
      JSON.stringify(p.finds),
      JSON.stringify(p.bap),
      JSON.stringify(p.pjt),
      JSON.stringify(p.slo),
      JSON.stringify(p.po),
      JSON.stringify(p.transfer),
      JSON.stringify(p.log),
      JSON.stringify(p.files),
      JSON.stringify({
        pjtName: p.pjtName,
        salesReadiness: p.salesReadiness,
        salesMessage: p.salesMessage,
        adminForwardNote: p.adminForwardNote,
        workflowStage: p.workflowStage,
        publishedToWorkMenu: p.publishedToWorkMenu,
        docTte: p.docTte,
        signedScans: p.signedScans,
        leaderMessages: p.leaderMessages,
      }),
    ]),
  ];

  const inspektorRows: string[][] = [
    ['ID', 'Nama', 'No_Reg_TTK', 'Serkom_SD', 'K3_SD'],
    ...state.insp.map((i) => [i.id, i.nama, i.noReg, i.serkom, i.k3]),
  ];

  const alatRows: string[][] = [
    ['ID', 'Nama_Alat', 'No_Seri', 'Kalibrasi_SD'],
    ...state.tools.map((t) => [t.id, t.nama, t.sn, t.cal]),
  ];

  const st = state.suratTugas;
  const suratTugasRows: string[][] = [
    [
      'ID',
      'Project_ID',
      'Jenis_ST',
      'Nomor_Urut',
      'Bulan',
      'Tahun',
      'Penandatangan_Idx',
      'PJT',
      'Tenaga_Teknik_JSON',
      'Jenis_Pekerjaan',
      'Tipe_Instalasi',
      'Tipe_Manual',
      'Unit',
      'Kapasitas',
      'Satuan',
      'Pemilik',
      'Lokasi',
      'Mulai',
      'Selesai',
      'Kota',
      'Tanggal',
      'Updated_At',
    ],
    [
      st.id,
      st.projectId || '',
      st.jenisAktif,
      st.nomorUrut,
      st.nomorBulan,
      st.nomorTahun,
      String(st.penandatanganIdx),
      st.pjt,
      JSON.stringify(st.tenagaTeknik),
      st.jenisPekerjaan,
      st.tipe,
      st.tipeManual,
      st.unit,
      st.kap,
      st.satuan,
      st.pemilik,
      st.lokasi,
      st.mulai,
      st.selesai,
      st.kota,
      st.tgl,
      st.updatedAt,
    ],
  ];

  const sj = state.suratJalan;
  const suratJalanRows: string[][] = [
    [
      'ID',
      'Surat_Tugas_ID',
      'Items_JSON',
      'Kendaraan_Tampil',
      'Kendaraan',
      'Tool_Keeper',
      'Menyetujui_Idx',
      'Updated_At',
    ],
    [
      sj.id,
      sj.suratTugasId,
      JSON.stringify(sj.items),
      sj.kendTampil ? 'TRUE' : 'FALSE',
      sj.kendaraan,
      sj.keeper,
      String(sj.ttdIdx),
      sj.updatedAt,
    ],
  ];

  const jsa = state.jsa;
  const jsaRows: string[][] = [
    [
      'ID',
      'Surat_Tugas_ID',
      'Ketua',
      'Pelaksana_JSON',
      'Jenis_Pekerjaan_JSON',
      'Kegiatan',
      'Jenis_Peralatan_JSON',
      'Potensi_Bahaya_JSON',
      'APD_JSON',
      'Updated_At',
    ],
    [
      jsa.id,
      jsa.suratTugasId,
      jsa.ketua,
      JSON.stringify(jsa.pelaksana),
      JSON.stringify(jsa.jenisChecks),
      jsa.kegiatan,
      JSON.stringify(jsa.alatChecks),
      JSON.stringify(jsa.bahayaChecks),
      JSON.stringify(jsa.apdChecks),
      jsa.updatedAt,
    ],
  ];

  const rekapSoJoRows: string[][] = [
    [
      'ID',
      'No_Penawaran',
      'Tanggal_Penawaran',
      'Perihal',
      'Lampiran',
      'Tanggal_Permintaan',
      'Kepada_Alamat',
      'Jenis_Instalasi_Penawaran',
      'Status',
      'Masa_Berlaku',
      'PPN_Rate',
      'PO_No',
      'Title',
      'PO_Date',
      'PO_Expired_Date',
      'DP',
      'Pelanggan_Alamat',
      'Jenis_Instalasi_JO',
      'Payment_Term',
      'Detail_Item_JSON',
      'Documents_JSON',
      'Updated_At',
      'Project_ID',
      'Sales_Workflow_JSON',
    ],
    ...(state.joSoRecords || []).map((rec) => [
      rec.id,
      rec.noPenawaran,
      rec.tanggalPenawaran,
      rec.perihal,
      rec.lampiran,
      rec.tanggalPermintaan,
      rec.kepadaAlamat,
      rec.jenisInstalasiPenawaran,
      rec.status,
      String(rec.masaBerlaku),
      String(rec.ppnRate),
      rec.poNo,
      rec.title,
      rec.poDate,
      rec.poExpiredDate,
      String(rec.dp),
      rec.pelangganAlamat,
      rec.jenisInstalasiJo,
      rec.paymentTerm,
      JSON.stringify(rec.items),
      JSON.stringify(rec.documents),
      rec.updatedAt,
      rec.projectId || '',
      JSON.stringify({
        salesReadiness: rec.salesReadiness,
        salesMessage: rec.salesMessage,
        sentToAdminAt: rec.sentToAdminAt,
      }),
    ]),
  ];

  const rekapDokumenRows: string[][] = [
    [
      'ID',
      'Jenis_Dokumen',
      'Nomor_Dokumen',
      'Nama_File_PDF',
      'Ukuran_PDF',
      'Vault_PDF_ID',
      'Project_ID',
      'No_RFQ',
      'Perusahaan',
      'Lokasi',
      'Tanggal_Dokumen',
      'Penanggung_Jawab',
      'Tenaga_Teknik_JSON',
      'TTE_Aktif',
      'Disimpan_Pada',
      'Disimpan_Oleh',
      'Dicetak_Pada',
      'Aksi_Terakhir',
      'Scan_TTD_Manual_JSON',
      'Snapshot_JSON',
    ],
    ...(state.docArchives || []).map((doc) => [
      doc.id,
      doc.docType,
      doc.docNomor,
      doc.fileName,
      String(doc.fileSize || 0),
      doc.vaultPdfId || '',
      doc.projectId || '',
      doc.projectNo || '',
      doc.perusahaan,
      doc.lokasi,
      doc.tanggalDokumen,
      doc.penanggungJawab,
      JSON.stringify(doc.tenagaTeknik || []),
      doc.tteEnabled ? 'TRUE' : 'FALSE',
      doc.savedAt,
      doc.savedBy,
      doc.printedAt || '',
      doc.lastAction,
      JSON.stringify(doc.manualScan || null),
      JSON.stringify(doc.snapshot || null),
    ]),
  ];

  return {
    Proyek: proyekRows,
    Inspektor: inspektorRows,
    AlatUji: alatRows,
    SuratTugas: suratTugasRows,
    SuratJalan: suratJalanRows,
    JSA: jsaRows,
    RekapSOJO: rekapSoJoRows,
    RekapDokumen: rekapDokumenRows,
  };
}

export async function createDatabaseSpreadsheet(
  accessToken: string,
  title: string,
  initialState: AppDatabaseState
): Promise<SpreadsheetMetadata> {
  const created = await apiFetch<SpreadsheetMetadata>(SHEETS_API, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: DATABASE_TABS.map((tabName) => ({
        properties: {
          title: tabName,
          gridProperties: { frozenRowCount: 1 },
        },
      })),
    }),
  });

  // Format header rows cleanly (navy header with white bold text)
  const formatRequests = created.sheets.map((sheet) => ({
    repeatCell: {
      range: {
        sheetId: sheet.properties.sheetId,
        startRowIndex: 0,
        endRowIndex: 1,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.06, green: 0.12, blue: 0.24 },
          textFormat: {
            foregroundColor: { red: 1, green: 1, blue: 1 },
            bold: true,
          },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  }));

  await apiFetch(`${SHEETS_API}/${created.spreadsheetId}:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ requests: formatRequests }),
  });

  await pushDatabaseToSheets(accessToken, created.spreadsheetId, initialState);
  return created;
}

export async function pushDatabaseToSheets(
  accessToken: string,
  spreadsheetId: string,
  state: AppDatabaseState
): Promise<SpreadsheetMetadata> {
  const meta = await ensureDatabaseTabs(accessToken, spreadsheetId);
  const tabRows = serializeStateToTabRows(state);

  // Clear existing ranges first so deleted rows don't linger
  await apiFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: DATABASE_TABS.map((tab) => `${tab}!A:Z`),
      }),
    }
  );

  // Write fresh values
  await apiFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: DATABASE_TABS.map((tab) => ({
          range: `${tab}!A1`,
          values: tabRows[tab],
        })),
      }),
    }
  );

  return meta;
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function pullDatabaseFromSheets(
  accessToken: string,
  spreadsheetId: string,
  fallbackState: AppDatabaseState
): Promise<{ state: AppDatabaseState; meta: SpreadsheetMetadata }> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.properties.title));
  const tabsToRead = DATABASE_TABS.filter((t) => existingTitles.has(t));

  if (tabsToRead.length === 0) {
    throw new Error(
      'Spreadsheet tidak memiliki tab database Portal SLO (Proyek, Inspektor, AlatUji, SuratTugas, SuratJalan, JSA).'
    );
  }

  const rangeParams = tabsToRead.map((t) => `ranges=${encodeURIComponent(`${t}!A:Z`)}`).join('&');
  const batchData = await apiFetch<{
    valueRanges: Array<{ range: string; values?: string[][] }>;
  }>(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${rangeParams}`, accessToken);

  const byTab: Partial<Record<DatabaseTabName, string[][]>> = {};
  batchData.valueRanges.forEach((vr, idx) => {
    const tabName = tabsToRead[idx];
    byTab[tabName] = vr.values || [];
  });

  const next: AppDatabaseState = { ...fallbackState };

  // Parse Proyek
  if (byTab.Proyek && byTab.Proyek.length > 1) {
    const rows = byTab.Proyek.slice(1).filter((r) => r[0]);
    const parsedProjects: Project[] = rows.map((r) => {
      const wfMeta = safeJsonParse<Partial<Project>>(r[21], {});
      return {
        id: r[0],
        no: r[1] || 'RFQ-000',
        perusahaan: r[2] || '',
        kota: r[3] || '',
        jenis: (r[4] as Project['jenis']) || 'Pembangkit',
        sub: r[5] || '',
        kap: r[6] || '',
        status: (r[7] as Project['status']) || 'rfq',
        penawaran: safeJsonParse(r[8], null),
        team: safeJsonParse(r[9], null),
        docs: safeJsonParse(r[10], { issued: false, ack: false }),
        att: safeJsonParse(r[11], []),
        form: safeJsonParse(r[12], { items: {}, photos: [], submitted: false }),
        finds: safeJsonParse(r[13], []),
        bap: safeJsonParse(r[14], null),
        pjt: safeJsonParse(r[15], null),
        slo: safeJsonParse(r[16], null),
        po: safeJsonParse(r[17], null),
        transfer: safeJsonParse(r[18], null),
        log: safeJsonParse(r[19], []),
        files: safeJsonParse(r[20], []),
        pjtName: wfMeta.pjtName,
        salesReadiness: wfMeta.salesReadiness,
        salesMessage: wfMeta.salesMessage,
        adminForwardNote: wfMeta.adminForwardNote,
        workflowStage: wfMeta.workflowStage,
        publishedToWorkMenu: wfMeta.publishedToWorkMenu,
        docTte: wfMeta.docTte,
        signedScans: wfMeta.signedScans,
        leaderMessages: wfMeta.leaderMessages,
      };
    });
    if (parsedProjects.length > 0) {
      next.proj = parsedProjects;
    }
  }

  // Parse Inspektor
  if (byTab.Inspektor && byTab.Inspektor.length > 1) {
    const rows = byTab.Inspektor.slice(1).filter((r) => r[0]);
    const parsedInsp: Inspector[] = rows.map((r) => ({
      id: r[0],
      nama: r[1] || '',
      noReg: r[2] || '-',
      serkom: r[3] || '',
      k3: r[4] || '',
    }));
    if (parsedInsp.length > 0) {
      next.insp = parsedInsp;
    }
  }

  // Parse AlatUji
  if (byTab.AlatUji && byTab.AlatUji.length > 1) {
    const rows = byTab.AlatUji.slice(1).filter((r) => r[0]);
    const parsedTools: Tool[] = rows.map((r) => ({
      id: r[0],
      nama: r[1] || '',
      sn: r[2] || '-',
      cal: r[3] || '',
    }));
    if (parsedTools.length > 0) {
      next.tools = parsedTools;
    }
  }

  // Parse SuratTugas
  if (byTab.SuratTugas && byTab.SuratTugas.length > 1) {
    const r = byTab.SuratTugas[1];
    if (r && r[0]) {
      const parsedSt: SuratTugasData = {
        id: r[0],
        projectId: r[1] || null,
        jenisAktif: (r[2] as SuratTugasData['jenisAktif']) || 'pembangkit',
        nomorUrut: r[3] || '078',
        nomorBulan: r[4] || '10',
        nomorTahun: r[5] || '2026',
        penandatanganIdx: Number(r[6] || 0),
        pjt: r[7] || fallbackState.suratTugas.pjt,
        tenagaTeknik: safeJsonParse(r[8], fallbackState.suratTugas.tenagaTeknik),
        jenisPekerjaan: r[9] || fallbackState.suratTugas.jenisPekerjaan,
        tipe: r[10] || fallbackState.suratTugas.tipe,
        tipeManual: r[11] || '',
        unit: r[12] || '1',
        kap: r[13] || '150',
        satuan: r[14] || 'MW',
        pemilik: r[15] || '',
        lokasi: r[16] || '',
        mulai: r[17] || '',
        selesai: r[18] || '',
        kota: r[19] || 'Surabaya',
        tgl: r[20] || '',
        updatedAt: r[21] || new Date().toISOString(),
      };
      next.suratTugas = parsedSt;
    }
  }

  // Parse SuratJalan
  if (byTab.SuratJalan && byTab.SuratJalan.length > 1) {
    const r = byTab.SuratJalan[1];
    if (r && r[0]) {
      const parsedSj: SuratJalanData = {
        id: r[0],
        suratTugasId: r[1] || next.suratTugas.id,
        items: safeJsonParse(r[2], fallbackState.suratJalan.items),
        kendTampil: r[3] !== 'FALSE',
        kendaraan: r[4] || 'Xpander',
        keeper: r[5] || 'Abdul Rozaq',
        ttdIdx: Number(r[6] || 1),
        updatedAt: r[7] || new Date().toISOString(),
      };
      next.suratJalan = parsedSj;
    }
  }

  // Parse JSA
  if (byTab.JSA && byTab.JSA.length > 1) {
    const r = byTab.JSA[1];
    if (r && r[0]) {
      const parsedJsa: JsaData = {
        id: r[0],
        suratTugasId: r[1] || next.suratTugas.id,
        ketua: r[2] || fallbackState.jsa.ketua,
        pelaksana: safeJsonParse(r[3], fallbackState.jsa.pelaksana),
        jenisChecks: safeJsonParse(r[4], fallbackState.jsa.jenisChecks),
        kegiatan: r[5] || fallbackState.jsa.kegiatan,
        alatChecks: safeJsonParse(r[6], fallbackState.jsa.alatChecks),
        bahayaChecks: safeJsonParse(r[7], fallbackState.jsa.bahayaChecks),
        apdChecks: safeJsonParse(r[8], fallbackState.jsa.apdChecks),
        updatedAt: r[9] || new Date().toISOString(),
      };
      next.jsa = parsedJsa;
    }
  }

  // Parse RekapSOJO
  if (byTab.RekapSOJO && byTab.RekapSOJO.length > 1) {
    const rows = byTab.RekapSOJO.slice(1).filter((r) => r[0]);
    const parsedJoSo: JoSoRecord[] = rows.map((r) => {
      const salesWf = safeJsonParse<Partial<JoSoRecord>>(r[23], {});
      return {
        id: r[0],
        noPenawaran: r[1] || '',
        tanggalPenawaran: r[2] || '',
        perihal: r[3] || 'Penawaran SLO',
        lampiran: r[4] || '1 (Satu) Lembar',
        tanggalPermintaan: r[5] || '',
        kepadaAlamat: r[6] || '',
        jenisInstalasiPenawaran: r[7] || '',
        status: (r[8] as JoSoRecord['status']) || 'submit',
        masaBerlaku: Number(r[9] || 30),
        ppnRate: Number(r[10] ?? 11),
        poNo: r[11] || '',
        title: r[12] || '',
        poDate: r[13] || '',
        poExpiredDate: r[14] || '',
        dp: Number(r[15] || 0),
        pelangganAlamat: r[16] || '',
        jenisInstalasiJo: r[17] || '',
        paymentTerm: r[18] || '',
        items: safeJsonParse(r[19], []),
        documents: safeJsonParse(r[20], []),
        updatedAt: r[21] || new Date().toISOString(),
        projectId: r[22] || undefined,
        salesReadiness: salesWf.salesReadiness,
        salesMessage: salesWf.salesMessage,
        sentToAdminAt: salesWf.sentToAdminAt,
      };
    });
    if (parsedJoSo.length > 0) {
      next.joSoRecords = parsedJoSo;
      next.proj = next.proj.map((p) => {
        const linked = parsedJoSo.find((j) => j.projectId === p.id);
        return linked ? { ...p, joSoId: linked.id } : p;
      });
    }
  }

  // Parse RekapDokumen
  if (byTab.RekapDokumen && byTab.RekapDokumen.length > 1) {
    const rows = byTab.RekapDokumen.slice(1).filter((r) => r[0]);
    const parsedDocs: DocArchiveRecord[] = rows.map((r) => ({
      id: r[0],
      docType: (r[1] as SavedDocType) || 'surat-tugas',
      docNomor: r[2] || '',
      fileName: r[3] || '',
      fileSize: Number(r[4] || 0),
      vaultPdfId: r[5] || undefined,
      projectId: r[6] || null,
      projectNo: r[7] || undefined,
      perusahaan: r[8] || '',
      lokasi: r[9] || '',
      tanggalDokumen: r[10] || '',
      penanggungJawab: r[11] || '',
      tenagaTeknik: safeJsonParse<string[]>(r[12], []),
      tteEnabled: r[13] === 'TRUE',
      savedAt: r[14] || new Date().toISOString(),
      savedBy: r[15] || 'Sistem',
      printedAt: r[16] || undefined,
      lastAction: (r[17] as DocArchiveRecord['lastAction']) || 'saved_pdf',
      manualScan: safeJsonParse(r[18], undefined) || undefined,
      snapshot: safeJsonParse(r[19], undefined) || undefined,
    }));
    next.docArchives = parsedDocs;
  }

  return { state: next, meta };
}
