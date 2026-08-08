export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
