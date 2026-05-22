import { PrismaClient } from '@prisma/client';

/** Client passed to interactive `prisma.$transaction` callbacks. */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Use for services/DB helpers that run inside or outside a transaction. */
export type DbClient = PrismaClient | PrismaTransactionClient;
