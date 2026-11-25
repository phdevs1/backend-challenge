import type { Clinic } from './clinic.js';
import type { ClinicsRepository } from './clinics.repository.js';

export type CreateClinicInput = Omit<Clinic, 'id'>;

export class ClinicsService {
  constructor(private readonly clinics: ClinicsRepository) {}

  create(input: CreateClinicInput): Promise<Clinic> {
    return this.clinics.create(input);
  }
}
