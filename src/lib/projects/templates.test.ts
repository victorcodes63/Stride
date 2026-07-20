import { describe, expect, it } from 'vitest';
import { countBlueprintTasks, expandTemplateBlueprint } from '@/lib/projects/templates';

describe('expandTemplateBlueprint', () => {
  it('returns empty structure for non-object input', () => {
    expect(expandTemplateBlueprint(null)).toEqual({ milestones: [], tasks: [] });
    expect(expandTemplateBlueprint('nope')).toEqual({ milestones: [], tasks: [] });
  });

  it('expands milestones with tasks', () => {
    const result = expandTemplateBlueprint({
      milestones: [
        {
          title: '  Discovery  ',
          description: 'Kickoff',
          tasks: [
            { title: 'Interview stakeholders', priority: 'high', estimateHours: 4 },
            { title: 'Draft brief' },
          ],
        },
      ],
    });

    expect(result.milestones).toHaveLength(1);
    expect(result.milestones[0].title).toBe('Discovery');
    expect(result.milestones[0].tasks).toHaveLength(2);
    expect(result.milestones[0].tasks[0]).toEqual({
      title: 'Interview stakeholders',
      description: null,
      priority: 'high',
      estimateHours: 4,
    });
    // Missing priority defaults to medium; missing estimate -> null.
    expect(result.milestones[0].tasks[1].priority).toBe('medium');
    expect(result.milestones[0].tasks[1].estimateHours).toBeNull();
  });

  it('drops invalid entries', () => {
    const result = expandTemplateBlueprint({
      milestones: [
        { title: '', tasks: [{ title: 'x' }] }, // no milestone title -> dropped
        { title: 'Valid', tasks: [{ title: '' }, { notTitle: 1 }, { title: 'Keep' }] },
      ],
      tasks: ['bad', { title: 'Loose task', priority: 'weird', estimateHours: -3 }],
    });

    expect(result.milestones).toHaveLength(1);
    expect(result.milestones[0].tasks.map((t) => t.title)).toEqual(['Keep']);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].priority).toBe('medium'); // invalid priority normalized
    expect(result.tasks[0].estimateHours).toBeNull(); // negative estimate dropped
  });

  it('counts total tasks across milestones and loose tasks', () => {
    const expanded = expandTemplateBlueprint({
      milestones: [
        { title: 'M1', tasks: [{ title: 't1' }, { title: 't2' }] },
        { title: 'M2', tasks: [{ title: 't3' }] },
      ],
      tasks: [{ title: 'loose' }],
    });
    expect(countBlueprintTasks(expanded)).toBe(4);
  });
});
