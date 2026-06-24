'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';

type Ytd = {
  year: number;
  totals: {
    grossPay: number;
    netPay: number;
    paye: number;
    nssf: number;
    nhif: number;
    monthsPaid: number;
  } | null;
};

export default function EssPayYtdPage() {
  const [data, setData] = useState<Ytd | null>(null);

  useEffect(() => {
    fetch('/api/ess/pay/ytd')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const t = data?.totals;

  return (
    <div>
      <EssPageHeader title="Year to date" subtitle={`${data?.year ?? new Date().getFullYear()}`} backHref="/ess/pay" />
      {t ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Net pay (YTD)</p>
            <p className="text-2xl font-bold text-primary-900">KES {t.netPay.toLocaleString()}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Gross', t.grossPay],
              ['PAYE', t.paye],
              ['NSSF', t.nssf],
              ['NHIF', t.nhif],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-xl border border-neutral-200 bg-white p-3">
                <p className="text-xs text-neutral-500">{label}</p>
                <p className="font-semibold text-neutral-900">KES {Number(val).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-neutral-500">{t.monthsPaid} month(s) paid</p>
        </div>
      ) : (
        <p className="rounded-xl border border-neutral-200 bg-white py-10 text-center text-sm text-neutral-500">
          No payroll data for this year yet.
        </p>
      )}
    </div>
  );
}
