import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchange } from './bank.js';

afterEach(() => vi.unstubAllGlobals());

describe('one-use bank link completion', () => {
  it('retries once so a staged server connection can finish enrichment', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++;
      if (calls === 1) return new Response(JSON.stringify({ error: { message: 'accounts temporarily unavailable' } }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
      return Response.json({
        id: 'connection', provider: 'plaid', environment: 'production', institution: 'Bank',
        accounts: [], status: 'ok', createdAt: '2026-08-30T00:00:00.000Z',
      });
    }));

    await expect(exchange({ public_token: 'one-use-token', institution: 'Bank' }))
      .resolves.toMatchObject({ id: 'connection', status: 'ok' });
    expect(calls).toBe(2);
  });
});
