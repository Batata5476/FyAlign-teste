import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/**
 * Gera uma senha temporária criptograficamente segura e legível (sem caracteres ambíguos como 0/O ou 1/l/I),
 * garantindo presença de letra maiúscula, minúscula, número e símbolo especial.
 */
export function generateTemporaryPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*!';
  const all = upper + lower + digits;

  const chars: string[] = [
    upper[crypto.randomInt(0, upper.length)],
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    digits[crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)],
  ];

  while (chars.length < length) {
    chars.push(all[crypto.randomInt(0, all.length)]);
  }

  // Embaralhamento Fisher-Yates com CSPRNG
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join('');
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('A nova senha deve possuir no mínimo 8 caracteres.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('A nova senha deve conter pelo menos uma letra maiúscula.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('A nova senha deve conter pelo menos uma letra minúscula.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('A nova senha deve conter pelo menos um número.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
