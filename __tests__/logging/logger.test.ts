import { createLogger, redact, LogLevel } from '../../src/services/logging/logger';

type Write = { level: LogLevel; message: string; meta?: Record<string, unknown> };

describe('redact', () => {
  it('replaces sensitive keys recursively, keeps the rest', () => {
    expect(
      redact({
        boxId: 'b',
        password: 'x',
        nested: { Authorization: 'Basic z', label: 'L' },
        list: [{ token: 't' }, { ok: 1 }],
      }),
    ).toEqual({
      boxId: 'b',
      password: '***',
      nested: { Authorization: '***', label: 'L' },
      list: [{ token: '***' }, { ok: 1 }],
    });
  });

  it('passes primitives through unchanged', () => {
    expect(redact('hi')).toBe('hi');
    expect(redact(5)).toBe(5);
    expect(redact(null)).toBeNull();
  });

  it('redacts cookie / otp / code / pin', () => {
    expect(redact({ cookie: 'c', otpCode: 'o', code: '1', pin: '0000', notes: 'k' })).toEqual({
      cookie: '***',
      otpCode: '***',
      code: '***',
      pin: '***',
      notes: 'k',
    });
  });
});

describe('createLogger', () => {
  it('redacts meta before writing to the sink', () => {
    const writes: Write[] = [];
    const log = createLogger({
      write: (level, message, meta) => writes.push({ level, message, meta }),
    });
    log.info('login attempt', { boxId: 'b1', password: 'hunter2' });
    expect(writes).toEqual([
      { level: 'info', message: 'login attempt', meta: { boxId: 'b1', password: '***' } },
    ]);
  });

  it('handles calls without metadata', () => {
    const writes: Write[] = [];
    const log = createLogger({
      write: (level, message, meta) => writes.push({ level, message, meta }),
    });
    log.error('boom');
    expect(writes[0]).toEqual({ level: 'error', message: 'boom', meta: undefined });
  });
});
