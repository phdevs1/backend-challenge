import type { Request, Response } from 'express';
import { z } from 'zod';
import type { TestClock } from '../domain/clock.js';
import { isoDateTime } from './schemas.js';
import { parseInput } from './validation.js';

const setClockBody = z.object({ now: isoDateTime });

export class TestClockController {
  constructor(private readonly clock: TestClock) {}

  set = (req: Request, res: Response): void => {
    const { now } = parseInput(setClockBody, req.body);
    this.clock.set(now);
    res.status(204).end();
  };
}
