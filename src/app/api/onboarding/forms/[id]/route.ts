import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

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
    const field: NormalizedField = { key, label, type, required: Boolean(f.required) };
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

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding form access requires HR admin privileges.');
    }

    const template = await ctx.run((tx) =>
      tx.onboardingFormTemplate.findFirst({
        where: ctx.where({ id }),
        include: { _count: { select: { submissions: true, tasks: true, steps: true } } },
      }),
    );
    if (!template) return NextResponse.json({ error: 'Form template not found' }, { status: 404 });
    return NextResponse.json(template);
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding form access requires HR admin privileges.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    let fields: ReturnType<typeof normalizeFields> | undefined;
    if (body.fields !== undefined) {
      try {
        fields = normalizeFields(body.fields);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Invalid fields.' },
          { status: 400 },
        );
      }
    }

    const updated = await ctx.run(async (tx) => {
      const existing = await tx.onboardingFormTemplate.findFirst({ where: ctx.where({ id }) });
      if (!existing) return null;
      return tx.onboardingFormTemplate.update({
        where: { id },
        data: {
          name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined,
          description:
            body.description === undefined
              ? undefined
              : typeof body.description === 'string'
                ? body.description
                : null,
          fields: fields === undefined ? undefined : (fields as unknown as Prisma.InputJsonValue),
          isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        },
        include: { _count: { select: { submissions: true, tasks: true, steps: true } } },
      });
    });

    if (!updated) return NextResponse.json({ error: 'Form template not found' }, { status: 404 });

    await ctx.audit({
      action: 'onboarding.form_template.updated',
      entityType: 'OnboardingFormTemplate',
      entityId: id,
      route: 'PUT /api/onboarding/forms/[id]',
      metadata: { fieldsChanged: fields !== undefined },
    });

    return NextResponse.json(updated);
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding form access requires HR admin privileges.');
    }

    const result = await ctx.run(async (tx) => {
      const existing = await tx.onboardingFormTemplate.findFirst({
        where: ctx.where({ id }),
        include: { _count: { select: { submissions: true, tasks: true, steps: true } } },
      });
      if (!existing) return { status: 404 as const };
      // Guard against deleting a form that is already wired into templates or has data.
      if (existing._count.submissions > 0 || existing._count.tasks > 0 || existing._count.steps > 0) {
        return { status: 409 as const };
      }
      await tx.onboardingFormTemplate.delete({ where: { id } });
      return { status: 200 as const };
    });

    if (result.status === 404) {
      return NextResponse.json({ error: 'Form template not found' }, { status: 404 });
    }
    if (result.status === 409) {
      return NextResponse.json(
        { error: 'This form is in use by steps, tasks, or submissions. Deactivate it instead.' },
        { status: 409 },
      );
    }

    await ctx.audit({
      action: 'onboarding.form_template.deleted',
      entityType: 'OnboardingFormTemplate',
      entityId: id,
      route: 'DELETE /api/onboarding/forms/[id]',
    });

    return NextResponse.json({ ok: true });
  });
}
