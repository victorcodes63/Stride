'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { toast } from '@/components/ui/toast';
import {
  DynamicForm,
  getFormValidationErrors,
  parseFormFields,
  type FormFieldDef,
  type FormValues,
} from '@/components/onboarding/DynamicForm';
import {
  EssAlert,
  EssCard,
  EssLoadingState,
  essPrimaryButtonClass,
  essSecondaryButtonClass,
} from '@/components/ess/EssUi';

type FormResponse = {
  task: { id: string; title: string; description: string | null; status: string };
  workflow: { templateName: string | null };
  formTemplate: { id: string; name: string; description: string | null; fields: unknown };
  submission: { id: string; status: string; data: Record<string, unknown>; reviewNotes: string | null };
};

export default function EssOnboardingFormPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.taskId as string;

  const [data, setData] = useState<FormResponse | null>(null);
  const [fields, setFields] = useState<FormFieldDef[]>([]);
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);

  const load = useCallback(async () => {
    if (!taskId) return;
    setError(null);
    const res = await fetch(`/api/ess/onboarding/forms/${taskId}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setData(null);
      setError(body.error || 'Form not found.');
      return;
    }
    const parsed = parseFormFields(body.formTemplate.fields);
    setData(body as FormResponse);
    setFields(parsed);
    setValues((body.submission?.data as FormValues) ?? {});
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  function onChange(key: string, value: string | number | boolean | null) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  async function persist(status: 'DRAFT' | 'SUBMITTED') {
    if (!navigator.onLine) {
      toast.error('You are offline. Reconnect before saving.');
      return;
    }
    if (status === 'SUBMITTED') {
      const validation = getFormValidationErrors(fields, values);
      if (Object.keys(validation).length > 0) {
        setErrors(validation);
        toast.error('Please complete the required fields.');
        return;
      }
    }
    setBusy(status === 'DRAFT' ? 'draft' : 'submit');
    setError(null);
    try {
      const res = await fetch(`/api/ess/onboarding/forms/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, data: values }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save form.');
      if (status === 'SUBMITTED') {
        toast.success('Form submitted.');
        router.push('/ess/onboarding');
      } else {
        toast.success('Draft saved.');
        await load();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save form.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <EssPageHeader title="Form" subtitle="Loading…" backHref="/ess/onboarding" />
        <EssLoadingState label="Loading form…" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <EssPageHeader title="Form" subtitle="Not found" backHref="/ess/onboarding" />
        <EssAlert tone="danger">{error || 'Form not found.'}</EssAlert>
      </div>
    );
  }

  const locked = data.submission.status === 'APPROVED';
  const alreadySubmitted =
    data.submission.status === 'SUBMITTED' || data.submission.status === 'APPROVED';

  return (
    <div className="space-y-4">
      <EssPageHeader
        title={data.formTemplate.name}
        subtitle={data.workflow.templateName ?? data.task.title}
        backHref="/ess/onboarding"
      />

      {error ? <EssAlert tone="danger">{error}</EssAlert> : null}

      {data.submission.status === 'REJECTED' && data.submission.reviewNotes ? (
        <EssAlert tone="warning">
          HR requested changes: {data.submission.reviewNotes}
        </EssAlert>
      ) : null}

      {alreadySubmitted ? (
        <EssAlert tone={locked ? 'success' : 'info'}>
          {locked
            ? 'This form was approved and is locked.'
            : 'This form has been submitted and is awaiting HR review. You can update and resubmit if needed.'}
        </EssAlert>
      ) : null}

      <EssCard>
        {data.formTemplate.description ? (
          <p className="mb-4 text-sm text-[var(--ess-muted)]">{data.formTemplate.description}</p>
        ) : null}
        {fields.length ? (
          <DynamicForm
            surface="ess"
            fields={fields}
            values={values}
            onChange={onChange}
            errors={errors}
            disabled={locked || busy !== null}
          />
        ) : (
          <p className="text-sm text-[var(--ess-muted)]">This form has no fields to complete.</p>
        )}
      </EssCard>

      {!locked ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void persist('DRAFT')}
            className={`${essSecondaryButtonClass} inline-flex flex-1 items-center justify-center gap-2`}
          >
            {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </button>
          <button
            type="button"
            disabled={busy !== null || fields.length === 0}
            onClick={() => void persist('SUBMITTED')}
            className={`${essPrimaryButtonClass} inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-50`}
          >
            {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Submit
          </button>
        </div>
      ) : null}
    </div>
  );
}
