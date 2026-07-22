import { describe, expect, it } from 'vitest';
import { assessRecovery, classifyIntensity } from '../rule-engine.js';

describe('classifyIntensity', () => {
  it.each([
    [29.99, 'easy'],
    [30, 'moderate'],
    [79.99, 'moderate'],
    [80, 'hard'],
    [149.99, 'hard'],
    [150, 'very hard'],
  ] as const)('classifies TRIMP %s as %s', (trimp, expected) => {
    expect(classifyIntensity(trimp)).toBe(expected);
  });
});

describe('assessRecovery', () => {
  it('uses the shared well-recovered threshold inclusively', () => {
    expect(assessRecovery(95, 100)).toEqual({
      message: 'HRV is at or above your baseline — recovery looks strong.',
      belowBaseline: false,
    });
  });

  it('uses the shared poor-recovery threshold inclusively for moderate recovery', () => {
    expect(assessRecovery(80, 100)).toEqual({
      message: 'HRV is slightly below baseline — moderate sessions only today.',
      belowBaseline: true,
    });
  });

  it('flags values below the poor-recovery threshold', () => {
    expect(assessRecovery(79.99, 100)).toEqual({
      message: 'HRV is well below baseline — prioritise rest or very easy aerobic work.',
      belowBaseline: true,
    });
  });

  it('returns no signal without a valid baseline', () => {
    expect(assessRecovery(50, undefined)).toEqual({ message: '', belowBaseline: false });
    expect(assessRecovery(50, 0)).toEqual({ message: '', belowBaseline: false });
    expect(assessRecovery(50, Number.NaN)).toEqual({ message: '', belowBaseline: false });
  });
});
