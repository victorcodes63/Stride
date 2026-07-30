# Live demo cheat sheet — multi-vertical

Login: `admin@imara.co.ke` / `Demo@2026!` · URL: https://demo.getstride.co.ke

Login brand shows **Stride Demo** (one shared tenant). Use the **top-bar company switcher** to change industry — default opens on Savannah Freight.

Switching company also changes **which modules appear in the sidebar** (industry packs). Savannah is the full-platform tour. Each company has seeded data for its enabled modules.

| Company | Modules you will see | Lead with | Avoid empty clicks |
|--------|----------------------|-----------|--------------------|
| **Savannah Freight** | **All modules** (incl. Fleet, Sales, Outsourcing) | Payroll, rota, attendance, **Outsourcing end-clients**, Fleet | Deep planned engines (sacco/healthcare) |
| **Heritage Members SACCO** | HR/finance + ATS + SACCO + assets/HSE + procurement/performance | Payroll, members/dividends, assets | Fleet, Sales, Projects, Outsourcing |
| **Amani Medical Centre** | HR/finance + ATS + Healthcare + HSE/assets | Headcount, rota, licences, HSE | Fleet, Sales, Construction, Outsourcing |
| **Northline Petroleum** | HR/finance + ATS + Energy + HSE/assets | Permits, HSE incidents, procurement | Fleet, SACCO, Construction, Sales |
| **Kilimani Builders** | HR/finance + ATS + Projects + Construction | Projects linked to sites, plant, subcontractors | Fleet, SACCO, Healthcare, Sales |
| **Horizon Travels** | HR/finance + ATS + Sales (+ assessments) + procurement | People ops, ATS, **travel + cargo sales KPIs** | Industry vertical engines, Outsourcing, Projects |

### Security / manpower buyers (recommended path)

Stay on **Savannah Freight**. Do **not** invent a seventh switcher company.

1. **Outsourcing → Clients** — 8 guarding end-clients (Westlands Mall, Two Rivers, Industrial Area Warehouse, Bank Branch Network, Kitengela Estate, Hospital Night Watch, JKIA Cargo Perimeter, Sameer Business Park). These have `entityCode: null` so they never appear in the top-bar switcher.
2. Open one client → **employees / guards**, credentials (PSRA licences), **rota**, **attendance** (punches + day summaries), **payroll**.
3. Back on Savannah entity: show scaled field headcount (~130), geo work site, biometric devices, invoices under Accounts.
4. **ESS** — logistics hero: `moses.okello@savannahfreight.co.ke` / `Demo@2026!`. Guard phone: `guard.demo@westlands.security.demo.ke` / `Demo@2026!`.

Pitch line: *client/site → guards → rota → attendance → pay* (not a GSOC/patrol product).

### Safe clicks (Savannah)

- Outsourcing clients & employees  
- Rota / shift assignments  
- Attendance (day summaries, events, work sites)  
- Biometric devices **and** punch history  
- Payroll (approved prior month + draft current)  
- Accounts invoices (paid / unpaid / partial)  
- ESS (Moses or Westlands guard)  
- Light HSE / credentials  

### Recommended flow
1. Start on **Savannah Freight** — full platform + outsourcing end-clients.
2. Switch to the **client’s industry** only if they ask for a vertical pack.
3. Keep sector engines light (planned modules) unless the client asks.

### ESS
- Logistics: `moses.okello@savannahfreight.co.ke` / `Demo@2026!` (while on Savannah).
- Security guard: `guard.demo@westlands.security.demo.ke` / `Demo@2026!`.

**Local/dev:** keep Savannah single-company — do not rely on this switcher for day-to-day feature work.

### Reseed / smoke
```bash
npm run demo:prep:live          # provision + smoke
npm run demo:cleanup:orphans    # orphan client cleanup only
npm run demo:seed:security-bpo  # security end-clients only
```
