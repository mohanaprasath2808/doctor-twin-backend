import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const getEnvInt = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for ${key}: ${raw}`);
  }
  return parsed;
};

export const env = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: Number(getEnv('PORT', '3000')),
  logLevel: getEnv('LOG_LEVEL', 'info'),
  isProduction: getEnv('NODE_ENV', 'development') === 'production',
  databaseUrl: getEnv('DATABASE_URL'),

  jwtSecret: getEnv('JWT_SECRET', 'change-me-in-production'),
  accessTokenTtlMinutes: getEnvInt('ACCESS_TOKEN_TTL_MINUTES', 30),
  refreshTokenTtlDays: getEnvInt('REFRESH_TOKEN_TTL_DAYS', 7),
  stepUpTokenTtlMinutes: getEnvInt('STEP_UP_TOKEN_TTL_MINUTES', 15),
  lockoutMinutes: getEnvInt('LOCKOUT_MINUTES', 30),
  mfaIssuer: getEnv('MFA_ISSUER', 'DoctorTwin'),
  patientOtpTtlMinutes: getEnvInt('PATIENT_OTP_TTL_MINUTES', 10),
  patientTokenTtlHours: getEnvInt('PATIENT_TOKEN_TTL_HOURS', 24),
  integrationMode: getEnv('INTEGRATION_MODE', 'stub') as 'stub' | 'live',
} as const;
