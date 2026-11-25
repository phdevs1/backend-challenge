import type { Request, Response } from 'express';
import { z } from 'zod';
import { isE164 } from './patient.js';
import type { PatientsService } from './patients.service.js';
import { nonBlankString } from '../shared/schemas.js';
import { parseInput } from '../shared/validation.js';

const createPatientBody = z.object({
  clinicId: z.string().min(1),
  name: nonBlankString,
  phone: z.string().refine(isE164, 'must be an E.164 phone number').nullable().default(null),
  acceptsReminders: z.boolean(),
});

export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const input = parseInput(createPatientBody, req.body);
    res.status(201).json(await this.patients.create(input));
  };
}
