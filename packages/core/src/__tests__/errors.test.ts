import { describe, it, expect } from 'vitest';
import {
  HRKitError,
  ParseError,
  ConnectionError,
  TimeoutError,
  DeviceNotFoundError,
} from '../errors.js';

describe('Error hierarchy', () => {
  it('HRKitError is an instance of Error', () => {
    const err = new HRKitError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HRKitError);
    expect(err.name).toBe('HRKitError');
    expect(err.message).toBe('test');
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
