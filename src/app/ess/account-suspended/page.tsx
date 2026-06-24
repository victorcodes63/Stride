import Link from 'next/link';

export default function EssAccountSuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Portal unavailable</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Employee self-service is temporarily unavailable for this organization. Please
          contact your HR administrator or Raven Tech Group support.
        </p>
        <Link
          href="/ess/login"
          className="mt-6 inline-block text-sm text-neutral-500 hover:text-neutral-800"
        >
          Back to ESS login
        </Link>
      </div>
    </div>
  );
}
