import type { Metadata } from 'next';

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, '') ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!id) return { title: 'Apply' };

  try {
    const res = await fetch(`${baseUrl}/api/jobs/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: 'Apply for this role' };
    const data = (await res.json()) as { title?: string; company?: string };
    const title = data.title
      ? `Apply for ${data.title}${data.company ? ` at ${data.company}` : ''}`
      : 'Apply for this role';
    const description = data.title
      ? `Apply now for ${data.title}. ${data.company ? data.company + ' – ' : ''}Stride job board.`
      : undefined;
    return {
      title,
      description,
      openGraph: {
        title: `${title} | Stride`,
        description,
        url: `/careers/apply/${id}`,
      },
    };
  } catch {
    return { title: 'Apply for this role' };
  }
}

export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
