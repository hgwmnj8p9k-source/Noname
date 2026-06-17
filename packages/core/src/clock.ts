/**
 * Clock abstraction. Production uses {@link SystemClock}; tests and backtests
 * use {@link ManualClock} so the entire engine can run deterministically.
 */
export interface Clock {
  now(): number;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

export class ManualClock implements Clock {
  constructor(private current: number = 0) {}

  now(): number {
    return this.current;
  }

  set(ms: number): void {
    this.current = ms;
  }

  advance(ms: number): number {
    this.current += ms;
    return this.current;
  }
}
