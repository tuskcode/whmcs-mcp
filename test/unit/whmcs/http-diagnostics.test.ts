import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhmcsClient } from '../../../src/whmcs/client.js';
import { WhmcsApiClient } from '../../../src/whmcs-client.js';
import { ProductDomain } from '../../../src/whmcs/domains/products.js';
import { registerProductTools } from '../../../src/mcp/tools/products.js';

const config = { apiUrl: 'https://billing.example/whmcs/', identifier: 'test-identifier', secret: 'test-secret', accesskey: 'test-access-key' };
const factories = [
  ['domain client', () => new WhmcsClient(config)],
  ['legacy client', () => new WhmcsApiClient({ apiUrl: config.apiUrl, apiIdentifier: config.identifier, apiSecret: config.secret, accessKey: config.accesskey })],
] as const;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

for (const [name, factory] of factories) {
  describe(`${name} safe HTTP diagnostics`, () => {
    it('distinguishes an HTML 403 with Cloudflare indicators from a WHMCS denial', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>test-secret test-access-key private-user@example.test</html>', {
        status: 403, statusText: 'test-secret', headers: { 'content-type': 'text/html', server: 'cloudflare', 'cf-ray': 'private-value', 'set-cookie': 'session=private' },
      }));
      const message = await factory().call('GetProductGroups').catch((error: Error) => error.message);
      expect(message).toContain('WHMCS HTTP error (GetProductGroups): 403 Forbidden');
      expect(message).toContain('response=HTML');
      expect(message).toContain('no WHMCS application error envelope');
      expect(message).toContain('Cloudflare indicators present');
      expect(message).not.toMatch(/test-secret|test-access-key|private|<html>|session=/);
    });

    it.each([200, 403])('identifies a WHMCS application denial with HTTP %s and redacts credentials', async status => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
        result: 'error', message: 'Access Denied test-identifier test-secret test-access-key',
      }), { status, headers: { 'content-type': 'application/json' } }));
      const message = await factory().call('GetProducts').catch((error: Error) => error.message);
      expect(message).toContain('WHMCS API error (GetProducts): Access Denied');
      expect(message).not.toMatch(/test-identifier|test-secret|test-access-key/);
      if (status === 403) expect(message).toContain('HTTP 403 Forbidden; WHMCS application error response');
      expect(message).not.toContain('Cloudflare indicators');
    });

    it('does not treat an arbitrary JSON 403 as a WHMCS credential denial', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'test-secret', message: 'Access denied' }), {
        status: 403, headers: { 'content-type': 'application/json' },
      }));
      const message = await factory().call('GetProductGroups').catch((error: Error) => error.message);
      expect(message).toContain('WHMCS HTTP error');
      expect(message).toContain('response=JSON');
      expect(message).not.toContain('test-secret');
      expect(message).not.toContain('Cloudflare indicators');
    });

    it.each(['<html>test-secret</html>', 'null', '[]', '42'])('handles invalid successful response safely: %s', async body => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));
      const message = await factory().call('GetProducts').catch((error: Error) => error.message);
      expect(message).toContain('WHMCS returned non-JSON');
      expect(message).not.toContain('test-secret');
    });

    it('keeps response bodies and headers out of debug logs on HTTP failures', async () => {
      vi.stubEnv('WHMCS_DEBUG', 'true');
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('test-secret', {
        status: 403, headers: { 'cf-ray': 'private-ray', 'set-cookie': 'private-cookie' },
      }));
      await expect(factory().call('GetProductGroups')).rejects.toThrow('403');
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/test-secret|private-ray|private-cookie/);
    });
  });
}

describe('GetProductGroups MCP diagnostics', () => {
  it('retains the existing request and reports the undocumented action without fallback', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>Forbidden</html>', {
      status: 403, headers: { 'content-type': 'text/html' },
    }));
    const handlers: Record<string, () => Promise<any>> = {};
    registerProductTools({ registerTool(name: string, _schema: unknown, handler: any) { handlers[name] = handler; } }, {
      products: new ProductDomain(new WhmcsClient(config)),
    });
    const result = await handlers.whmcs_get_product_groups();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('403 Forbidden');
    expect(result.content[0].text).toContain('GetProductGroups is not listed in the official WHMCS action API index');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://billing.example/whmcs/includes/api.php');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', redirect: 'error' });
    expect(new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body)).get('action')).toBe('GetProductGroups');
  });
});
