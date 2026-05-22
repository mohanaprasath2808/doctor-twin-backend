import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: Number(getEnv('PORT', '3000')),
  logLevel: getEnv('LOG_LEVEL', 'info'),
  isProduction: getEnv('NODE_ENV', 'development') === 'production',
  databaseUrl: getEnv(
    'DATABASE_URL',
    'mysql://root:root@localhost:3306/doctor_twin',
  ),
} as const;
