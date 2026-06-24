import Link from 'next/link';

export default function StaffAccountSuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Account suspended</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Access to this Stride workspace has been suspended. Contact Raven Tech Group to
          resolve billing or contract status.
        </p>
        <p className="mt-6 text-sm">
          <a href="mailto:hello@raventechgroup.com" className="font-medium text-primary-700">
            hello@raventechgroup.com
          </a>
        </p>
        <Link
          href="/dashboard/login"
          className="mt-6 inline-block text-sm text-neutral-500 hover:text-neutral-800"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
