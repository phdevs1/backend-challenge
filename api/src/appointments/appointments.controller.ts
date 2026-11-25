import type { Request, Response } from 'express';
import { z } from 'zod';
import { isoDateTime } from '../shared/schemas.js';
import { parseInput } from '../shared/validation.js';
import type { AppointmentsService } from './appointments.service.js';

const idParams = z.object({ id: z.string().min(1) });
const createAppointmentBody = z.object({
  clinicId: z.string().min(1),
  patientId: z.string().min(1),
  startsAt: isoDateTime,
});
const rescheduleBody = z.object({ startsAt: isoDateTime });

export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const input = parseInput(createAppointmentBody, req.body);
    res.status(201).json(await this.appointments.create(input));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseInput(idParams, req.params);
    res.json(await this.appointments.get(id));
  };

  reschedule = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseInput(idParams, req.params);
    const { startsAt } = parseInput(rescheduleBody, req.body);
    res.json(await this.appointments.reschedule(id, startsAt));
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseInput(idParams, req.params);
    res.json(await this.appointments.cancel(id));
  };
}
