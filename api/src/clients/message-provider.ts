import type { SendOutcome } from '../reminders/delivery.js';

export interface OutgoingMessage {
  to: string;
  text: string;
  /** Same key on every attempt of a reminder: the provider does not send it twice. */
  idempotencyKey: string;
}

/** The only door to the messaging provider; tests replace it with a fake. */
export interface MessageProvider {
  send(message: OutgoingMessage): Promise<SendOutcome>;
}

const TIMEOUT_MS = 5000;

/** Provider status → what to do. Anything unexpected is retried: the idempotency key makes it safe. */
export function outcomeFromStatus(status: number): SendOutcome {
  if (status === 200 || status === 202) return 'delivered';
  if (status >= 400 && status < 500) return 'rejected';
  return 'retry';
}

export class HttpMessageProvider implements MessageProvider {
  constructor(private readonly baseUrl: string) {}

  async send({ to, text, idempotencyKey }: OutgoingMessage): Promise<SendOutcome> {
    try {
      const response = await fetch(new URL('/messages', this.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
        body: JSON.stringify({ to, text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return outcomeFromStatus(response.status);
    } catch {
      // Network error or no answer within 5 s: the message may have been delivered.
      return 'retry';
    }
  }
}
