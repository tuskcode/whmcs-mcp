import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { WhmcsClient } from '../../../../src/whmcs/client.js';
import { ProductDomain } from '../../../../src/whmcs/domains/products.js';
import { registerProductTools } from '../../../../src/mcp/tools/products.js';

function setup(response: unknown = { result: 'success', pid: 42 }, status = 200) {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(response), { status, headers: { 'content-type': 'application/json' } }),
  );
  const products = new ProductDomain(new WhmcsClient({
    apiUrl: 'https://billing.example/whmcs/', identifier: 'test-identifier', secret: 'test-secret',
  }));
  const handlers: Record<string, (input: any) => Promise<any>> = {};
  registerProductTools({ registerTool(name: string, _schema: unknown, handler: any) { handlers[name] = handler; } }, { products });
  return { fetchMock, handlers, products };
}
const minimal = { name: 'Example Product', gid: 1, confirm: true };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('catalog mutation security and form encoding', () => {
  it.each([undefined, 'false', 'TRUE', '1'])('rejects writes with WHMCS_ALLOW_MUTATIONS=%s before HTTP', async value => {
    vi.stubEnv('WHMCS_ALLOW_MUTATIONS', value);
    const { handlers, fetchMock } = setup();
    const result = await handlers.whmcs_add_product(minimal);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('WHMCS_ALLOW_MUTATIONS=true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, false, 'true', 1])('requires boolean confirm: true (received %s)', async confirm => {
    vi.stubEnv('WHMCS_ALLOW_MUTATIONS', 'true');
    const { handlers, fetchMock } = setup();
    const result = await handlers.whmcs_add_product({ ...minimal, confirm });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('confirm: true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { name: undefined }, { name: '' }, { name: '  ' }, { gid: undefined }, { gid: 0 }, { gid: 1.5 },
    { type: 'invalid' }, { paytype: 'monthly' }, { hidden: 'false' }, { autosetup: 'yes' },
    { pricing: { USD: { monthly: 10 } } }, { pricing: { 1: { unsupported: 10 } } },
    { pricing: { 1: { monthly: -2 } } }, { recommendations: [{ id: 0, order: 0 }] },
    { ondemandrenewalsenabled: true }, { ondemandrenewalperiodmonthly: 5 },
    { pid: 99 }, { action: 'UpdateClientProduct' }, { secret: 'replacement' },
  ])('rejects invalid/unknown product params %j without HTTP', async invalid => {
    vi.stubEnv('WHMCS_ALLOW_MUTATIONS', 'true');
    const { handlers, fetchMock } = setup();
    const result = await handlers.whmcs_add_product({ ...minimal, ...invalid });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid product parameters');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a product with no injected options and never forwards confirm', async () => {
    vi.stubEnv('WHMCS_ALLOW_MUTATIONS', 'true');
    const { handlers, fetchMock } = setup();
    const result = await handlers.whmcs_add_product(minimal);
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ result: 'success', pid: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://billing.example/whmcs/includes/api.php');
    expect(options).toMatchObject({ method: 'POST', redirect: 'error' });
    const form = new URLSearchParams(String(options?.body));
    expect(Object.fromEntries(form)).toEqual({
      action: 'AddProduct', identifier: 'test-identifier', secret: 'test-secret',
      responsetype: 'json', name: 'Example Product', gid: '1',
    });
  });

  it('encodes explicit booleans, partial cycle prices and recommendations as PHP form arrays', async () => {
    vi.stubEnv('WHMCS_ALLOW_MUTATIONS', 'true');
    const { handlers, fetchMock } = setup();
    await handlers.whmcs_add_product({ ...minimal, type: 'other', hidden: true, tax: false,
      paytype: 'recurring', autosetup: '', module: '',
      pricing: { 1: { monthly: '9.90', msetupfee: 0, annually: -1 }, 2: { quarterly: 20 } },
      recommendations: [{ id: 7, order: 0 }], configoption1: false,
      ondemandrenewalconfigurationoverride: true, ondemandrenewalsenabled: false,
      ondemandrenewalperiodmonthly: 5,
    });
    const form = new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body));
    expect(form.get('pricing[1][monthly]')).toBe('9.90');
    expect(form.get('pricing[1][msetupfee]')).toBe('0');
    expect(form.get('pricing[1][annually]')).toBe('-1');
    expect(form.get('pricing[2][quarterly]')).toBe('20');
    expect(form.has('pricing[1][quarterly]')).toBe(false);
    expect(form.get('recommendations[0][id]')).toBe('7');
    expect(form.get('recommendations[0][order]')).toBe('0');
    expect(form.get('tax')).toBe('0');
    expect(form.get('hidden')).toBe('1');
    expect(form.get('configoption1')).toBe('0');
    expect(form.get('ondemandrenewalsenabled')).toBe('0');
    expect(form.get('autosetup')).toBe('');
    expect(form.get('module')).toBe('');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a redacted WHMCS application failure without retrying creation', async () => {
    vi.stubEnv('WHMCS_ALLOW_MUTATIONS', 'true');
    const { handlers, fetchMock } = setup({ result: 'error', message: 'You must supply a valid Product Group ID test-secret' });
    const result = await handlers.whmcs_add_product(minimal);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('WHMCS API error (AddProduct)');
    expect(result.content[0].text).toContain('Product Group ID');
    expect(result.content[0].text).not.toContain('test-secret');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns HTTP failure without retrying creation', async () => {
    vi.stubEnv('WHMCS_ALLOW_MUTATIONS', 'true');
    const { handlers, fetchMock } = setup({ internal: 'test-secret' }, 403);
    const result = await handlers.whmcs_add_product(minimal);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('WHMCS HTTP error (AddProduct): 403 Forbidden');
    expect(result.content[0].text).not.toContain('test-secret');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('MCP wire compatibility', () => {
  it('publishes required/optional params and rejects unsupported updates without HTTP', async () => {
    vi.stubEnv('WHMCS_ALLOW_MUTATIONS', 'true');
    const { products, fetchMock } = setup();
    const server = new McpServer({ name: 'product-test', version: '1' });
    registerProductTools(server, { products });
    const client = new Client({ name: 'product-test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const { tools } = await client.listTools();
      const add = tools.find(tool => tool.name === 'whmcs_add_product')!;
      expect(add.inputSchema.required).toEqual(['name', 'gid', 'confirm']);
      expect(add.inputSchema.properties).toHaveProperty('pricing');
      expect(add.inputSchema.properties).toHaveProperty('module');
      for (const name of ['whmcs_update_product', 'whmcs_add_product_group', 'whmcs_update_product_group']) {
        expect(tools.some(tool => tool.name === name)).toBe(false);
        const result = await client.callTool({ name, arguments: { pid: 999, gid: 2, confirm: true } });
        expect(result.isError).toBe(true);
      }
      const invalid = await client.callTool({ name: add.name, arguments: { confirm: true } });
      expect(invalid.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
      const created = await client.callTool({ name: add.name, arguments: minimal });
      expect(created.isError).not.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { await client.close(); await server.close(); }
  });
});
