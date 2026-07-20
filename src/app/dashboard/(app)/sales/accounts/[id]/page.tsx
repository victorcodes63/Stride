import type { Metadata } from 'next';
import Account360Content from './Account360Content';

export const metadata: Metadata = {
  title: 'Account 360 | Stride Dashboard',
};

export default async function SalesAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Account360Content accountId={id} />;
}
