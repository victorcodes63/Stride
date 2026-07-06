# SPD-00 baseline (RAV-273)

Measured **2026-07-06** against local dev (`cargo-logistics` demo, Neon EU DB). Prisma slow-query threshold: **>100ms**. Run again with `npm run spd:benchmark`.

## HTTP route latency (wall clock, ranked)

| Rank | Route | ms | Notes |
| ---: | --- | ---: | --- |
| 1 | `/api/dashboard/overview?metricsOnly=1&slice=core` | 11,810–14,142 | ~20+ parallel counts/aggregations |
| 2 | `/api/outsourcing/employees` | 7,786–8,033 | Full-table `findMany` + joins |
| 3 | `/api/projects/dashboard` | 7,220–7,406 | Multi-count project dashboard |
| 4 | `/api/outsourcing/payroll` | 6,825–7,256 | Payroll list + aggregates |
| 5 | `/api/disciplinary/cases` | 6,845–6,936 | Case list |
| 6 | `/api/grievances` | 6,584–6,733 | Grievance list + counts |
| 7 | `/api/disciplinary/sla-summary` | 6,600–6,741 | SLA aggregation |
| 8 | `/api/dashboard/overview?metricsOnly=1&slice=details` | 6,508–6,553 | Details slice |
| 9 | `/api/fleet/overview` | 5,197 | Fleet status counts |
| 10 | `/api/accounts/invoices` | 4,546 | Invoice list |

## Prisma slow queries (444 events >100ms)

Top patterns (route attribution fixed in RAV-273 instrumentation):

| Query pattern | Max ms | Hot routes |
| --- | ---: | --- |
| `Grievance` COUNT + `Employee` join | 482 | overview core, grievances |
| `DisciplinaryCase` list / SLA fields | 421 | disciplinary cases, overview |
| `Employee` findMany (client org filter) | 413+ | employees, overview |
| `EmployeeCredential` expiry counts | 419 | overview core |
| `LeaveApplication` / `StaffLeaveApplication` pending counts | 414 | overview core |
| `FleetVehicle` / `FleetTrip` status GROUP BY | 418–421 | fleet overview, overview |
| `Payroll` SUM aggregates | 413 | overview core, payroll |
| `Project` / `ProjectTask` dashboard counts | 413–443 | projects dashboard |
| `OnboardingTask` pending | 429 | overview details |
| `StaffNotification` unread | 417 | overview core |
| `set_config('app.current_org')` per transaction | 419 | all tenant routes (expected overhead) |

## Prioritisation (feeds SPD-01–06)

1. **Composite `(organizationId, status|employmentStatus|…)` indexes** on tables above — SPD-01.
2. **Neon pooler + region** — SPD-02/03 (see `docs/SPD-VICTOR-TODO.md`).
3. **Overview core**: sessionStorage cache + bootstrap slice already partially implemented; keep parallel core/details fetches — SPD-04.
4. **Employees API**: paginate + narrow `select` — SPD-05.
5. **Dashboard RSC `Suspense` + skeleton** on `/dashboard` — SPD-06.
