export class AppointmentFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentFlowError';
  }
}
