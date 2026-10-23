/**
 * An error that maps directly to an HTTP response. Throw it from services or
 * routes; the error-handling middleware turns it into JSON.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, message, details);
  }

  static notFound(resource: string, id: number | string): HttpError {
    return new HttpError(404, `${resource} ${id} not found`);
  }

  static unauthorized(message: string): HttpError {
    return new HttpError(401, message);
  }
}
