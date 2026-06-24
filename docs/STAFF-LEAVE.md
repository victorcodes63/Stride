# Staff leave module (internal HRIS demo)

For **dashboard users** (`User` table), not outsourcing employees.

## Run once

```bash
npx prisma migrate deploy   # if not already
npm run db:seed-staff-leave # default leave types + balances for all active users (current year)
```

## Where to use

- **Dashboard → People & HR → Staff leave** (`/dashboard/staff-leave`)
- Sign in with a real **User** account (not legacy-only session) so APIs receive `userId`.

## Features (v1)


| Area             | Behaviour                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Leave types**  | Annual, Sick, Maternity, Paternity, Compassionate, Unpaid (configurable). Admin edits days/year, active, approval required. |
| **Balances**     | Per user, per type, per year: entitled + carried over − used − pending.                                                     |
| **Requests**     | Date range; working days (Mon–Fri) counted. Pending consumes “available” until approved/rejected.                           |
| **Approval**     | Admins see **Approvals** tab; approve increments `usedDays`, reject leaves balance unchanged.                               |
| **Unpaid**       | `daysPerYear === 0` → no balance deduction; still goes through approval if enabled.                                         |
| **Auto-approve** | Type with `requiresApproval: false` → approved immediately and `usedDays` updated.                                          |


## APIs (cookie auth)

- `GET/POST /api/staff/leave/types` — list (auth); create (admin)
- `PATCH/DELETE /api/staff/leave/types/[id]` — admin
- `GET /api/staff/leave/balances?year=` — my balances; admin `?userId=`
- `POST /api/staff/leave/balances` — admin: create missing balance rows for all users
- `GET /api/staff/leave/applications?scope=me|team` — team + pending for admin
- `POST /api/staff/leave/applications` — submit
- `PATCH /api/staff/leave/applications/[id]` — `{ action: 'approve'|'reject'|'cancel', reviewNote? }`

## Later refinements

- Public holidays + half-days
- Carry-over rules per type
- Email/Slack on submit/approve
- Manager chain (not only admin)
- Calendar view & iCal export

