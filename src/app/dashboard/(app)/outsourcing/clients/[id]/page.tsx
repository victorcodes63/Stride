import { Suspense } from 'react';
import ClientDetailView from './ClientDetailView';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OutsourcingClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading end-client…</div>}
    >
      <ClientDetailView clientId={id} />
    </Suspense>
  );
}
