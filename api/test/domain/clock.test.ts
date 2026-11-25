import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestClock } from '../../src/domain/clock.js';

describe('TestClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('follows the real time until it is set', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T12:00:00Z'));
    expect(new TestClock().now()).toEqual(new Date('2027-01-01T12:00:00Z'));
  });

  it('returns the fixed time once set, and it does not advance', () => {
    const clock = new TestClock();
    clock.set(new Date('2027-03-27T09:00:00Z'));
    expect(clock.now()).toEqual(new Date('2027-03-27T09:00:00Z'));
    expect(clock.now()).toEqual(new Date('2027-03-27T09:00:00Z'));
  });

  it('cannot be changed by mutating a returned date', () => {
    const clock = new TestClock();
    clock.set(new Date('2027-03-27T09:00:00Z'));
    clock.now().setUTCFullYear(2000);
    expect(clock.now()).toEqual(new Date('2027-03-27T09:00:00Z'));
  });
});
