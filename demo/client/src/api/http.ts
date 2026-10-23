export interface FieldError {
  field: string;
  message: string;
}

/** Thrown for any failed API call; `status` is 0 when the server could not be reached. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(status: number, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...rest,
      headers: json === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is the API running (npm run dev)?');
  }

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, body);
  return body as T;
}

function toApiError(status: number, body: unknown): ApiError {
  const error =
    typeof body === 'object' && body !== null && 'error' in body
      ? (body as { error: { message?: string; details?: unknown } }).error
      : undefined;
  const fieldErrors = Array.isArray(error?.details) ? (error.details as FieldError[]) : [];
  return new ApiError(status, error?.message ?? `Request failed (${status})`, fieldErrors);
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
