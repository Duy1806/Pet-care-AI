/**
 * PawCare AI — UUID Generator
 *
 * Uses expo-crypto with universal fallback for Node.js / Jest environments.
 */
import * as Crypto from 'expo-crypto';

export function generateUUID(): string {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      const id = Crypto.randomUUID();
      if (id) return id;
    }
  } catch {
    // fallback
  }

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

