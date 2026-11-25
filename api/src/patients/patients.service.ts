import { NotFoundError } from '../shared/errors.js';
import type { Patient } from './patient.js';
import type { ClinicsRepository } from '../clinics/clinics.repository.js';
import type { PatientsRepository } from './patients.repository.js';

export type CreatePatientInput = Omit<Patient, 'id'>;

export class PatientsService {
  constructor(
    private readonly patients: PatientsRepository,
    private readonly clinics: ClinicsRepository,
  ) {}

  async create(input: CreatePatientInput): Promise<Patient> {
    const clinic = await this.clinics.findById(input.clinicId);
    if (!clinic) throw new NotFoundError('Clinic not found');
    return this.patients.create(input);
  }
}
