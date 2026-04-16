import { describe, it, expect } from 'vitest';
import {
  HRKitError,
  ParseError,
  ConnectionError,
  TimeoutError,
  DeviceNotFoundError,
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
    const throwParse = () => { throw new ParseError('parse fail'); };
    const throwTimeout = () => { throw new TimeoutError('timed out'); };

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
    const throwValidation = () => { throw new ValidationError('fail'); };
    expect(throwValidation).toThrow(HRKitError);
  });
});
