/**
 * Bootstrap an admin user (mirrors doctor-twin-ai/scripts/create_admin.py).
 *
 * Usage: npx ts-node scripts/create-admin.ts admin@example.com 'SecurePass123!'
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash.util';

const main = async (): Promise<void> => {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error(
      'Usage: npx ts-node scripts/create-admin.ts <email> <password>',
    );
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Password must be at least 12 characters');
    process.exit(1);
  }

  const db = new PrismaClient();
  try {
    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      console.error(`User already exists: ${email}`);
      process.exit(1);
    }
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: 'admin',
      },
    });
    console.log(`Admin created: ${user.userId} (${user.email})`);
  } finally {
    await db.$disconnect();
  }
};

void main();
