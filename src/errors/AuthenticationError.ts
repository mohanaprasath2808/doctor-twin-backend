export class AuthenticationError extends Error {
  public readonly extraData: Record<string, unknown>;

  constructor(message: string, extraData: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AuthenticationError';
    this.extraData = extraData;
  }
}
