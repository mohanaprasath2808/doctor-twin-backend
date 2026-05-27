import './types/express';
import { createApp } from './app';
import prisma from './client';
import { env } from './config/env';
import { logger } from './utils/logger';

const start = async (): Promise<void> => {
  await prisma.$connect();
  logger.info('Database connected');

  const app = createApp();

  const server = app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

start().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`Failed to start server: ${message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});
