import type { Request, Response } from 'express';
import { z } from 'zod';
import { isValidTimeZone } from './clinic.js';
import type { ClinicsService } from './clinics.service.js';
import { nonBlankString } from '../shared/schemas.js';
import { parseInput } from '../shared/validation.js';

const createClinicBody = z.object({
  name: nonBlankString,
  timezone: z.string().refine(isValidTimeZone, 'must be a valid IANA time zone'),
});

export class ClinicsController {
  constructor(private readonly clinics: ClinicsService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const input = parseInput(createClinicBody, req.body);
    res.status(201).json(await this.clinics.create(input));
  };
}
