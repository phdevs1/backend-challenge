export interface Patient {
  id: string;
  clinicId: string;
  name: string;
  /** E.164 or null. Several patients may share a phone (a family). */
  phone: string | null;
  acceptsReminders: boolean;
}

/** Same rule the messaging provider applies: `+`, no leading zero, 8 to 15 digits. */
const E164 = /^\+[1-9]\d{7,14}$/;

export function isE164(phone: string): boolean {
  return E164.test(phone);
}
