import type { Request, Response } from 'express';

export class HealthController {
  constructor(private readonly isDatabaseUp: () => Promise<boolean>) {}

  check = async (_req: Request, res: Response): Promise<void> => {
    const database = (await this.isDatabaseUp()) ? 'up' : 'down';
    res.status(database === 'up' ? 200 : 503).json({ status: database, database });
  };
}
