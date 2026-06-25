import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSiteMode,
  isAppPath,
  isMarketingPath,
} from './site-mode';

describe('site-mode (RAV-170)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects marketing deploy from SITE_MODE', () => {
    vi.stubEnv('SITE_MODE', 'marketing');
    expect(getSiteMode()).toBe('marketing');
  });

  it('detects app deploy from SITE_MODE', () => {
    vi.stubEnv('SITE_MODE', 'app');
    expect(getSiteMode()).toBe('app');
  });

  it('infers marketing from NEXT_PUBLIC_MARKETING_DOMAIN', () => {
    vi.stubEnv('NEXT_PUBLIC_MARKETING_DOMAIN', 'getstride.co.ke');
    expect(getSiteMode()).toBe('marketing');
  });

  it('classifies marketing and app paths', () => {
    expect(isMarketingPath('/')).toBe(true);
    expect(isMarketingPath('/platform')).toBe(true);
    expect(isMarketingPath('/industries/logistics')).toBe(true);
    expect(isAppPath('/dashboard/login')).toBe(true);
    expect(isAppPath('/ess/login')).toBe(true);
    expect(isAppPath('/api/marketing/demo-request')).toBe(false);
    expect(isAppPath('/api/health')).toBe(true);
  });
});
