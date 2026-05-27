import { Appointments, Prisma, User } from '@prisma/client';
import { DbClient } from '../../types/prisma.types';

export class AppointmentDb {
  constructor(private readonly prisma: DbClient) {}

  async findUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { userId } });
  }

  async findAppointmentById(
    appointmentId: string,
  ): Promise<Appointments | null> {
    return this.prisma.appointments.findFirst({
      where: { appointmentId, deleted: false },
    });
  }

  async findAppointmentsByPatientId(
    patientId: string,
    filters?: { status?: string },
  ): Promise<Appointments[]> {
    return this.prisma.appointments.findMany({
      where: {
        patientId,
        deleted: false,
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAppointment(
    data: Prisma.AppointmentsCreateInput,
  ): Promise<Appointments> {
    return this.prisma.appointments.create({ data });
  }

  async updateAppointment(
    appointmentId: string,
    data: Prisma.AppointmentsUpdateInput,
  ): Promise<Appointments> {
    return this.prisma.appointments.update({
      where: { appointmentId },
      data,
    });
  }
}
