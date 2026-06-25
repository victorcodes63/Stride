import { describe, expect, it } from 'vitest';

import { MARKETING_SITEMAP_STATIC_PATHS } from '@/lib/marketing-sitemap';

describe('marketing sitemap', () => {
  it('includes core marketing routes without legacy paths', () => {
    const paths = MARKETING_SITEMAP_STATIC_PATHS.map((entry) => entry.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/platform',
        '/industries',
        '/industries/logistics',
        '/industries/saccos',
        '/industries/healthcare',
        '/industries/energy',
        '/industries/construction',
        '/pricing',
        '/about',
        '/contact',
        '/privacy',
        '/terms',
      ]),
    );
    expect(paths).not.toContain('/careers');
    expect(paths).not.toContain('/services');
    expect(paths).not.toContain('/resources');
    expect(paths).not.toContain('/insights');
  });
});
