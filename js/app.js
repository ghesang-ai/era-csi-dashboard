/* =====================================================================
   ERA-CSI Dashboard — app.js
   Erafone Region 5 | Jakarta Pusat & Jakarta Barat
   Column mapping updated to match actual Google Form structure
   ===================================================================== */

'use strict';

// =====================================================================
// COLUMN INDICES — matches actual Google Sheet "Form Responses 1"
// Huruf kolom Sheet: A=0, B=1, C=2 ... R=17
// =====================================================================
const COL = {
  TIMESTAMP:   0,  // A: Timestamp (auto)
  EMAIL:       1,  // B: Email Address (auto)
  TANGGAL:     2,  // C: TANGGAL
  TSH:         3,  // D: Area TSH (nama supervisor / Territory Sales Head)
  TOKO:        4,  // E: NAMA STORE
  WALKIN:      5,  // F: JUMLAH SEMUA WIC TOKO HARI INI  → walk-in
  DEAL:        6,  // G: JUMLAH TRANSAKSI (QTY)           → transaksi berhasil
  USER_WIC:    7,  // H: USER WIC                         → (tidak dipakai di source)
  // --- Customer Source: kolom I-L (sesuai instruksi) ---
  SRC_DB:      8,  // I: USER DATABASE
  SRC_GOOGLE:  9,  // J: USER GOOGLE BISNIS
  SRC_SOSMED:  10, // K: USER SOSIAL MEDIA
  SRC_O2O:     11, // L: USER OMNICHANNEL (online-to-offline)
  // ---
  DEVICE:      12, // M: JUMLAH TRANSAKSI DEVICE (QTY)
  ERASPACE:    13, // N: JUMLAH TRANSAKSI MENGGUNAKAN MEMBER  → vs G
  BUNDLING:    14, // O: VIDEO LITE                           → vs G
  CSI:         15, // P: CSI                                  → vs G
  GREVIEW:     16, // Q: REVIEW GOOGLE BISNIS                 → vs G
  IG:          17, // R: FOLLOW INSTAGRAM ERAFONE             → vs G
};

// LOSS tidak ada di form — dihitung: WALKIN - DEAL
// AREA tidak ada di form — filter menggunakan nama TSH (supervisor)

// =====================================================================
// TARGETS
// =====================================================================
const TARGETS = {
  conversion: 40,   // Conversion Rate = DEAL / WALKIN
  eraspace:   80,   // Eraspace Rate = ERASPACE / DEAL
  bundle:     30,   // Bundle Attach Rate = BUNDLING / DEAL
  csi:        90,   // CSI Rate = CSI / DEAL
  greview:    50,   // Google Review Rate = GREVIEW / DEAL
  ig:         30,   // IG Follow Rate = IG / DEAL
};

// =====================================================================
// STATE
// =====================================================================
let CONFIG          = {};
let rawData         = [];
let filteredRecords = [];
let charts          = {};
let sortState       = { col: null, dir: 'asc' };
let autoRefreshTimer = null;

// Chart style defaults
const CD = {
  color:     '#94A3B8',
  gridColor: 'rgba(0,0,0,0.06)',
  font:      'Plus Jakarta Sans',
};

// =====================================================================
// INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  CONFIG = window.ERA_CSI_CONFIG || {};
  setupFilters();
  setupEventListeners();
  await fetchData();
  startAutoRefresh();
}

// =====================================================================
// DEMO DATA — ditampilkan saat API key belum dikonfigurasi
// =====================================================================
function getDemoRows() {
  // Format: [Timestamp, Email, Tanggal, TSH, Toko, F, G, H, I, J, K, L, M, N, O, P, Q, R]
  // F=WIC, G=Deal, H=UserWIC, I=DB, J=Google, K=Sosmed, L=O2O, M=Device, N=Eraspace, O=Bundle, P=CSI, Q=GReview, R=IG
  const today  = new Date();
  const mkDate = d => {
    const x  = new Date(today);
    x.setDate(x.getDate() - d);
    const dd = String(x.getDate()).padStart(2, '0');
    const mm = String(x.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${x.getFullYear()}`;
  };
  const stores = [
    ['Febrian Tri Wibowo', 'E028 ERAFONE MAL PURI INDAH'],
    ['Febrian Tri Wibowo', 'E679 ERAFONE MULTIBRAND JEMBATAN'],
    ['Mensi Alexander',    'E047 ERAFONE ITC CEMPAKA MAS'],
    ['Mensi Alexander',    'E216 ERAFONE SENAYAN CITY'],
    ['Mensi Alexander',    'E096 ERAFONE ITC ROXY MAS'],
    ['Lukman Wibowo',      'E414 ERAFONE RUKO PURI KEMBANGAN'],
    ['Lukman Wibowo',      'E663 ERAFONE RUKO GREEN SEDAYU'],
    ['Rendy Nur Setiawan', 'E158 ERAFONE MAL CIPUTRA'],
    ['Rendy Nur Setiawan', 'E508 ERAFONE JEMBATAN MERAH'],
    ['Irman Permana',      'E027 ERAFONE DAAN MOGOT'],
    ['Irman Permana',      'E215 ERAFONE GREEN SEDAYU'],
  ];
  const rows = [];
  for (let day = 6; day >= 0; day--) {
    const tanggal = mkDate(day);
    stores.forEach(([tsh, toko]) => {
      const wic   = 8 + Math.floor(Math.random() * 30);
      const deal  = Math.floor(wic * (0.35 + Math.random() * 0.35));
      const db     = Math.floor(deal * (0.15 + Math.random() * 0.20));
      const google = Math.floor(deal * (0.05 + Math.random() * 0.10));
      const sosmed = Math.floor(deal * (0.05 + Math.random() * 0.10));
      const o2o    = Math.floor(deal * (0.05 + Math.random() * 0.10));
      const era    = Math.floor(deal * (0.55 + Math.random() * 0.30));
      const bundle = Math.floor(deal * (0.18 + Math.random() * 0.20));
      const csi    = Math.floor(deal * (0.70 + Math.random() * 0.25));
      const grev   = Math.floor(deal * (0.30 + Math.random() * 0.25));
      const ig     = Math.floor(deal * (0.18 + Math.random() * 0.18));
      rows.push([
        new Date().toISOString(), 'demo@erafone.com', tanggal,
        tsh, toko,
        String(wic), String(deal), String(0),           // F,G,H
        String(db), String(google), String(sosmed), String(o2o), // I,J,K,L
        String(deal), String(era),                      // M,N
        String(bundle), String(csi), String(grev), String(ig),   // O,P,Q,R
      ]);
    });
  }
  return rows;
}

// =====================================================================
// DATA FETCHING
// =====================================================================
async function fetchData() {
  showLoading(true);
  clearError();
  updateLastRefresh();

  try {
    const {
      SPREADSHEET_ID,
      GOOGLE_SHEETS_API_KEY,
      SHEET_NAME = 'Form Responses 1',
      RANGE = 'A2:R1000',
    } = CONFIG;

    const isDemo = !GOOGLE_SHEETS_API_KEY ||
      GOOGLE_SHEETS_API_KEY === 'YOUR_GOOGLE_SHEETS_API_KEY_HERE';

    if (isDemo) {
      // Tampilkan demo data — dashboard bisa dilihat tanpa API key
      showDemoBanner(true);
      rawData = getDemoRows();
      populateDropdowns();
      applyFilters();
      showLoading(false);
      return;
    }
    showDemoBanner(false);

    const sheet = encodeURIComponent(SHEET_NAME);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheet}!${RANGE}?key=${GOOGLE_SHEETS_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Google Sheets API Error ${res.status}: ${err?.error?.message || res.statusText}`);
    }

    const data = await res.json();
    rawData = (data.values || []).filter(row => row.length > 6 && row[COL.WALKIN]);

    if (rawData.length === 0) {
      showEmpty('Data belum ada. Pastikan Google Form sudah diisi dan Sheet ID/API Key benar.');
      showLoading(false);
      return;
    }

    populateDropdowns();
    applyFilters();
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
}

// =====================================================================
// DATA PARSING
// =====================================================================
function parseNum(val) {
  if (val === undefined || val === null || val === '') return 0;
  const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function parseDate(row) {
  // Try column C (TANGGAL) first, then A (Timestamp)
  const raw = row[COL.TANGGAL] || row[COL.TIMESTAMP] || '';
  if (!raw) return null;

  // DD/MM/YYYY or DD-MM-YYYY (Indonesian format — check this FIRST)
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const d = +dmy[1], m = +dmy[2], y = +dmy[3];
    // If day > 12, it must be DD/MM; otherwise assume DD/MM (Indonesian default)
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return new Date(y, m - 1, d);
  }

  // YYYY-MM-DD (ISO date)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  // Full ISO timestamp
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function rowToRecord(row) {
  const walkin   = parseNum(row[COL.WALKIN]);
  const deal     = parseNum(row[COL.DEAL]);
  const loss     = Math.max(0, walkin - deal); // LOSS = F - G (tidak ada kolom loss)
  // Sumber customer: kolom I–L
  const srcDb     = parseNum(row[COL.SRC_DB]);
  const srcGoogle = parseNum(row[COL.SRC_GOOGLE]);
  const srcSosmed = parseNum(row[COL.SRC_SOSMED]);
  const srcO2O    = parseNum(row[COL.SRC_O2O]);
  // KPI lainnya vs Kolom G
  const eraspace = parseNum(row[COL.ERASPACE]);
  const bundling = parseNum(row[COL.BUNDLING]);
  const csi      = parseNum(row[COL.CSI]);
  const greview  = parseNum(row[COL.GREVIEW]);
  const ig       = parseNum(row[COL.IG]);

  return {
    date:      parseDate(row),
    dateStr:   row[COL.TANGGAL] || row[COL.TIMESTAMP] || '',
    tsh:       (row[COL.TSH]  || '').trim(),
    toko:      (row[COL.TOKO] || '').trim(),
    walkin, deal, loss,
    srcDb, srcGoogle, srcSosmed, srcO2O,
    eraspace, bundling, csi, greview, ig,
  };
}

// =====================================================================
// FILTERS & DROPDOWNS
// =====================================================================
function populateDropdowns() {
  // Toko dropdown
  const tokoSel = document.getElementById('filter-toko');
  if (tokoSel) {
    const tokos = [...new Set(rawData.map(r => (r[COL.TOKO] || '').trim()).filter(Boolean))].sort();
    while (tokoSel.options.length > 1) tokoSel.remove(1);
    tokos.forEach(t => tokoSel.appendChild(new Option(t, t)));
  }

  // TSH (supervisor) dropdown
  const tshSel = document.getElementById('filter-tsh');
  if (tshSel) {
    const tshs = [...new Set(rawData.map(r => (r[COL.TSH] || '').trim()).filter(Boolean))].sort();
    while (tshSel.options.length > 1) tshSel.remove(1);
    tshs.forEach(t => tshSel.appendChild(new Option(t, t)));
  }
}

function getFilters() {
  return {
    tsh:      document.getElementById('filter-tsh')?.value      || 'all',
    toko:     document.getElementById('filter-toko')?.value      || 'all',
    periode:  document.getElementById('filter-periode')?.value   || 'month',
    dateFrom: document.getElementById('filter-date-from')?.value || '',
    dateTo:   document.getElementById('filter-date-to')?.value   || '',
  };
}

function applyFilters() {
  const f = getFilters();
  const now = new Date();

  let records = rawData.map(rowToRecord);

  // TSH (supervisor) filter
  if (f.tsh !== 'all') {
    records = records.filter(r => r.tsh === f.tsh);
  }

  // Toko filter
  if (f.toko !== 'all') {
    records = records.filter(r => r.toko === f.toko);
  }

  // Periode filter
  if (f.periode !== 'custom') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    records = records.filter(r => {
      if (!r.date) return false;
      const d = new Date(r.date.getFullYear(), r.date.getMonth(), r.date.getDate());
      const diff = today - d;
      if (f.periode === 'today')     return d.getTime() === today.getTime();
      if (f.periode === 'mtd')       return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && d <= today;
      if (f.periode === 'lastmonth') {
        const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
      }
      return true; // 'all'
    });
  } else {
    // Parse YYYY-MM-DD sebagai lokal midnight (bukan UTC) agar sama-hari cocok
    const localDate = str => { const [y, m, d] = str.split('-'); return new Date(+y, +m - 1, +d); };
    if (f.dateFrom) {
      const from = localDate(f.dateFrom);
      records = records.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date.getFullYear(), r.date.getMonth(), r.date.getDate());
        return d >= from;
      });
    }
    if (f.dateTo) {
      const to = localDate(f.dateTo);
      records = records.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date.getFullYear(), r.date.getMonth(), r.date.getDate());
        return d <= to;
      });
    }
  }

  filteredRecords = records;

  if (records.length === 0) {
    showEmpty('Tidak ada data untuk filter yang dipilih. Coba ubah periode atau supervisor.');
    return;
  }

  hideEmpty();
  renderDashboard(records);
}

// =====================================================================
// AGGREGATION HELPERS
// =====================================================================
function aggregate(records) {
  return records.reduce((acc, r) => {
    acc.walkin     += r.walkin;
    acc.deal       += r.deal;
    acc.loss       += r.loss;
    acc.srcDb      += r.srcDb;
    acc.srcGoogle  += r.srcGoogle;
    acc.srcSosmed  += r.srcSosmed;
    acc.srcO2O     += r.srcO2O;
    acc.eraspace   += r.eraspace;
    acc.bundling   += r.bundling;
    acc.csi        += r.csi;
    acc.greview    += r.greview;
    acc.ig         += r.ig;
    return acc;
  }, {
    walkin:0, deal:0, loss:0,
    srcDb:0, srcGoogle:0, srcSosmed:0, srcO2O:0,
    eraspace:0, bundling:0, csi:0, greview:0, ig:0,
  });
}

function rate(a, b) { return b > 0 ? (a / b * 100) : 0; }

function groupByDate(records) {
  return records.reduce((acc, r) => {
    const key = r.date
      ? r.date.toISOString().slice(0, 10)
      : (r.dateStr || '').slice(0, 10);
    if (!key) return acc;
    if (!acc[key]) acc[key] = {
      walkin:0, deal:0, loss:0, bundling:0, csi:0,
      greview:0, ig:0, eraspace:0, device:0,
    };
    acc[key].walkin   += r.walkin;
    acc[key].deal     += r.deal;
    acc[key].loss     += r.loss;
    acc[key].bundling += r.bundling;
    acc[key].csi      += r.csi;
    acc[key].greview  += r.greview;
    acc[key].ig       += r.ig;
    acc[key].eraspace += r.eraspace;
    acc[key].device   += r.device;
    return acc;
  }, {});
}

function groupByToko(records) {
  return records.reduce((acc, r) => {
    const key = r.toko || 'Unknown';
    if (!acc[key]) acc[key] = {
      walkin:0, deal:0, loss:0, bundling:0, csi:0, greview:0, ig:0,
      eraspace:0, srcDb:0, srcGoogle:0, srcSosmed:0, srcO2O:0,
    };
    acc[key].walkin    += r.walkin;
    acc[key].deal      += r.deal;
    acc[key].loss      += r.loss;
    acc[key].bundling  += r.bundling;
    acc[key].csi       += r.csi;
    acc[key].greview   += r.greview;
    acc[key].ig        += r.ig;
    acc[key].eraspace  += r.eraspace;
    acc[key].srcDb     += r.srcDb;
    acc[key].srcGoogle += r.srcGoogle;
    acc[key].srcSosmed += r.srcSosmed;
    acc[key].srcO2O    += r.srcO2O;
    return acc;
  }, {});
}

// Short label for store name (remove code prefix like "E028 ")
function shortToko(name) {
  return name.replace(/^[A-Z]\d+\s+/i, '').replace(/\bERAFONE\b\s*/i, '').trim() || name;
}

// =====================================================================
// MAIN RENDER
// =====================================================================
function renderDashboard(records) {
  const tot = aggregate(records);
  renderSummaryBar(tot);
  renderModule1Traffic(records, tot);
  renderModule2Source(tot);
  renderModule3Eraspace(tot);
  renderModule4Bundling(records, tot);
  renderModule5CSI(records, tot);
  renderModule6GReview(records, tot);
  renderModule7IG(records, tot);
  renderStoreTable(records);
}

// --- SUMMARY KPI BAR ---
function renderSummaryBar(tot) {
  const conv = rate(tot.deal, tot.walkin);
  const csi  = rate(tot.csi, tot.deal);

  setText('kpi-walkin',   fmt(tot.walkin));
  setText('kpi-deal',     fmt(tot.deal));
  setText('kpi-loss',     fmt(tot.loss));
  setTextColored('kpi-conv-rate', fmtPct(conv), conv, TARGETS.conversion);
  setTextColored('kpi-csi-rate',  fmtPct(csi),  csi,  TARGETS.csi);
}

// --- MODULE 1: TRAFFIC & CONVERSION ---
function renderModule1Traffic(records, tot) {
  const conv   = rate(tot.deal, tot.walkin);
  const lossRt = rate(tot.loss, tot.walkin);

  setText('m1-walkin',    fmt(tot.walkin));
  setText('m1-deal',      fmt(tot.deal));
  setText('m1-loss',      fmt(tot.loss));
  setTextColored('m1-conv', fmtPct(conv), conv, TARGETS.conversion);
  setText('m1-loss-rate', fmtPct(lossRt));

  const byDate = groupByDate(records);
  const labels = Object.keys(byDate).sort();

  makeBarChart('chart-traffic', labels, [
    { label: 'WIC (Walk-in)', data: labels.map(d => byDate[d].walkin), backgroundColor: '#3B82F6' },
    { label: 'Transaksi',     data: labels.map(d => byDate[d].deal),   backgroundColor: '#00D4AA' },
    { label: 'Loss',          data: labels.map(d => byDate[d].loss),   backgroundColor: '#EF4444' },
  ]);
}

// --- MODULE 2: CUSTOMER SOURCE — Kolom I-L (4 sumber) ---
function renderModule2Source(tot) {
  // Denominator = total transaksi (deal)
  const d = tot.deal || 1;

  const dbPct     = rate(tot.srcDb,     d);
  const googlePct = rate(tot.srcGoogle, d);
  const socPct    = rate(tot.srcSosmed, d);
  const o2oPct    = rate(tot.srcO2O,    d);

  setText('m2-db',     `${fmt(tot.srcDb)}     (${fmtPct(dbPct)})`);
  setText('m2-google', `${fmt(tot.srcGoogle)} (${fmtPct(googlePct)})`);
  setText('m2-sosmed', `${fmt(tot.srcSosmed)} (${fmtPct(socPct)})`);
  setText('m2-o2o',    `${fmt(tot.srcO2O)}    (${fmtPct(o2oPct)})`);

  makeDoughnut('chart-source',
    ['User Database', 'Google Bisnis', 'Sosial Media', 'Omnichannel'],
    [tot.srcDb, tot.srcGoogle, tot.srcSosmed, tot.srcO2O],
    ['#3B82F6', '#F59E0B', '#8B5CF6', '#00D4AA']
  );
}

// --- MODULE 3: ERASPACE MEMBERSHIP ---
function renderModule3Eraspace(tot) {
  const r3        = rate(tot.eraspace, tot.deal);
  const nonMember = Math.max(0, tot.deal - tot.eraspace);

  setText('m3-member',     fmt(tot.eraspace));
  setText('m3-non-member', fmt(nonMember));
  setTextColored('m3-rate', fmtPct(r3), r3, TARGETS.eraspace);

  const bar = document.getElementById('m3-progress-bar');
  if (bar) {
    bar.style.width = Math.min(r3, 100) + '%';
    bar.className = 'progress-fill ' + statusClass(r3, TARGETS.eraspace);
  }
  setText('m3-progress-label', fmtPct(r3));
  setText('m3-target-label',   `Target: ${TARGETS.eraspace}%`);
}

// --- MODULE 4: BUNDLING VIDEO LITE ---
function renderModule4Bundling(records, tot) {
  const r4 = rate(tot.bundling, tot.deal);
  setText('m4-bundling', fmt(tot.bundling));
  setTextColored('m4-rate', fmtPct(r4), r4, TARGETS.bundle);

  const byDate = groupByDate(records);
  const labels = Object.keys(byDate).sort();

  makeBarChart('chart-bundling', labels, [
    { label: 'Total Transaksi', data: labels.map(d => byDate[d].deal),     backgroundColor: 'rgba(59,130,246,0.25)' },
    { label: 'Video Lite',      data: labels.map(d => byDate[d].bundling), backgroundColor: '#8B5CF6' },
  ]);
}

// --- MODULE 5: CSI REVIEW ---
function renderModule5CSI(records, tot) {
  const r5 = rate(tot.csi, tot.deal);
  setText('m5-csi', fmt(tot.csi));
  setTextColored('m5-rate', fmtPct(r5), r5, TARGETS.csi);

  const byDate = groupByDate(records);
  const labels = Object.keys(byDate).sort();
  const rates  = labels.map(d => rate(byDate[d].csi, byDate[d].deal));

  makeLineChart('chart-csi', labels, [
    {
      label: 'CSI Rate %',
      data: rates,
      borderColor: '#00D4AA',
      backgroundColor: 'rgba(0,212,170,0.08)',
      tension: 0.4,
      fill: true,
    },
  ]);
}

// --- MODULE 6: GOOGLE BISNIS REVIEW ---
function renderModule6GReview(records, tot) {
  const r6 = rate(tot.greview, tot.deal);
  setText('m6-greview', fmt(tot.greview));
  setTextColored('m6-rate', fmtPct(r6), r6, TARGETS.greview);

  const byToko = groupByToko(records);
  const labels = Object.keys(byToko).map(shortToko);
  const rawLabels = Object.keys(byToko);
  const rates  = rawLabels.map(t => rate(byToko[t].greview, byToko[t].deal));

  makeBarChart('chart-greview', labels, [
    { label: 'Google Review Rate %', data: rates, backgroundColor: rates.map(r => barColor(r, TARGETS.greview)) },
  ], { maxY: 100, suffix: '%' });
}

// --- MODULE 7: INSTAGRAM FOLLOW ---
function renderModule7IG(records, tot) {
  const r7 = rate(tot.ig, tot.deal);
  setText('m7-ig', fmt(tot.ig));
  setTextColored('m7-rate', fmtPct(r7), r7, TARGETS.ig);

  const byToko = groupByToko(records);
  const labels = Object.keys(byToko).map(shortToko);
  const rawLabels = Object.keys(byToko);
  const rates  = rawLabels.map(t => rate(byToko[t].ig, byToko[t].deal));

  makeBarChart('chart-ig', labels, [
    { label: 'IG Follow Rate %', data: rates, backgroundColor: rates.map(r => barColor(r, TARGETS.ig)) },
  ], { maxY: 100, suffix: '%' });
}

// =====================================================================
// STORE TABLE
// =====================================================================
function renderStoreTable(records) {
  const byToko = groupByToko(records);

  let rows = Object.keys(byToko).map(toko => {
    const g = byToko[toko];
    return {
      toko,
      walkin:   g.walkin,
      deal:     g.deal,
      conv:     rate(g.deal, g.walkin),
      eraspace: rate(g.eraspace, g.deal),
      bundle:   rate(g.bundling, g.deal),
      csi:      rate(g.csi, g.deal),
      greview:  rate(g.greview, g.deal),
      ig:       rate(g.ig, g.deal),
    };
  });

  if (sortState.col) {
    rows.sort((a, b) => {
      const va = a[sortState.col], vb = b[sortState.col];
      const diff = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sortState.dir === 'asc' ? diff : -diff;
    });
  }

  const tbody = document.querySelector('#store-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td title="${esc(r.toko)}">${esc(shortToko(r.toko))}</td>
      <td>${fmt(r.walkin)}</td>
      <td>${fmt(r.deal)}</td>
      <td class="${statusCellClass(r.conv,     TARGETS.conversion)}">${fmtPct(r.conv)}</td>
      <td class="${statusCellClass(r.eraspace, TARGETS.eraspace)}">${fmtPct(r.eraspace)}</td>
      <td class="${statusCellClass(r.bundle,   TARGETS.bundle)}">${fmtPct(r.bundle)}</td>
      <td class="${statusCellClass(r.csi,      TARGETS.csi)}">${fmtPct(r.csi)}</td>
      <td class="${statusCellClass(r.greview,  TARGETS.greview)}">${fmtPct(r.greview)}</td>
      <td class="${statusCellClass(r.ig,       TARGETS.ig)}">${fmtPct(r.ig)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// =====================================================================
// AI INSIGHT (Claude API)
// =====================================================================
async function generateInsight() {
  const btn    = document.getElementById('btn-insight');
  const output = document.getElementById('insight-output');
  if (!btn || !output) return;

  if (!CONFIG.ANTHROPIC_API_KEY || CONFIG.ANTHROPIC_API_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE') {
    output.innerHTML = '<div class="error-banner" style="display:block">ANTHROPIC_API_KEY belum dikonfigurasi di config/config.js</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Menganalisis...';
  output.innerHTML = '<span class="loading-dots">Menganalisis data</span>';
  output.classList.remove('empty');

  try {
    const tot    = aggregate(filteredRecords);
    const byToko = groupByToko(filteredRecords);

    const storeRanks = Object.keys(byToko)
      .map(t => ({ toko: t, conv: rate(byToko[t].deal, byToko[t].walkin) }))
      .sort((a, b) => b.conv - a.conv);

    const topStore    = storeRanks[0]?.toko || '-';
    const bottomStore = storeRanks.at(-1)?.toko || '-';

    const prompt = [
      'Kamu adalah analis retail untuk Erafone (Erajaya Digital) Region 5 Jakarta.',
      'Analisis data monitoring berikut dan berikan insight dalam Bahasa Indonesia:',
      '',
      'DATA PERIODE INI:',
      `- Total WIC (Walk-in): ${tot.walkin}`,
      `- Total Transaksi: ${tot.deal} (Conversion: ${rate(tot.deal, tot.walkin).toFixed(1)}%, Target: ${TARGETS.conversion}%)`,
      `- Loss (tidak transaksi): ${tot.loss}`,
      `- Source Customer: WIC Organik ${rate(tot.userWic, tot.deal).toFixed(1)}%, Database ${rate(tot.userDb, tot.deal).toFixed(1)}%, Google Bisnis ${rate(tot.userGoogle, tot.deal).toFixed(1)}%, Sosmed ${rate(tot.sosmed, tot.deal).toFixed(1)}%, Omnichannel ${rate(tot.o2o, tot.deal).toFixed(1)}%`,
      `- Eraspace Member Rate: ${rate(tot.eraspace, tot.deal).toFixed(1)}% (Target: ${TARGETS.eraspace}%)`,
      `- Video Lite Attach Rate: ${rate(tot.bundling, tot.deal).toFixed(1)}% (Target: ${TARGETS.bundle}%)`,
      `- CSI Review Rate: ${rate(tot.csi, tot.deal).toFixed(1)}% (Target: ${TARGETS.csi}%)`,
      `- Google Bisnis Review Rate: ${rate(tot.greview, tot.deal).toFixed(1)}% (Target: ${TARGETS.greview}%)`,
      `- IG Follow Rate: ${rate(tot.ig, tot.deal).toFixed(1)}% (Target: ${TARGETS.ig}%)`,
      '',
      `STORE TERBAIK: ${topStore} (Conv: ${storeRanks[0] ? storeRanks[0].conv.toFixed(1) : 0}%)`,
      `STORE PERLU PERHATIAN: ${bottomStore} (Conv: ${storeRanks.at(-1) ? storeRanks.at(-1).conv.toFixed(1) : 0}%)`,
      '',
      'Berikan (4 poin):',
      '1. Ringkasan performa periode ini (2-3 kalimat)',
      '2. Highlight positif — metrik dan store terbaik',
      '3. Yang perlu diperbaiki — metrik di bawah target',
      '4. Rekomendasi aksi konkret untuk Store Leader besok',
      'Format: narasi paragraf, bahasa kasual tapi profesional, tidak menggunakan bullet.',
    ].join('\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     CONFIG.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`Claude API ${res.status}: ${e?.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    output.innerHTML = `<div class="insight-text">${esc(text).replace(/\n/g, '<br>')}</div>`;
  } catch (err) {
    output.innerHTML = `<div class="error-banner" style="display:block">Gagal generate insight: ${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Generate Insight`;
  }
}

// =====================================================================
// WHATSAPP REPORT (Fonnte API)
// =====================================================================
async function sendWAReport() {
  const btn = document.getElementById('btn-wa');
  if (!btn) return;

  if (!CONFIG.FONNTE_TOKEN || CONFIG.FONNTE_TOKEN === 'YOUR_FONNTE_TOKEN_HERE') {
    showToast('FONNTE_TOKEN belum dikonfigurasi di config/config.js', 'error');
    return;
  }

  const targets = CONFIG.WA_TARGETS || [];
  if (!targets.length) {
    showToast('WA_TARGETS belum dikonfigurasi di config/config.js', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Mengirim...';

  try {
    const tot    = aggregate(filteredRecords);
    const byToko = groupByToko(filteredRecords);

    const storeRanks = Object.keys(byToko)
      .map(t => ({ toko: t, conv: rate(byToko[t].deal, byToko[t].walkin) }))
      .sort((a, b) => b.conv - a.conv);

    const convRt     = rate(tot.deal, tot.walkin);
    const lossRt     = rate(tot.loss, tot.walkin);
    const eraspaceRt = rate(tot.eraspace, tot.deal);
    const bundleRt   = rate(tot.bundling, tot.deal);
    const csiRt      = rate(tot.csi, tot.deal);
    const greviewRt  = rate(tot.greview, tot.deal);
    const igRt       = rate(tot.ig, tot.deal);

    const today = new Date().toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const tshSel = document.getElementById('filter-tsh');
    const tshLabel = tshSel?.value === 'all' ? 'Semua TSH' : tshSel?.value;

    const msg = [
      `📊 *ERA-CSI Daily Report*`,
      `📅 ${today}`,
      `👤 TSH: ${tshLabel}`,
      ``,
      `*TRAFFIC OVERVIEW*`,
      `👥 WIC (Walk-in) : ${fmt(tot.walkin)} customer`,
      `✅ Transaksi      : ${fmt(tot.deal)} (${fmtPct(convRt)})`,
      `❌ Loss           : ${fmt(tot.loss)} (${fmtPct(lossRt)})`,
      ``,
      `*CSI METRICS*`,
      `🏆 Eraspace   : ${fmtPct(eraspaceRt)} ${statusEmoji(eraspaceRt, TARGETS.eraspace)}`,
      `📦 Video Lite  : ${fmtPct(bundleRt)} ${statusEmoji(bundleRt, TARGETS.bundle)}`,
      `⭐ CSI Review  : ${fmtPct(csiRt)} ${statusEmoji(csiRt, TARGETS.csi)}`,
      `🌐 G-Review   : ${fmtPct(greviewRt)} ${statusEmoji(greviewRt, TARGETS.greview)}`,
      `📸 IG Follow   : ${fmtPct(igRt)} ${statusEmoji(igRt, TARGETS.ig)}`,
      ``,
      `*TOP STORE*`,
      `🥇 ${shortToko(storeRanks[0]?.toko || '-')} — Conv ${fmtPct(storeRanks[0]?.conv || 0)}`,
    ];

    if (storeRanks.length > 1 && storeRanks.at(-1).conv < TARGETS.conversion) {
      msg.push(``, `*NEEDS ATTENTION*`, `⚠️ ${shortToko(storeRanks.at(-1).toko)} — Conv ${fmtPct(storeRanks.at(-1).conv)}`);
    }

    msg.push(``, `_Generated by ERA-CSI Dashboard_`);

    const message = msg.join('\n');

    for (const target of targets) {
      const body = new URLSearchParams({ target, message, countryCode: '62' });
      const res  = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: CONFIG.FONNTE_TOKEN },
        body,
      });
      if (!res.ok) throw new Error(`Fonnte error: ${res.status}`);
    }

    showToast('Laporan WA berhasil dikirim!', 'success');
  } catch (err) {
    showToast(`Gagal kirim WA: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.11 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.1 7.78a16 16 0 006.12 6.12l1.14-1.14a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg> Kirim Laporan WA`;
  }
}

// =====================================================================
// CHART HELPERS
// =====================================================================
function makeBarChart(id, labels, datasets, opts = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }

  charts[id] = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { labels: { color: CD.color, font: { family: CD.font, size: 11 }, padding: 12 } },
        tooltip: {
          backgroundColor: '#111827',
          borderColor: '#1E2D40',
          borderWidth: 1,
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          callbacks: {
            label: ctx => opts.suffix
              ? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}${opts.suffix}`
              : `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('id-ID')}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: CD.color, font: { family: CD.font, size: 10 }, maxRotation: 45 },
          grid: { color: CD.gridColor },
        },
        y: {
          ticks: {
            color: CD.color,
            font: { family: CD.font, size: 10 },
            callback: v => opts.suffix ? v + opts.suffix : v.toLocaleString('id-ID'),
          },
          grid: { color: CD.gridColor },
          max: opts.maxY,
          beginAtZero: true,
        },
      },
    },
  });
}

function makeLineChart(id, labels, datasets) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }

  charts[id] = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { labels: { color: CD.color, font: { family: CD.font, size: 11 }, padding: 12 } },
        tooltip: {
          backgroundColor: '#111827',
          borderColor: '#1E2D40',
          borderWidth: 1,
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` },
        },
      },
      scales: {
        x: {
          ticks: { color: CD.color, font: { family: CD.font, size: 10 }, maxRotation: 45 },
          grid: { color: CD.gridColor },
        },
        y: {
          ticks: { color: CD.color, font: { family: CD.font, size: 10 }, callback: v => v + '%' },
          grid: { color: CD.gridColor },
          beginAtZero: true,
          max: 100,
        },
      },
    },
  });
}

function makeDoughnut(id, labels, data, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }

  charts[id] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#111827' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      animation: { duration: 400 },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: CD.color,
            font: { family: CD.font, size: 11 },
            padding: 10,
            boxWidth: 12,
            boxHeight: 12,
          },
        },
        tooltip: {
          backgroundColor: '#111827',
          borderColor: '#1E2D40',
          borderWidth: 1,
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toLocaleString('id-ID')}` },
        },
      },
    },
  });
}

// =====================================================================
// SETUP & EVENT LISTENERS
// =====================================================================
function setupFilters() {
  const periodeEl   = document.getElementById('filter-periode');
  const customRange = document.getElementById('custom-date-range');

  periodeEl?.addEventListener('change', () => {
    customRange?.classList.toggle('visible', periodeEl.value === 'custom');
  });
}

function setupEventListeners() {
  document.getElementById('filter-tsh')?.addEventListener('change', applyFilters);
  document.getElementById('filter-toko')?.addEventListener('change', applyFilters);
  document.getElementById('filter-periode')?.addEventListener('change', applyFilters);
  document.getElementById('filter-date-from')?.addEventListener('change', applyFilters);
  document.getElementById('filter-date-to')?.addEventListener('change', applyFilters);

  document.getElementById('btn-refresh')?.addEventListener('click', fetchData);
  document.getElementById('btn-insight')?.addEventListener('click', generateInsight);
  document.getElementById('btn-wa')?.addEventListener('click', sendWAReport);

  // Table column sort
  document.querySelectorAll('#store-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      sortState.dir = sortState.col === col
        ? (sortState.dir === 'asc' ? 'desc' : 'asc')
        : 'desc';
      sortState.col = col;
      document.querySelectorAll('#store-table th').forEach(t =>
        t.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add('sorted-' + sortState.dir);
      renderStoreTable(filteredRecords);
    });
  });
}

function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(fetchData, 5 * 60 * 1000);
}

// =====================================================================
// UI UTILITIES
// =====================================================================
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setTextColored(id, text, val, target) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = el.className.replace(/\bkpi-(success|warning|danger)\b/g, '');
  el.classList.add('kpi-' + statusClass(val, target));
}

function fmt(n)    { return (n || 0).toLocaleString('id-ID'); }
function fmtPct(n) { return (n || 0).toFixed(1) + '%'; }

function statusClass(val, target) {
  if (val >= target)          return 'success';
  if (val >= target * 0.8)    return 'warning';
  return 'danger';
}

function statusCellClass(val, target) {
  if (val >= target)          return 'status-green';
  if (val >= target * 0.8)    return 'status-yellow';
  return 'status-red';
}

function barColor(val, target) {
  if (val >= target)       return '#10B981';
  if (val >= target * 0.8) return '#F59E0B';
  return '#EF4444';
}

function statusEmoji(val, target) {
  if (val >= target)       return '✅';
  if (val >= target * 0.8) return '⚠️';
  return '❌';
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateLastRefresh() {
  const el = document.getElementById('last-refresh');
  if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString('id-ID');
}

function showDemoBanner(visible) {
  const el = document.getElementById('demo-banner');
  if (el) el.style.display = visible ? 'flex' : 'none';
}

function showLoading(visible) {
  const el = document.getElementById('loading-state');
  if (el) el.style.display = visible ? 'flex' : 'none';
}

function showError(msg) {
  const el = document.getElementById('error-banner');
  if (el) { el.textContent = '⚠ ' + msg; el.style.display = 'block'; }
  console.error('[ERA-CSI]', msg);
}

function clearError() {
  const el = document.getElementById('error-banner');
  if (el) el.style.display = 'none';
}

function showEmpty(msg) {
  const msgEl = document.getElementById('empty-state-msg');
  if (msgEl) msgEl.textContent = msg;
  const el = document.getElementById('empty-state');
  if (el) el.style.display = 'flex';
  const content = document.getElementById('dashboard-content');
  if (content) content.style.display = 'none';
}

function hideEmpty() {
  const el = document.getElementById('empty-state');
  if (el) el.style.display = 'none';
  const content = document.getElementById('dashboard-content');
  if (content) content.style.display = 'block';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => toast.classList.add('toast-show'))
  );

  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
