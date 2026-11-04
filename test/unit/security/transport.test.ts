import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { apiEndpoint } from '../../../src/security/endpoint.js';
import { WhmcsClient } from '../../../src/whmcs/client.js';
import { WhmcsApiClient } from '../../../src/whmcs-client.js';
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>((resolve, reject) => s.close(e => e ? reject(e) : resolve())))); });
async function listen(server: Server) {
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing address');
  return `http://127.0.0.1:${address.port}/`;
}
describe('credential transport', () => {
  it('requires HTTPS and rejects embedded credentials and URL decorations', () => {
    for (const url of ['http://billing.example/', 'ftp://billing.example/', 'https://user:secret@billing.example/', 'https://billing.example/?x=1', 'https://billing.example/#x', 'http://127.0.0.1/']) {
      expect(() => apiEndpoint(url)).toThrow();
    }
    expect(() => apiEndpoint('http://billing.example/', true)).toThrow();
    expect(apiEndpoint('https://billing.example/whmcs/')).toBe('https://billing.example/whmcs/includes/api.php');
    expect(apiEndpoint('http://127.0.0.1:123/', true)).toBe('http://127.0.0.1:123/includes/api.php');
  });
  for (const status of [301, 302, 303, 307, 308]) {
    it(`never follows ${status} redirects in either API client`, async () => {
      let received = 0;
      const destination = await listen(createServer((_req,res) => { received++; res.end('{"result":"success"}'); }));
      const apiUrl = await listen(createServer((_req,res) => { res.writeHead(status, { Location: destination }); res.end(); }));
      const clients = [new WhmcsClient({apiUrl, identifier: 'test', secret: 'test-secret', allowInsecureLocalhost: true}), new WhmcsApiClient({apiUrl, apiIdentifier:'test',apiSecret:'test-secret',allowInsecureLocalhost:true})];
      for (const client of clients) await expect(client.call('GetStats')).rejects.toThrow();
      expect(received).toBe(0);
    });
  }
});
