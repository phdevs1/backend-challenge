/**
 * The only way the service reads the current time. Services receive a Clock instead of calling
 * `new Date()`, so tests can move time with `PUT /test/clock`.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/**
 * Clock fixed by `PUT /test/clock` (CLOCK_MODE=test). Time does not advance by itself once set, so
 * tests are deterministic. Until it is set it follows the real time.
 */
export class TestClock implements Clock {
  private fixed: Date | null = null;

  set(date: Date): void {
    this.fixed = new Date(date);
  }

  now(): Date {
    return this.fixed ? new Date(this.fixed) : new Date();
  }
}
