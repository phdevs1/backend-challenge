import type { Request, Response } from 'express';
import { z } from 'zod';
import { isoDateTime, nonBlankString } from '../shared/schemas.js';
import { parseInput } from '../shared/validation.js';
import type { InboundService } from './inbound.service.js';

const inboundMessageBody = z.object({
  messageId: nonBlankString,
  from: nonBlankString,
  text: z.string(),
  receivedAt: isoDateTime,
});

export class InboundController {
  constructor(private readonly inbound: InboundService) {}

  receive = async (req: Request, res: Response): Promise<void> => {
    const { messageId, from, text } = parseInput(inboundMessageBody, req.body);
    await this.inbound.handle({ messageId, from, text });
    res.status(200).end();
  };
}
