import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiFetch,
  isRatePaused,
  notifyRateLimited,
  pollInterval,
  resetRateLimitLatch,
  toApiError,
} from '../api-client';

function jsonResponse({
  status,
  body,
  headers,
}: {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('api-client', () => {
  beforeEach(() => {
    resetRateLimitLatch();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('pollInterval passes through when not paused and latches on 429', () => {
    expect(pollInterval(5000)).toBe(5000);

    notifyRateLimited(10);
    expect(isRatePaused()).toBe(true);
    expect(pollInterval(5000)).toBe(false);

    vi.advanceTimersByTime(10_100);
    expect(isRatePaused()).toBe(false);
    expect(pollInterval(5000)).toBe(5000);
  });

  it('clamps retry-after to [5s, 120s]', () => {
    notifyRateLimited(1);
    vi.advanceTimersByTime(4000);
    expect(isRatePaused()).toBe(true); // min 5s
    vi.advanceTimersByTime(1100);
    expect(isRatePaused()).toBe(false);

    notifyRateLimited(9999);
    vi.advanceTimersByTime(119_000);
    expect(isRatePaused()).toBe(true); // max 120s
    vi.advanceTimersByTime(1100);
    expect(isRatePaused()).toBe(false);
  });

  it('throws ApiError with body fields on non-ok responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          status: 402,
          body: { error: 'Trial required', code: 'trial_required', trialAvailable: true },
        }),
      ),
    );

    const err = await apiFetch('/api/accounts').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(402);
    expect(apiErr.code).toBe('trial_required');
    expect(apiErr.message).toBe('Trial required');
    expect(apiErr.trialAvailable).toBe(true);
    expect(isRatePaused()).toBe(false); // only 429 latches
  });

  it('latches the pause and reads Retry-After on 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          status: 429,
          body: { error: 'Too many requests' },
          headers: { 'Retry-After': '30' },
        }),
      ),
    );

    const err = await apiFetch('/api/conversations').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).retryAfter).toBe(30);
    expect(isRatePaused()).toBe(true);
    vi.advanceTimersByTime(30_100);
    expect(isRatePaused()).toBe(false);
  });

  it('tolerates non-JSON error bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response('<html>bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
      ),
    );

    const err = await apiFetch('/api/accounts').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).message).toBe('Bad Gateway');
  });

  it('toApiError normalizes unknown errors and passes ApiError through', () => {
    expect(toApiError(null)).toBeNull();
    const apiErr = new ApiError({ message: 'x', status: 404 });
    expect(toApiError(apiErr)).toBe(apiErr);
    const wrapped = toApiError(new TypeError('Failed to fetch'));
    expect(wrapped).toBeInstanceOf(ApiError);
    expect(wrapped?.status).toBe(0);
    expect(wrapped?.message).toBe('Failed to fetch');
  });
});
