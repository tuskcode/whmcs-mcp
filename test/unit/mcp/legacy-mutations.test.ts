import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startMockWhmcs } from '../../mock-whmcs.js';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

// Exercise the actual entry point, not just the standalone gating helper.
describe('legacy mutation protection', () => {
  for (const enabled of [false, true]) {
    it(`requires both opt-in and confirmation (enabled=${enabled})`, async () => {
      const mock = await startMockWhmcs({ fixtures: {
        WhmcsDetails: { result: 'success', whmcs: { version: '8.10.0' } },
        DeleteClient: { result: 'success' }, ModuleTerminate: { result: 'success' },
        SendEmail: { result: 'success' },
      } });
      cleanup.push(mock.stop);
      const transport = new StdioClientTransport({
        command: process.execPath, args: ['--import', 'tsx', 'src/index.ts'],
        env: { PATH: process.env.PATH!, WHMCS_API_URL: mock.url,
          WHMCS_API_IDENTIFIER: 'test', WHMCS_API_SECRET: 'test',
          WHMCS_ALLOW_INSECURE_LOCALHOST: 'true',
          WHMCS_ALLOW_MUTATIONS: String(enabled) }, stderr: 'pipe',
      });
      const client = new Client({ name: 'security-test', version: '1' });
      cleanup.push(() => client.close());
      await client.connect(transport);
      const listed = await client.listTools();
      const deletion = listed.tools.find(tool => tool.name === 'whmcs_delete_client')!;
      expect(deletion.inputSchema.required).toContain('clientid');
      expect(deletion.inputSchema.properties?.confirm).toMatchObject({ type: 'boolean' });
      const beforeInvalid = mock.lastRequest();
      const invalid = await client.callTool({ name: 'whmcs_delete_client', arguments: { clientid: '1', confirm: true } });
      expect(invalid.isError).toBe(true);
      expect(mock.lastRequest()).toBe(beforeInvalid);
      for (const [name, args] of [
        ['whmcs_delete_client', { clientid: 1 }],
        ['whmcs_module_terminate', { accountid: 1 }],
        ['whmcs_send_email', { id: 1, messagename: 'test' }],
      ] as const) {
        const before = mock.lastRequest();
        const denied = await client.callTool({ name, arguments: args });
        expect(denied.isError).toBe(true);
        expect(mock.lastRequest()).toBe(before);
        const confirmed = await client.callTool({ name, arguments: { ...args, confirm: true } });
        expect(!!confirmed.isError).toBe(!enabled);
        if (enabled) expect(mock.lastRequest()?.params.has('confirm')).toBe(false);
        else expect(mock.lastRequest()).toBe(before);
      }
    });
  }
});
