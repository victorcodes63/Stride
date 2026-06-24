import { NextResponse } from 'next/server';

const GONE = {
  error:
    'Per-client recruitment API is removed. Use GET/PATCH /api/recruitment-settings and Dashboard → Recruitment → Organization.',
};

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function PATCH() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json(GONE, { status: 410 });
}
