import { describe, expect, it } from 'vitest';
import {
  ConnectionError,
  DeviceNotFoundError,
  HRKitError,
  ParseError,
  TimeoutError,
  ValidationError,
} from '../errors.js';

describe('Error hierarchy', () => {
  it('HRKitError is an instance of Error', () => {
    const err = new HRKitError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HRKitError);
    expect(err.name).toBe('HRKitError');
    expect(err.message).toBe('test');
  });

  it('HRKitError supports optional code', () => {
    const withCode = new HRKitError('test', 'CUSTOM_CODE');
    expect(withCode.code).toBe('CUSTOM_CODE');

    const withoutCode = new HRKitError('test');
    expect(withoutCode.code).toBeUndefined();
  });

  it('ParseError extends HRKitError', () => {
    const err = new ParseError('bad data');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HRKitError);
    expect(err).toBeInstanceOf(ParseError);
    expect(err.name).toBe('ParseError');
    expect(err.message).toBe('bad data');
  });

  it('ConnectionError extends HRKitError', () => {
    const err = new ConnectionError('lost');
    expect(err).toBeInstanceOf(HRKitError);
    expect(err.name).toBe('ConnectionError');
  });

  it('TimeoutError extends HRKitError', () => {
    const err = new TimeoutError('scan timeout');
    expect(err).toBeInstanceOf(HRKitError);
    expect(err.name).toBe('TimeoutError');
  });

  it('DeviceNotFoundError extends HRKitError', () => {
    const err = new DeviceNotFoundError('no device');
    expect(err).toBeInstanceOf(HRKitError);
    expect(err.name).toBe('DeviceNotFoundError');
  });

  it('errors can be caught by parent type', () => {
    const throwParse = () => {
      throw new ParseError('parse fail');
    };
    const throwTimeout = () => {
      throw new TimeoutError('timed out');
    };

    expect(throwParse).toThrow(HRKitError);
    expect(throwTimeout).toThrow(HRKitError);
  });

  it('errors have proper stack traces', () => {
    const err = new ParseError('stack test');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('ParseError');
  });
});

describe('Error codes', () => {
  it('ParseError has default code PARSE_ERROR', () => {
    const err = new ParseError('bad data');
    expect(err.code).toBe('PARSE_ERROR');
  });

  it('ConnectionError has default code CONNECTION_ERROR', () => {
    const err = new ConnectionError('lost');
    expect(err.code).toBe('CONNECTION_ERROR');
  });

  it('TimeoutError has default code TIMEOUT_ERROR', () => {
    const err = new TimeoutError('scan timeout');
    expect(err.code).toBe('TIMEOUT_ERROR');
  });

  it('DeviceNotFoundError has default code DEVICE_NOT_FOUND', () => {
    const err = new DeviceNotFoundError('no device');
    expect(err.code).toBe('DEVICE_NOT_FOUND');
  });

  it('subclass constructors still work with just a message', () => {
    const err = new ParseError('msg');
    expect(err.message).toBe('msg');
    expect(err.code).toBe('PARSE_ERROR');
  });
});

describe('ValidationError', () => {
  it('extends HRKitError', () => {
    const err = new ValidationError('validation failed');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HRKitError);
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('has name ValidationError', () => {
    const err = new ValidationError('fail');
    expect(err.name).toBe('ValidationError');
  });

  it('has code VALIDATION_ERROR', () => {
    const err = new ValidationError('fail');
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('stores errors and warnings arrays', () => {
    const err = new ValidationError(
      'invalid config',
      ['maxHR must be positive', 'restHR must be non-negative'],
      ['zones look unusual'],
    );
    expect(err.errors).toEqual(['maxHR must be positive', 'restHR must be non-negative']);
    expect(err.warnings).toEqual(['zones look unusual']);
  });

  it('defaults to empty errors and warnings', () => {
    const err = new ValidationError('empty');
    expect(err.errors).toEqual([]);
    expect(err.warnings).toEqual([]);
  });

  it('can be caught as HRKitError', () => {
    const throwValidation = () => {
      throw new ValidationError('fail');
    };
    expect(throwValidation).toThrow(HRKitError);
  });
});

import { AuthError, formatError, isRetryable, RateLimitError, RequestError, ServerError } from '../errors.js';

describe('HTTP error subclasses', () => {
  it('all are instanceof RequestError / HRKitError', () => {
    expect(new AuthError('x')).toBeInstanceOf(RequestError);
    expect(new RateLimitError('x')).toBeInstanceOf(RequestError);
    expect(new ServerError('x')).toBeInstanceOf(RequestError);
    expect(new RequestError('x')).toBeInstanceOf(HRKitError);
  });

  it('RateLimitError carries retryAfterSeconds + status', () => {
    const err = new RateLimitError('slow', { status: 429, retryAfterSeconds: 30 });
    expect(err.retryAfterSeconds).toBe(30);
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
  });

  it('RequestError surfaces requestId & responseBody', () => {
    const err = new RequestError('bad', { status: 400, requestId: 'req-1', responseBody: '{}' });
    expect(err.requestId).toBe('req-1');
    expect(err.responseBody).toBe('{}');
  });
});

describe('isRetryable', () => {
  it('retries 429/5xx/timeout', () => {
    expect(isRetryable(new RateLimitError('x'))).toBe(true);
    expect(isRetryable(new ServerError('x'))).toBe(true);
    expect(isRetryable(new TimeoutError('x'))).toBe(true);
  });
  it('skips auth/validation', () => {
    expect(isRetryable(new AuthError('x'))).toBe(false);
    expect(isRetryable(new ValidationError('x'))).toBe(false);
  });
  it('retries 408/425, not other 4xx', () => {
    expect(isRetryable(new RequestError('x', { status: 408 }))).toBe(true);
    expect(isRetryable(new RequestError('x', { status: 425 }))).toBe(true);
    expect(isRetryable(new RequestError('x', { status: 400 }))).toBe(false);
  });
  it('treats unknown errors as transient', () => {
    expect(isRetryable(new Error('ECONNRESET'))).toBe(true);
  });
});

describe('formatError', () => {
  it('formats HRKit errors with code/status/requestId', () => {
    const out = formatError(new RateLimitError('slow', { status: 429, requestId: 'r1' }));
    expect(out).toContain('RateLimitError: slow');
    expect(out).toContain('code=RATE_LIMITED');
    expect(out).toContain('status=429');
    expect(out).toContain('requestId=r1');
  });
  it('handles plain Errors and primitives', () => {
    expect(formatError(new Error('boom'))).toBe('Error: boom');
    expect(formatError('s')).toBe('s');
    expect(formatError(42)).toBe('42');
  });
});
