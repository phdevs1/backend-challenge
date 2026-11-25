import { describe, expect, it } from 'vitest';
import { resultOfAttempt, skipReasonAtSendTime } from '../../src/reminders/delivery.js';

const now = new Date('2027-03-27T09:00:00Z');
const startsAt = new Date('2027-03-28T08:00:00Z');
const patient = { phone: '+34600111222', acceptsReminders: true };

describe('skipping a reminder at send time', () => {
  it('does not skip a normal reminder', () => {
    expect(skipReasonAtSendTime({ startsAt, now, ...patient })).toBeNull();
  });

  it('skips with too_late when the appointment already started', () => {
    expect(skipReasonAtSendTime({ startsAt, now: startsAt, ...patient })).toBe('too_late');
  });

  it('skips with no_phone when the patient has no phone', () => {
    expect(skipReasonAtSendTime({ startsAt, now, ...patient, phone: null })).toBe('no_phone');
  });

  it('skips with opted_out when the patient does not accept reminders', () => {
    expect(skipReasonAtSendTime({ startsAt, now, ...patient, acceptsReminders: false })).toBe(
      'opted_out',
    );
  });
});

describe('result of an attempt', () => {
  it('is sent, with the service time, when the provider delivered', () => {
    expect(resultOfAttempt('delivered', 1, now)).toEqual({ status: 'sent', sentAt: now });
  });

  it('retries 1 minute after the first failure', () => {
    expect(resultOfAttempt('retry', 1, now)).toEqual({
      status: 'pending',
      nextAttemptAt: new Date('2027-03-27T09:01:00Z'),
    });
  });

  it('retries 5 minutes after the second failure', () => {
    expect(resultOfAttempt('retry', 2, now)).toEqual({
      status: 'pending',
      nextAttemptAt: new Date('2027-03-27T09:05:00Z'),
    });
  });

  it('is failed when the third attempt fails too', () => {
    expect(resultOfAttempt('retry', 3, now)).toEqual({ status: 'failed' });
  });

  it('is failed without retries when the provider rejected it', () => {
    expect(resultOfAttempt('rejected', 1, now)).toEqual({ status: 'failed' });
  });
});
