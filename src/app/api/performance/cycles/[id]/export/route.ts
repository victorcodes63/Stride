import { NextRequest, NextResponse } from 'next/server';

import { ratingLabel } from '@/lib/performance/service';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    const cycle = await ctx.run((tx) =>
      tx.performanceCycle.findFirst({
        where: ctx.where({ id }),
        include: {
          reviews: {
            include: {
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                  employeeNumber: true,
                  department: { select: { name: true } },
                },
              },
            },
            orderBy: { employee: { lastName: 'asc' } },
          },
        },
      }),
    );

    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

    const header = [
      'Employee',
      'Employee number',
      'Department',
      'Status',
      'Self rating',
      'Manager rating',
      'Self submitted',
      'Manager submitted',
    ];

    const rows = cycle.reviews.map((review) => [
      csvEscape(`${review.employee.firstName} ${review.employee.lastName}`.trim()),
      csvEscape(review.employee.employeeNumber),
      csvEscape(review.employee.department?.name ?? ''),
      csvEscape(review.status),
      csvEscape(review.overallSelfRating ? `${review.overallSelfRating}/5` : ''),
      csvEscape(review.overallManagerRating ? `${review.overallManagerRating}/5 (${ratingLabel(review.overallManagerRating)})` : ''),
      csvEscape(review.selfSubmittedAt?.toISOString().slice(0, 10) ?? ''),
      csvEscape(review.managerSubmittedAt?.toISOString().slice(0, 10) ?? ''),
    ]);

    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const fileName = `${cycle.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}-reviews.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  });
}
