import type { Clinic } from './clinic.js';
import type { PrismaClient } from '../shared/db/prisma.js';

const clinicFields = { id: true, name: true, timezone: true } as const;

export class ClinicsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: Omit<Clinic, 'id'>): Promise<Clinic> {
    return this.prisma.clinic.create({ data, select: clinicFields });
  }

  findById(id: string): Promise<Clinic | null> {
    return this.prisma.clinic.findUnique({ where: { id }, select: clinicFields });
  }
}
