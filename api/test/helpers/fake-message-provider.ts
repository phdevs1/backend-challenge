import { setTimeout as sleep } from 'node:timers/promises';
import type { MessageProvider, OutgoingMessage } from '../../src/clients/message-provider.js';
import type { SendOutcome } from '../../src/reminders/delivery.js';

/** How the next call behaves, like the `/admin/rules` modes of the real provider. */
export type FakeBehaviour = 'unavailable' | 'lost-response' | 'reject';

/**
 * Stand-in for the messaging provider. Like the real one it never delivers the same
 * Idempotency-Key twice, and it can fail the next calls in the ways the real one does.
 */
export class FakeMessageProvider implements MessageProvider {
  /** Every call received, in order. */
  readonly calls: OutgoingMessage[] = [];
  /** Messages that reached the patient (one per Idempotency-Key). */
  readonly delivered: OutgoingMessage[] = [];
  private readonly behaviours: FakeBehaviour[] = [];

  /** Makes the next calls fail in this way (one entry per call). */
  failNext(...behaviours: FakeBehaviour[]): void {
    this.behaviours.push(...behaviours);
  }

  async send(message: OutgoingMessage): Promise<SendOutcome> {
    this.calls.push(message);
    await sleep(20); // gives concurrent passes room to overlap

    const behaviour = this.behaviours.shift();
    if (behaviour === 'unavailable') return 'retry';
    if (behaviour === 'reject') return 'rejected';

    if (!this.delivered.some((m) => m.idempotencyKey === message.idempotencyKey)) {
      this.delivered.push(message);
    }
    return behaviour === 'lost-response' ? 'retry' : 'delivered';
  }
}
