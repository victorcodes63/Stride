import { describe, expect, it } from 'vitest';
import {
  parseEntityScope,
  parseEntitySlugFromRequest,
  entityScopedEmployeeWhere,
} from '@/lib/entity-request';

describe('entity request parsing', () => {
  it('reads entity slug from header first', () => {
    const request = {
      headers: { get: () => 'ug' },
      cookies: { get: () => undefined },
      nextUrl: new URL('https://example.com?entityId=ke'),
    };
    expect(parseEntitySlugFromRequest(request as never)).toBe('ug');
  });

  it('reads entity slug from cookie', () => {
    const request = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: 'ke' }) },
      nextUrl: new URL('https://example.com'),
    };
    expect(parseEntitySlugFromRequest(request as never)).toBe('ke');
  });

  it('normalizes invalid scopes to all', async () => {
    expect(await parseEntityScope('bad-value')).toBe('all');
    expect(await parseEntityScope('all')).toBe('all');
  });

  it('scopes employees by entity code slug', () => {
    expect(entityScopedEmployeeWhere('ke')).toEqual({ client: { entityCode: 'ke' } });
  });
});
