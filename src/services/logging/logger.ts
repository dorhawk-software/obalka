// Structured logging that redacts secrets (feature 001, constitution Principle III).
// Pure + injectable sink so it is unit-testable and never leaks passwords/cookies/codes to logs.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFn = (message: string, meta?: Record<string, unknown>) => void;

export interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

export interface LogSink {
  write(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
}

// Keys whose values must never be logged in clear (matched case-insensitively, anywhere in the key).
const SENSITIVE_KEY = /(password|passwd|pwd|authorization|cookie|secret|token|otp|^code$|^pin$)/i;
const REDACTED = '***';

/** Recursively replace the values of sensitive keys with `***`; leaves everything else intact. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(v);
    }
    return out;
  }
  return value;
}

/** Build a logger that redacts metadata before handing it to the sink. */
export function createLogger(sink: LogSink): Logger {
  const at =
    (level: LogLevel): LogFn =>
    (message, meta) => {
      sink.write(level, message, meta ? (redact(meta) as Record<string, unknown>) : undefined);
    };
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}

/** Default sink → the platform console. */
export const consoleSink: LogSink = {
  write(level, message, meta) {
    const fn = level === 'debug' ? 'log' : level;
    (console[fn] as (...args: unknown[]) => void)(message, meta ?? '');
  },
};
