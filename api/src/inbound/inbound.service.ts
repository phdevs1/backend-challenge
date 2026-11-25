import type { Clock } from '../shared/clock.js';
import type { InboundRepository } from './inbound.repository.js';
import { parseReply } from './reply.js';

export interface InboundMessageInput {
  messageId: string;
  from: string;
  text: string;
}

export class InboundService {
  constructor(
    private readonly inbound: InboundRepository,
    private readonly clock: Clock,
  ) {}

  /** Never throws for a message we ignore: the provider would send it again. */
  handle({ messageId, from, text }: InboundMessageInput): Promise<void> {
    return this.inbound.apply({ messageId, from, reply: parseReply(text), now: this.clock.now() });
  }
}
