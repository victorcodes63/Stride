import { createHash } from 'node:crypto';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildDigestAuthorizationHeader, HikvisionIsapiAdapter } from './hikvision-isapi-adapter';

describe('buildDigestAuthorizationHeader', () => {
  it('computes RFC 2617 qop=auth response (deterministic cnonce)', () => {
    const cnonce = '0a4f113b';
    const header = buildDigestAuthorizationHeader({
      method: 'GET',
      digestUri: '/dir/index.html',
      username: 'Mufasa',
      password: 'Circle Of Life',
      realm: 'testrealm@host.com',
      nonce: 'dcd98b7102dd2f0e8b11d0f600bfb9a2',
      qop: 'auth',
      cnonceOverride: cnonce,
    });
    const ha1 = createHash('md5')
      .update('Mufasa:testrealm@host.com:Circle Of Life')
      .digest('hex');
    const ha2 = createHash('md5').update('GET:/dir/index.html').digest('hex');
    const expectedResponse = createHash('md5')
      .update(`${ha1}:dcd98b7102dd2f0e8b11d0f600bfb9a2:00000001:${cnonce}:auth:${ha2}`)
      .digest('hex');
    expect(header).toContain(`response="${expectedResponse}"`);
    expect(header).toContain(`cnonce="${cnonce}"`);
    expect(header).toContain('qop=auth');
  });
});

describe('HikvisionIsapiAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.HIKVISION_ISAPI_MOCK;
  });

  it('pollEvents parses AcsEvent.InfoList from mocked fetch', async () => {
    const device = {
      id: 'dev-1',
      adapterKind: 'hikvision_isapi',
      config: {
        host: '10.0.0.1',
        port: 80,
        username: 'admin',
        password: 'x',
      },
    };

    const json = {
      AcsEvent: {
        totalMatches: 1,
        InfoList: [
          {
            serialNo: 42,
            employeeNoString: 'EMP001',
            time: '2026-04-28T08:15:00+03:00',
            major: 5,
            minor: 75,
            cardReaderNo: 1,
          },
        ],
      },
    };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, { status: 401, headers: { 'WWW-Authenticate': 'Digest realm="r", nonce="n", qop="auth"' } })
        )
        .mockResolvedValueOnce(new Response(JSON.stringify(json), { status: 200 }))
    );

    const adapter = new HikvisionIsapiAdapter(device);
    const since = new Date('2026-04-28T00:00:00.000Z');
    const punches = await adapter.pollEvents(since);
    expect(punches).toHaveLength(1);
    expect(punches[0]!.externalEventId).toBe('42');
    expect(punches[0]!.rawSubjectId).toBe('EMP001');
    expect(punches[0]!.direction).toBe('unknown');
    expect(punches[0]!.deviceConfigRef.id).toBe('dev-1');
  });

  it('mock mode skips HTTP for probeConnection', async () => {
    process.env.HIKVISION_ISAPI_MOCK = '1';
    const adapter = new HikvisionIsapiAdapter({
      id: 'x',
      adapterKind: 'hikvision_isapi',
      config: null,
    });
    const r = await adapter.probeConnection();
    expect(r.ok).toBe(true);
    expect(r.deviceInfo?.mock).toBe(true);
  });
});
