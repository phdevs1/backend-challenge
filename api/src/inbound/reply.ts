export type PatientReply = 'confirm' | 'cancel';

/**
 * Reads a patient's answer: SI confirms, NO cancels, anything else is ignored (`null`).
 * Case, accents and spaces or signs around the word do not matter ("Sí", " si. ", "NO!").
 */
export function parseReply(text: string): PatientReply | null {
  const word = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (word === 'si') return 'confirm';
  if (word === 'no') return 'cancel';
  return null;
}
