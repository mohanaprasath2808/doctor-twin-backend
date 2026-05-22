import prisma from '../client';

const userSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

export const findAllUsers = (): Promise<UserRecord[]> => {
  return prisma.dude.findMany({
    select: userSelect,
    orderBy: { id: 'desc' },
  });
};

export const findUserByEmail = (
  email: string,
): Promise<UserRecord | null> => {
  return prisma.dude.findUnique({
    where: { email },
    select: userSelect,
  });
};

export const createUser = (data: {
  name: string;
  email: string;
  password: string;
}): Promise<UserRecord> => {
  return prisma.dude.create({
    data,
    select: userSelect,
  });
};
