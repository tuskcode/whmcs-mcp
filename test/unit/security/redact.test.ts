import { describe, expect, it, vi } from 'vitest';
import { redact } from '../../../src/security/redact.js';
import { WhmcsClient } from '../../../src/whmcs/client.js';
import { WhmcsApiClient } from '../../../src/whmcs-client.js';

describe('sensitive output', () => {
  it('redacts nested credentials while retaining useful business data', () => {
    expect(redact({ clients: [{ password: 'p', api_secret: 's', access_token: 't', email: 'a@example.test', id: 42 }], message: 'key=private-value' }, ['private-value'])).toEqual({ clients: [{password:'[REDACTED]',api_secret:'[REDACTED]',access_token:'[REDACTED]',email:'a@example.test',id:42}],message:'key=[REDACTED]'});
  });
  it('keeps credentials and payloads out of debug output in both clients', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({result:'success',password:'hidden-password',message:'echo private-secret',email:'private@example.test'})));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('WHMCS_DEBUG','true');
    try {
      const clients = [new WhmcsClient({apiUrl:'https://billing.example/',identifier:'private-identifier',secret:'private-secret'}),new WhmcsApiClient({apiUrl:'https://billing.example/',apiIdentifier:'private-identifier',apiSecret:'private-secret'})];
      for (const client of clients) {
        const result = await client.call('GetStats', {password:'private-password',email:'private@example.test'});
        expect(JSON.stringify(result)).not.toMatch(/private-secret|hidden-password/);
      }
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-secret|private-password|private@example.test|hidden-password/);
    } finally { fetchMock.mockRestore(); log.mockRestore(); vi.unstubAllEnvs(); }
  });
});
