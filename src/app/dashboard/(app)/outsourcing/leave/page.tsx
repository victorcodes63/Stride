import { redirect } from 'next/navigation';

type PageProps = {
  searchParams: Promise<{ status?: string; section?: string }>;
};

export default async function OutsourcingLeaveRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams({ audience: 'employees' });
  if (params.status) qs.set('status', params.status);
  if (params.section) qs.set('section', params.section);
  redirect(`/dashboard/leave?${qs.toString()}`);
}
