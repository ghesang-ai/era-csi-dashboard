# ERA-CSI Dashboard — Claude Code Context

## Project
ERA-CSI (Customer Satisfaction Index) Dashboard untuk Erafone Region 5, Area Jakarta Pusat & Jakarta Barat.
Owner: Ghesang Pratano L. | VMD Assistant Manager, Erajaya Digital.

## Tech Stack
- Vanilla JS (no framework)
- Google Sheets API v4 (data source)
- Chart.js from CDN (visualisasi)
- Claude API — claude-haiku-4-5-20251001 (AI insight)
- Fonnte API (WhatsApp notification)
- Netlify static hosting + password protection

## File Structure
- `index.html` — main dashboard (all modules in one page)
- `css/style.css` — dark theme, SIERA design system
- `js/app.js` — all logic: fetch, filter, render, charts, AI, WA
- `config/config.js` — API config (DO NOT commit)
- `netlify.toml` — build config + cache headers
- `_redirects` — Netlify routing
- `.env` — secret keys template (DO NOT commit)

## Config Loading Pattern
```js
// config/config.js sets window.ERA_CSI_CONFIG
// app.js reads: CONFIG = window.ERA_CSI_CONFIG || {}
```

## Data Source
- Google Sheets ID: from SPREADSHEET_ID in config
- Sheet: "Form Responses 1" (or as configured)
- Range: A2:R500 (row 1 = header, skipped)

## Column Mapping (0-based index) — ACTUAL SHEET STRUCTURE
```
0  = A: Timestamp (auto-generated)
1  = B: Email Address (auto-generated)
2  = C: TANGGAL
3  = D: Area TSH (nama supervisor / Territory Sales Head)
4  = E: NAMA STORE
5  = F: JUMLAH SEMUA WIC TOKO HARI INI (Walk-in)
6  = G: JUMLAH TRANSAKSI (QTY) (Deal)
7  = H: USER WIC (customer organik walk-in)
8  = I: USER DATABASE (dari database/CRM)
9  = J: USER GOOGLE BISNIS (dari Google Maps/Business)
10 = K: USER SOSIAL MEDIA
11 = L: USER OMNICHANNEL (online-to-offline)
12 = M: JUMLAH TRANSAKSI DEVICE (QTY)
13 = N: JUMLAH TRANSAKSI MENGGUNAKAN MEMBER (Eraspace)
14 = O: VIDEO LITE (Bundling)
15 = P: CSI
16 = Q: REVIEW GOOGLE BISNIS
17 = R: FOLLOW INSTAGRAM ERAFONE
```

## Notes
- Tidak ada kolom AREA (Jakarta Pusat/Barat) — filter menggunakan TSH (supervisor) name
- Tidak ada kolom LOSS — dihitung: LOSS = WALKIN - DEAL
- Customer source ada 5 kategori: USER_WIC, USER_DB, USER_GOOGLE, SOSMED, O2O

## KPI Formulas
```
Conversion Rate  = G / F × 100      (DEAL / WALKIN)
Loss             = F - G             (computed, no column)
Eraspace Rate    = N / G × 100      (index 13, bukan 12!)
Bundle Rate      = O / G × 100      (VIDEO LITE / DEAL)
CSI Rate         = P / G × 100
Google Review %  = Q / G × 100
IG Follow Rate   = R / G × 100
Source % each    = (H|I|J|K|L) / G × 100  (per transaksi)
```

## Targets (hardcoded, editable in app.js TARGETS constant)
```
Conversion Rate : 40%
Eraspace Rate   : 80%
Bundle Rate     : 30%
CSI Rate        : 90%
Google Review % : 50%
IG Follow Rate  : 30%
```

## Design System
- Background: #0A0F1C
- Surface: #111827
- Border: #1E2D40
- Accent Primary: #00D4AA (teal — SIERA color)
- Accent Secondary: #3B82F6 (blue)
- Success: #10B981 | Warning: #F59E0B | Danger: #EF4444
- Font: Plus Jakarta Sans (Google Fonts)

## Status Color Logic
- Green (≥ target): success
- Yellow (≥ 80% of target): warning
- Red (< 80% of target): danger

## Auto-refresh
Dashboard auto-refreshes data from Sheets every 5 minutes.

## Security Notes
- config/config.js and .env are in .gitignore and .claudeignore
- API keys exposed client-side — mitigated by Netlify password protection
- Google Sheets API key should be restricted to Sheets API only in GCP Console
