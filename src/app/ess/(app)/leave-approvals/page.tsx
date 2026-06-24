'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EssLeaveApprovalsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ess/team/leave');
  }, [router]);
  return (
    <p className="py-8 text-center text-sm text-neutral-500">Redirecting to team approvals…</p>
  );
}
