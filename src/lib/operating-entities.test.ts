import { describe, expect, it } from 'vitest';
import {
  buildDefaultOperatingEntitiesSettings,
  filterEntitiesForEntitySwitcher,
  resolveEntitySlugOrDefault,
  sanitizeOperatingEntitiesSettings,
  shouldShowEntitySwitcher,
  validateEntitySlug,
  validateOperatingEntitiesPatch,
} from '@/lib/operating-entities';

describe('operating entities settings', () => {
  it('builds single-entity defaults from env shape', () => {
    const settings = buildDefaultOperatingEntitiesSettings('Acme Ltd');
    expect(settings.entities).toHaveLength(1);
    expect(settings.defaultEntityId).toBe(settings.entities[0]!.id);
    expect(settings.multiEntityEnabled).toBe(false);
  });

  it('sanitizes multi-entity patch with unique slugs', () => {
    const settings = sanitizeOperatingEntitiesSettings({
      multiEntityEnabled: true,
      defaultEntityId: 'ke',
      entities: [
        {
          id: 'ke',
          legalName: 'Kenya Co',
          countryCode: 'KE',
          currency: 'KES',
          employeeNumberPrefix: 'KE',
          isActive: true,
        },
        {
          id: 'ug',
          legalName: 'Uganda Co',
          countryCode: 'UG',
          currency: 'UGX',
          employeeNumberPrefix: 'UG',
          isActive: true,
        },
      ],
    });
    expect(settings.entities).toHaveLength(2);
    expect(settings.defaultEntityId).toBe('ke');
  });

  it('validates cookie slug against active entities', () => {
    const settings = sanitizeOperatingEntitiesSettings({
      defaultEntityId: 'ke',
      entities: [
        {
          id: 'ke',
          legalName: 'Kenya',
          countryCode: 'KE',
          currency: 'KES',
          employeeNumberPrefix: 'KE',
          isActive: true,
        },
        {
          id: 'ug',
          legalName: 'Uganda',
          countryCode: 'UG',
          currency: 'UGX',
          employeeNumberPrefix: 'UG',
          isActive: false,
        },
      ],
    });
    expect(validateEntitySlug('ke', settings)).toBe('ke');
    expect(validateEntitySlug('ug', settings)).toBeNull();
    expect(resolveEntitySlugOrDefault('bad', settings)).toBe('ke');
    expect(resolveEntitySlugOrDefault('ke', settings)).toBe('ke');
  });

  it('requires at least one active entity', () => {
    const errors = validateOperatingEntitiesPatch(
      sanitizeOperatingEntitiesSettings({
        defaultEntityId: 'ke',
        entities: [
          {
            id: 'ke',
            legalName: 'Kenya',
            countryCode: 'KE',
            currency: 'KES',
            employeeNumberPrefix: 'KE',
            isActive: false,
          },
        ],
      }),
    );
    expect(errors.some((e) => e.field === 'entities')).toBe(true);
  });

  it('hides switcher when only one active entity', () => {
    const settings = sanitizeOperatingEntitiesSettings({
      multiEntityEnabled: true,
      defaultEntityId: 'ke',
      entities: [
        {
          id: 'ke',
          legalName: 'Kenya',
          countryCode: 'KE',
          currency: 'KES',
          employeeNumberPrefix: 'KE',
          isActive: true,
        },
      ],
    });
    expect(shouldShowEntitySwitcher(settings)).toBe(false);
  });

  it('filters multi-vertical switcher to one Kenya entity per sector', () => {
    const prev = process.env.DEMO_MULTI_CONTEXT;
    process.env.DEMO_MULTI_CONTEXT = 'true';
    try {
      const entities = [
        {
          id: 'imara-sacco__ke',
          legalName: 'Heritage Members SACCO Ltd',
          countryCode: 'KE' as const,
          currency: 'KES',
          employeeNumberPrefix: 'HMS',
          isActive: true,
        },
        {
          id: 'imara-sacco__ug',
          legalName: 'Heritage Members SACCO Ltd — Regional Office',
          countryCode: 'UG' as const,
          currency: 'UGX',
          employeeNumberPrefix: 'HMS-UG',
          isActive: true,
        },
        {
          id: 'hospital-healthcare__ke',
          legalName: 'Amani Medical Centre',
          countryCode: 'KE' as const,
          currency: 'KES',
          employeeNumberPrefix: 'AMC',
          isActive: true,
        },
      ];
      const filtered = filterEntitiesForEntitySwitcher(entities);
      expect(filtered.map((e) => e.id)).toEqual(['imara-sacco__ke', 'hospital-healthcare__ke']);
    } finally {
      if (prev === undefined) delete process.env.DEMO_MULTI_CONTEXT;
      else process.env.DEMO_MULTI_CONTEXT = prev;
    }
  });
});
