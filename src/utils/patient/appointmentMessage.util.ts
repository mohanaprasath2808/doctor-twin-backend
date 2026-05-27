import { UserMetadata } from '../../types/identity.types';

export const getPatientDisplayName = (
  metadata: UserMetadata | null | undefined,
): string => {
  if (!metadata) return 'there';
  if (metadata.first_name?.trim()) return metadata.first_name.trim();
  if (metadata.name?.trim()) {
    return metadata.name.trim().split(/\s+/)[0] ?? 'there';
  }
  return 'there';
};

export const formatAppointmentScheduledMessage = (
  displayName: string,
  appointmentDate: Date,
  timeSlot: string,
): { title: string; message: string } => {
  const weekday = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  const monthDay = appointmentDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return {
    title: 'Appointment Scheduled!',
    message: `You're all set, ${displayName}. See you on ${weekday}, ${monthDay} at ${timeSlot}.`,
  };
};
