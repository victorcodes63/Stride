import { describe, expect, it } from 'vitest';

import { scoreAccent, scoreTone, toneAccent } from './score-tone';

describe('scoreTone', () => {
  it('maps score bands to semantic tones', () => {
    expect(scoreTone(null)).toBe('neutral');
    expect(scoreTone(undefined)).toBe('neutral');
    expect(scoreTone(1)).toBe('danger');
    expect(scoreTone(1.4)).toBe('danger');
    expect(scoreTone(1.5)).toBe('warning');
    expect(scoreTone(2.4)).toBe('warning');
    expect(scoreTone(2.5)).toBe('primary');
    expect(scoreTone(3.4)).toBe('primary');
    expect(scoreTone(3.5)).toBe('info');
    expect(scoreTone(4.4)).toBe('info');
    expect(scoreTone(4.5)).toBe('success');
    expect(scoreTone(5)).toBe('success');
  });
});

describe('toneAccent / scoreAccent', () => {
  it('returns a CSS var for every tone', () => {
    for (const tone of ['success', 'info', 'primary', 'warning', 'danger', 'neutral'] as const) {
      expect(toneAccent(tone)).toMatch(/var\(--/);
    }
  });

  it('scoreAccent resolves via the score band', () => {
    expect(scoreAccent(5)).toBe(toneAccent('success'));
    expect(scoreAccent(1)).toBe(toneAccent('danger'));
    expect(scoreAccent(null)).toBe(toneAccent('neutral'));
  });
});
