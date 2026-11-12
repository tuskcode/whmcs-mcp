import { z } from 'zod';
import { addProductSchema, type ProductDomain } from '../../whmcs/domains/products.js';
import { requireMutations } from '../mutations.js';

export interface ProductToolDeps {
  products: ProductDomain;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(obj: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}
function fail(msg: string): ToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

export function registerProductTools(server: any, deps: ProductToolDeps): void {
  // Keep the original read tools and their schemas intact.
  server.registerTool(
    'whmcs_get_product_full',
    {
      title: 'Get Product Full',
      description:
        'Returns enriched product details including pricing tiers, module, server group, and pay type for a specific WHMCS product.',
      inputSchema: {
        productId: z.number().describe('The WHMCS product ID (pid)'),
      },
    },
    async ({ productId }: { productId: number }) => {
      try { return ok(await deps.products.getProductFull(productId)); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_product_groups',
    {
      title: 'Get Product Groups',
      description:
        'Returns product groups when the installation supports GetProductGroups. This action is not listed in the official WHMCS action API index; retained for compatibility.',
      inputSchema: {},
    },
    async () => {
      try { return ok(await deps.products.getProductGroups()); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_client_addons',
    {
      title: 'Get Client Addons',
      description:
        'Returns a simplified list of products/services for a client, including status, billing cycle, and recurring amount.',
      inputSchema: {
        clientId: z.number().describe('The WHMCS client ID'),
        limit: z.number().optional().describe('Max products to return (default 25)'),
      },
    },
    async ({ clientId, limit }: { clientId: number; limit?: number }) => {
      try { return ok(await deps.products.getClientAddons(clientId, { limit })); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  const createSchema = addProductSchema.safeExtend({
    confirm: z.literal(true).describe('Explicit consent; also requires WHMCS_ALLOW_MUTATIONS=true'),
  });
  server.registerTool(
    'whmcs_add_product',
    {
      title: 'Add Product',
      description: 'Creates a catalog product with the official AddProduct API. Requires an existing group, WHMCS_ALLOW_MUTATIONS=true and confirm: true. Only supplied options are sent; WHMCS defaults apply to omitted fields. Does not create client services, orders or invoices.',
      inputSchema: createSchema,
    },
    async (input: z.infer<typeof createSchema>) => {
      try {
        requireMutations('whmcs_add_product', input?.confirm);
        const { confirm: _confirm, ...params } = createSchema.parse(input);
        return ok(await deps.products.addProduct(params));
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Issue messages do not include submitted values (which may be module secrets).
          return fail(`Invalid product parameters: ${error.issues.map(issue => {
            const field = String(issue.path[0] ?? 'input');
            return `${field in createSchema.shape ? field : 'input'}: ${issue.message}`;
          }).join('; ')}`);
        }
        return fail((error as Error).message);
      }
    },
  );
}
