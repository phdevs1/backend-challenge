import type { Request, Response } from 'express';
import type { RemindersService } from './reminders.service.js';

export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  run = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.reminders.runDue());
  };
}
