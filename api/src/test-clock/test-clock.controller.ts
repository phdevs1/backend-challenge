import type { Request, Response } from 'express';
import { z } from 'zod';
import type { TestClock } from '../shared/clock.js';
import { isoDateTime } from '../shared/schemas.js';
import { parseInput } from '../shared/validation.js';

const setClockBody = z.object({ now: isoDateTime });

export class TestClockController {
  constructor(private readonly clock: TestClock) {}

  set = (req: Request, res: Response): void => {
    const { now } = parseInput(setClockBody, req.body);
    this.clock.set(now);
    res.status(204).end();
  };
}
