import crypto from 'node:crypto';

export function generateSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

