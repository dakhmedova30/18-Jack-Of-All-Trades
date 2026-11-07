import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './http';

const UNREACHABLE = 'Could not reach the server. Check your connection and try again.';

function respond(status: number, body: string, contentType = 'application/json') {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(new Response(body, { status, headers: { 'Content-Type': contentType } })),
  );
}

async function errorFrom(request: Promise<unknown>): Promise<ApiError> {
  try {
    await request;
  } catch (error) {
    if (error instanceof ApiError) return error;
  }
  throw new Error('Expected an ApiError');
}

describe('apiRequest errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a network failure as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await errorFrom(apiRequest('/health'));
    expect(error.status).toBe(0);
    expect(error.message).toBe(UNREACHABLE);
  });

  it("treats a 5xx without the API's error body as unreachable (a proxy answered)", async () => {
    respond(502, '<html>Bad Gateway</html>', 'text/html');

    const error = await errorFrom(apiRequest('/health'));
    expect(error.status).toBe(0);
    expect(error.message).toBe(UNREACHABLE);
  });

  it("keeps the API's own error message and field errors", async () => {
    respond(
      400,
      JSON.stringify({
        error: {
          message: 'Validation failed',
          details: [{ field: 'email', message: 'Enter a valid email' }],
        },
      }),
    );

    const error = await errorFrom(apiRequest('/auth/register'));
    expect(error.status).toBe(400);
    expect(error.message).toBe('Validation failed');
    expect(error.fieldErrors).toEqual([{ field: 'email', message: 'Enter a valid email' }]);
  });

  it('keeps a 5xx that the API itself sent', async () => {
    respond(503, JSON.stringify({ error: { message: 'Database unavailable' } }));

    const error = await errorFrom(apiRequest('/items'));
    expect(error.status).toBe(503);
    expect(error.message).toBe('Database unavailable');
  });
});
