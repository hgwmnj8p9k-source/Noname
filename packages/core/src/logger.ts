export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  child(scope: string): Logger;
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/** Minimal structured logger. Swap for pino/winston at the app boundary. */
export class ConsoleLogger implements Logger {
  constructor(
    private readonly scope = 'app',
    private readonly minLevel: LogLevel = 'info',
  ) {}

  child(scope: string): Logger {
    return new ConsoleLogger(`${this.scope}:${scope}`, this.minLevel);
  }

  private log(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const line = {
      t: new Date().toISOString(),
      level,
      scope: this.scope,
      msg,
      ...(meta ? { meta } : {}),
    };
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    sink(JSON.stringify(line));
  }

  debug(msg: string, meta?: Record<string, unknown>): void {
    this.log('debug', msg, meta);
  }
  info(msg: string, meta?: Record<string, unknown>): void {
    this.log('info', msg, meta);
  }
  warn(msg: string, meta?: Record<string, unknown>): void {
    this.log('warn', msg, meta);
  }
  error(msg: string, meta?: Record<string, unknown>): void {
    this.log('error', msg, meta);
  }
}

export const noopLogger: Logger = {
  child: () => noopLogger,
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
