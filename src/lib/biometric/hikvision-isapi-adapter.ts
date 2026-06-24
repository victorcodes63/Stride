import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { BiometricDevice } from '@prisma/client';
import type { BiometricAdapter, RawPunch } from './biometric-adapter';

/**
 * Hikvision ISAPI over HTTP(S) with Digest authentication (`AcsEvent` search).
 *
 * **Config** (`BiometricDevice.config` JSON): `host` (required), `port` (default 80),
 * `username` / `password` (Digest; password is often stored plaintext in JSON today —
 * TODO: encrypt at rest or load from a secret manager and only store a reference here),
 * optional `tls` or `useHttps` (default false), `timezone` (IANA, default `Africa/Nairobi`)
 * for `startTime` / `endTime` formatting.
 *
 * **Testing without hardware:** set `HIKVISION_ISAPI_MOCK=1` (or `true`). The adapter returns
 * synthetic `RawPunch` rows and `testConnection` / probe succeed without network I/O.
 *
 * **Real device:** ensure the server can reach the terminal IP, open port 80/443, and use
 * the same Digest user as the NVR/terminal web UI. Poll uses `POST .../ISAPI/AccessControl/AcsEvent?format=json`.
 */
export type HikvisionDeviceRow = Pick<
  BiometricDevice,
  'id' | 'adapterKind' | 'config'
>;

type ParsedConnection = {
  host: string;
  port: number;
  useHttps: boolean;
  username: string;
  password: string;
  timezone: string;
};

const MOCK_ENV_KEYS = ['HIKVISION_ISAPI_MOCK', 'HIKVISION_ISAPI_MOCK_MODE'] as const;

function isMockMode(): boolean {
  const v = process.env[MOCK_ENV_KEYS[0]] ?? process.env[MOCK_ENV_KEYS[1]];
  return v === '1' || v === 'true' || v === 'yes';
}

function mockPollEvents(): RawPunch[] {
  // Avoid appending rows on every cron tick; use `vitest` with `fetch` mocked to exercise parsing.
  return [];
}

function readString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
    const found = Object.keys(obj).find((x) => x.toLowerCase() === k.toLowerCase());
    if (found) {
      const w = obj[found];
      if (typeof w === 'string' && w.trim() !== '') return w.trim();
    }
  }
  return undefined;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const v = obj[key];
  if (typeof v === 'boolean') return v;
  return undefined;
}

function readPort(obj: Record<string, unknown>): number {
  const p = obj.port;
  if (typeof p === 'number' && Number.isFinite(p) && p > 0 && p < 65536) return Math.floor(p);
  if (typeof p === 'string' && /^\d+$/.test(p)) {
    const n = Number(p);
    if (n > 0 && n < 65536) return n;
  }
  return 80;
}

/** Exported for unit tests — builds `Authorization: Digest ...` for one request. */
export function buildDigestAuthorizationHeader(params: {
  method: string;
  digestUri: string;
  username: string;
  password: string;
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
  /** Tests only — omit in production calls so `cnonce` stays unpredictable. */
  cnonceOverride?: string;
}): string {
  const { method, digestUri, username, password, realm, nonce } = params;
  const qopRaw = params.qop?.split(',')[0]?.trim();
  const qop = qopRaw && qopRaw !== '' ? qopRaw : 'auth';
  const nc = '00000001';
  const cnonce = params.cnonceOverride ?? randomBytes(8).toString('hex');

  const algorithm = (params.algorithm ?? 'MD5').toUpperCase();
  const isSess = algorithm === 'MD5-SESS';

  const ha1Input = isSess
    ? `${createHash('md5').update(`${username}:${realm}:${password}`).digest('hex')}:${nonce}:${cnonce}`
    : `${username}:${realm}:${password}`;
  const ha1 = createHash('md5').update(ha1Input).digest('hex');
  const ha2 = createHash('md5').update(`${method}:${digestUri}`).digest('hex');
  const response = createHash('md5')
    .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    .digest('hex');

  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const parts = [
    `Digest username="${esc(username)}"`,
    `realm="${esc(realm)}"`,
    `nonce="${esc(nonce)}"`,
    `uri="${esc(digestUri)}"`,
    `qop=${qop}`,
    `nc=${nc}`,
    `cnonce="${cnonce}"`,
    `response="${response}"`,
  ];
  if (params.opaque) parts.push(`opaque="${esc(params.opaque)}"`);
  if (algorithm && algorithm !== 'MD5') parts.push(`algorithm=${algorithm}`);
  return parts.join(', ');
}

function parseDigestChallenge(wwwAuthenticate: string): Record<string, string> {
  const out: Record<string, string> = {};
  const header = wwwAuthenticate.replace(/^Digest\s+/i, '');
  const re = /([a-zA-Z0-9_-]+)\s*=\s*("([^"]*)"|([^,]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) !== null) {
    const key = m[1].toLowerCase();
    const val = (m[3] ?? m[4] ?? '').trim().replace(/^"|"$/g, '');
    out[key] = val;
  }
  return out;
}

function baseUrlForHost(host: string, port: number, useHttps: boolean): string {
  const hasBracket = host.startsWith('[') && host.endsWith(']');
  const isV6 = !hasBracket && host.includes(':');
  const hostPart = isV6 ? `[${host}]` : host;
  return `${useHttps ? 'https' : 'http'}://${hostPart}:${port}`;
}

function formatIsapiLocalTime(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const g = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === t)?.value ?? '00';
    const y = g('year');
    const mo = g('month');
    const d = g('day');
    const h = g('hour');
    const mi = g('minute');
    const s = g('second');
    const offsetFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      timeZoneName: 'longOffset',
    });
    const offsetPart = offsetFormatter.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? '';
    const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(offsetPart);
    if (m) {
      const sign = m[1];
      const oh = m[2].padStart(2, '0');
      const om = (m[3] ?? '00').padStart(2, '0');
      return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${oh}:${om}`;
    }
    return `${y}-${mo}-${d}T${h}:${mi}:${s}+03:00`;
  } catch {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace('Z', '+03:00');
  }
}

function parseConnection(device: HikvisionDeviceRow): ParsedConnection | null {
  const raw = device.config;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  const host = readString(c, 'host', 'ip', 'address');
  if (!host) return null;
  const username = readString(c, 'username', 'user', 'login') ?? '';
  const password = readString(c, 'password', 'pass') ?? '';
  const useHttps =
    readBoolean(c, 'useHttps') === true ||
    readBoolean(c, 'tls') === true ||
    readString(c, 'protocol')?.toLowerCase() === 'https';
  const timezone = readString(c, 'timezone', 'timeZone') ?? 'Africa/Nairobi';
  return {
    host,
    port: readPort(c),
    useHttps,
    username,
    password,
    timezone,
  };
}

function getRecord(obj: unknown): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  return obj as Record<string, unknown>;
}

function getNested(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    const r = getRecord(cur);
    if (!r) return undefined;
    const key = Object.keys(r).find((k) => k.toLowerCase() === p.toLowerCase()) ?? p;
    cur = r[key];
  }
  return cur;
}

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return String(v);
}

export class HikvisionIsapiAdapter implements BiometricAdapter {
  constructor(private readonly device: HikvisionDeviceRow) {}

  async testConnection(): Promise<boolean> {
    const r = await this.probeConnection();
    return r.ok;
  }

  /**
   * GET `/ISAPI/System/deviceInfo` with Digest; returns JSON or XML snippet in `deviceInfo` when possible.
   */
  async probeConnection(): Promise<{
    ok: boolean;
    httpStatus?: number;
    deviceInfo?: Record<string, unknown>;
    error?: string;
  }> {
    if (isMockMode()) {
      return {
        ok: true,
        httpStatus: 200,
        deviceInfo: { mock: true, deviceId: this.device.id, model: 'HIKVISION_ISAPI_MOCK' },
      };
    }
    const conn = parseConnection(this.device);
    if (!conn || !conn.username) {
      return {
        ok: false,
        error: 'Missing device config: host and username are required for ISAPI.',
      };
    }
    try {
      const path = '/ISAPI/System/deviceInfo';
      const res = await this.digestRequest(conn, 'GET', path, undefined);
      const text = await res.text();
      let deviceInfo: Record<string, unknown> | undefined;
      if (res.ok) {
        try {
          deviceInfo = JSON.parse(text) as Record<string, unknown>;
        } catch {
          const snippet = text.slice(0, 2000);
          deviceInfo = { format: 'text_or_xml', snippet };
        }
      }
      return res.ok
        ? { ok: true, httpStatus: res.status, deviceInfo }
        : { ok: false, httpStatus: res.status, error: `HTTP ${res.status}: ${text.slice(0, 500)}` };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message };
    }
  }

  async pollEvents(since?: Date): Promise<RawPunch[]> {
    const now = new Date();
    const sinceDate = since ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (isMockMode()) {
      return mockPollEvents();
    }

    const conn = parseConnection(this.device);
    if (!conn || !conn.username) {
      return [];
    }

    const path = '/ISAPI/AccessControl/AcsEvent?format=json';
    const searchId = randomUUID();
    const bodyTemplate = {
      AcsEventCond: {
        searchID: searchId,
        searchResultPosition: 0,
        maxResults: 100,
        major: 0,
        minor: 0,
        startTime: formatIsapiLocalTime(sinceDate, conn.timezone),
        endTime: formatIsapiLocalTime(now, conn.timezone),
      },
    };

    const events: RawPunch[] = [];
    let position = 0;
    let hasMore = true;

    while (hasMore) {
      const body = {
        AcsEventCond: {
          ...bodyTemplate.AcsEventCond,
          searchResultPosition: position,
        },
      };
      const res = await this.digestRequest(conn, 'POST', path, JSON.stringify(body));
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`ISAPI AcsEvent poll failed: HTTP ${res.status} ${t.slice(0, 400)}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const acs = getNested(data, 'AcsEvent') as Record<string, unknown> | undefined;
      const infoListRaw = acs ? (getNested(acs, 'InfoList') as unknown) : undefined;
      const infoList = Array.isArray(infoListRaw) ? infoListRaw : [];

      for (const item of infoList) {
        const ev = getRecord(item);
        if (!ev) continue;
        const serial =
          asString(getNested(ev, 'serialNo')) ||
          asString(getNested(ev, 'SerialNo')) ||
          `${asString(getNested(ev, 'time'))}-${asString(getNested(ev, 'employeeNoString'))}`;
        const empStr =
          asString(getNested(ev, 'employeeNoString')) ||
          asString(getNested(ev, 'EmployeeNoString')) ||
          asString(getNested(ev, 'employeeNo')) ||
          asString(getNested(ev, 'EmployeeNo'));
        const timeStr = asString(getNested(ev, 'time')) || asString(getNested(ev, 'Time'));
        const observedAt = timeStr ? new Date(timeStr) : now;
        const major = Number(getNested(ev, 'major') ?? getNested(ev, 'Major') ?? 0);
        const minor = Number(getNested(ev, 'minor') ?? getNested(ev, 'Minor') ?? 0);

        events.push({
          externalEventId: serial || randomUUID(),
          deviceConfigRef: { id: this.device.id },
          observedAt: Number.isNaN(observedAt.getTime()) ? now : observedAt,
          rawSubjectId: empStr || 'unknown',
          direction: 'unknown',
          rawPayload: {
            ...ev,
            cardReaderNo: getNested(ev, 'cardReaderNo') ?? getNested(ev, 'CardReaderNo'),
            name: getNested(ev, 'name') ?? getNested(ev, 'Name'),
            major,
            minor,
          },
        });
      }

      const totalMatches = Number(
        getNested(acs ?? {}, 'totalMatches') ?? getNested(acs ?? {}, 'TotalMatches') ?? 0,
      );
      position += infoList.length;
      hasMore = totalMatches > 0 && position < totalMatches;
      if (infoList.length === 0) {
        hasMore = false;
      }
    }

    return events;
  }

  private async digestRequest(
    conn: ParsedConnection,
    method: string,
    pathWithQuery: string,
    body?: string,
  ): Promise<Response> {
    const base = baseUrlForHost(conn.host, conn.port, conn.useHttps);
    const url = `${base}${pathWithQuery.startsWith('/') ? '' : '/'}${pathWithQuery}`;

    const initial = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
    });

    if (initial.status !== 401) {
      return initial;
    }

    const www = initial.headers.get('WWW-Authenticate');
    if (!www || !/^Digest/i.test(www)) {
      throw new Error('Device returned 401 without a Digest WWW-Authenticate challenge.');
    }

    const ch = parseDigestChallenge(www);
    const realm = ch.realm;
    const nonce = ch.nonce;
    if (!realm || !nonce) {
      throw new Error('Digest challenge missing realm or nonce.');
    }

    const digestUri = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
    const auth = buildDigestAuthorizationHeader({
      method,
      digestUri,
      username: conn.username,
      password: conn.password,
      realm,
      nonce,
      qop: ch.qop,
      opaque: ch.opaque,
      algorithm: ch.algorithm,
    });

    const authed = await fetch(url, {
      method,
      headers: {
        Authorization: auth,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
    });

    if (authed.status === 401) {
      const www2 = authed.headers.get('WWW-Authenticate');
      if (www2 && /^Digest/i.test(www2)) {
        const ch2 = parseDigestChallenge(www2);
        if (ch2.realm && ch2.nonce) {
          const auth2 = buildDigestAuthorizationHeader({
            method,
            digestUri,
            username: conn.username,
            password: conn.password,
            realm: ch2.realm,
            nonce: ch2.nonce,
            qop: ch2.qop,
            opaque: ch2.opaque,
            algorithm: ch2.algorithm,
          });
          return fetch(url, {
            method,
            headers: {
              Authorization: auth2,
              ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: method === 'GET' || method === 'HEAD' ? undefined : body,
          });
        }
      }
    }

    return authed;
  }
}
