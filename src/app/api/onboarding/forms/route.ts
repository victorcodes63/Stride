import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

const FIELD_TYPES = ['text', 'email', 'phone', 'number', 'date', 'select', 'textarea', 'checkbox'];

type NormalizedField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  section?: string;
};

/** Validate + normalize the `fields` JSON array. Throws a message on invalid input. */
function normalizeFields(raw: unknown): NormalizedField[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error('fields must be an array.');
  const seen = new Set<string>();
  const out: NormalizedField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') throw new Error('Each field must be an object.');
    const f = item as Record<string, unknown>;
    const key = typeof f.key === 'string' ? f.key.trim() : '';
    const label = typeof f.label === 'string' ? f.label.trim() : '';
    if (!key) throw new Error('Every field needs a non-empty key.');
    if (!label) throw new Error(`Field "${key}" needs a label.`);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
      throw new Error(`Field key "${key}" must start with a letter and contain only letters, numbers, or underscores.`);
    }
    if (seen.has(key)) throw new Error(`Duplicate field key "${key}".`);
    seen.add(key);
    const type = typeof f.type === 'string' && FIELD_TYPES.includes(f.type) ? f.type : 'text';
    const field: NormalizedField = {
      key,
      label,
      type,
      required: Boolean(f.required),
    };
    if (Array.isArray(f.options)) {
      field.options = f.options.filter((o): o is string => typeof o === 'string');
    }
    if (typeof f.placeholder === 'string' && f.placeholder) field.placeholder = f.placeholder;
    if (typeof f.helpText === 'string' && f.helpText) field.helpText = f.helpText;
    if (typeof f.section === 'string' && f.section) field.section = f.section;
    out.push(field);
  }
  return out;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding form access requires HR admin privileges.');
    }

    const activeOnly = request.nextUrl.searchParams.get('active') === 'true';
    const templates = await ctx.run((tx) =>
      tx.onboardingFormTemplate.findMany({
        where: {
          ...ctx.where(),
          ...(activeOnly ? { isActive: true } : {}),
        },
        include: { _count: { select: { submissions: true, tasks: true, steps: true } } },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
    );

    return NextResponse.json(templates);
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding form access requires HR admin privileges.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    let fields: NormalizedField[];
    try {
      fields = normalizeFields(body?.fields);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid fields.' },
        { status: 400 },
      );
    }

    const template = await ctx.run((tx) =>
      tx.onboardingFormTemplate.create({
        data: {
          organizationId: ctx.organizationId,
          name,
          description: typeof body?.description === 'string' ? body.description : null,
          fields: fields as unknown as Prisma.InputJsonValue,
          isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
        },
      }),
    );

    await ctx.audit({
      action: 'onboarding.form_template.created',
      entityType: 'OnboardingFormTemplate',
      entityId: template.id,
      route: 'POST /api/onboarding/forms',
      metadata: { fieldCount: fields.length },
    });

    return NextResponse.json(template, { status: 201 });
  });
}
