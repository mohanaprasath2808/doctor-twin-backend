import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

export const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const hashPassword = async (plain: string): Promise<string> => {
  const salt = await bcrypt.genSalt();
  return bcrypt.hash(plain, salt);
};

export const verifyPassword = async (
  plain: string,
  hashed: string,
): Promise<boolean> => {
  if (!hashed) return false;
  try {
    return bcrypt.compare(plain, hashed);
  } catch {
    return false;
  }
};

export const hashPin = async (pin: string): Promise<string> => {
  const salt = await bcrypt.genSalt();
  return bcrypt.hash(pin, salt);
};

export const verifyPin = async (pin: string, hashed: string): Promise<boolean> => {
  try {
    return bcrypt.compare(pin, hashed);
  } catch {
    return false;
  }
};

export const generateApiKey = (): string =>
  `dtai_${randomBytes(24).toString('base64url')}`;

export const generatePatientToken = (): string =>
  `pt_${randomBytes(24).toString('base64url')}`;
