import type { Patient } from './patient.js';
import type { PrismaClient } from '../shared/db/prisma.js';

const patientFields = {
  id: true,
  clinicId: true,
  name: true,
  phone: true,
  acceptsReminders: true,
} as const;

export class PatientsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: Omit<Patient, 'id'>): Promise<Patient> {
    return this.prisma.patient.create({ data, select: patientFields });
  }

  findById(id: string): Promise<Patient | null> {
    return this.prisma.patient.findUnique({ where: { id }, select: patientFields });
  }
}
