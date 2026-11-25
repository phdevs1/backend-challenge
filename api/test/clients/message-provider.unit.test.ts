import { expect, it } from 'vitest';
import { outcomeFromStatus } from '../../src/clients/message-provider.js';

it.each([
  [202, 'delivered'],
  [200, 'delivered'],
  [503, 'retry'],
  [504, 'retry'],
  [422, 'rejected'],
])('provider status %i means %s', (status, outcome) => {
  expect(outcomeFromStatus(status)).toBe(outcome);
});
