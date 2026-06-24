type ApiErrorPayload = {
  route: string;
  message: string;
  status?: number;
  context?: Record<string, unknown>;
};

export async function reportApiError(payload: ApiErrorPayload) {
  const logPayload = {
    route: payload.route,
    status: payload.status ?? 500,
    message: payload.message,
    context: payload.context ?? {},
  };
  console.error('[API_ERROR]', logPayload);

  const webhook = process.env.MONITORING_WEBHOOK_URL?.trim();
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `API failure on ${logPayload.route}`,
        ...logPayload,
        at: new Date().toISOString(),
      }),
    });
  } catch (notifyError) {
    console.error('[API_ERROR] Failed to notify monitoring webhook', notifyError);
  }
}
