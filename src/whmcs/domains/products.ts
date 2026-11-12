import type { WhmcsClient } from '../client.js';
import { z } from 'zod';

const nonNegativeInteger = z.number().int().nonnegative();
const price = z.union([
  z.number().refine(value => value === -1 || value >= 0, 'Use a non-negative price or -1 to disable a cycle'),
  z.string().regex(/^(?:-1(?:\.0+)?|\d+(?:\.\d+)?)$/, 'Use a decimal price or -1 to disable a cycle'),
]);
const cyclePricing = z.strictObject({
  monthly: price.optional(), quarterly: price.optional(), semiannually: price.optional(),
  annually: price.optional(), biennially: price.optional(), triennially: price.optional(),
  msetupfee: price.optional(), qsetupfee: price.optional(), ssetupfee: price.optional(),
  asetupfee: price.optional(), bsetupfee: price.optional(), tsetupfee: price.optional(),
});

/** Public AddProduct parameters only. Omitted options retain WHMCS defaults. */
export const addProductSchema = z.strictObject({
  name: z.string().trim().min(1).describe('Product name (required)'),
  gid: z.number().int().positive().describe('Existing product group ID (required)'),
  slug: z.string().optional().describe('Friendly name; requires WHMCS 8.3+'),
  type: z.enum(['hostingaccount', 'reselleraccount', 'server', 'other']).optional(),
  stockcontrol: z.boolean().optional(),
  qty: nonNegativeInteger.optional(),
  paytype: z.enum(['free', 'onetime', 'recurring']).optional(),
  hidden: z.boolean().optional(),
  showdomainoptions: z.boolean().optional(),
  tax: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  proratabilling: z.boolean().optional(),
  description: z.string().optional(),
  shortdescription: z.string().optional(),
  tagline: z.string().optional(),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/, 'Use a six-digit hexadecimal color').optional(),
  welcomeemail: z.number().int().positive().optional(),
  proratadate: nonNegativeInteger.max(31).optional(),
  proratachargenextmonth: nonNegativeInteger.max(31).optional(),
  subdomain: z.string().optional(),
  autosetup: z.enum(['', 'on', 'payment', 'order']).optional(),
  module: z.string().optional(),
  servergroupid: nonNegativeInteger.optional(),
  configoption1: z.json().optional(), configoption2: z.json().optional(),
  configoption3: z.json().optional(), configoption4: z.json().optional(),
  configoption5: z.json().optional(), configoption6: z.json().optional(),
  order: nonNegativeInteger.optional(),
  pricing: z.record(z.string().regex(/^[1-9]\d*$/, 'Use a currency ID'), cyclePricing).optional()
    .describe('Prices by currency ID and cycle, including optional setup fees; no prices are filled automatically'),
  recommendations: z.array(z.strictObject({ id: z.number().int().positive(), order: nonNegativeInteger })).optional(),
  ondemandrenewalconfigurationoverride: z.boolean().optional(),
  ondemandrenewalsenabled: z.boolean().optional(),
  ondemandrenewalperiodmonthly: nonNegativeInteger.optional(),
  ondemandrenewalperiodquarterly: nonNegativeInteger.optional(),
  ondemandrenewalperiodsemiannually: nonNegativeInteger.optional(),
  ondemandrenewalperiodannually: nonNegativeInteger.optional(),
  ondemandrenewalperiodbiennially: nonNegativeInteger.optional(),
  ondemandrenewalperiodtriennially: nonNegativeInteger.optional(),
}).superRefine((params, ctx) => {
  if (params.ondemandrenewalconfigurationoverride !== true
    && Object.entries(params).some(([key, value]) =>
      (key === 'ondemandrenewalsenabled' || key.startsWith('ondemandrenewalperiod')) && value !== undefined)) {
    ctx.addIssue({ code: 'custom', path: ['ondemandrenewalconfigurationoverride'],
      message: 'Custom on-demand renewal options require ondemandrenewalconfigurationoverride: true' });
  }
});

export type AddProductParams = z.infer<typeof addProductSchema>;

export interface ProductFull {
  pid: number;
  gid: number;
  type: string;
  name: string;
  description: string;
  module: string;
  paytype: string;
  pricing: Record<string, {
    prefix: string; suffix: string;
    monthly: string; quarterly: string; semiannually: string;
    annually: string; biennially: string; triennially: string;
    msetupfee: string; asetupfee: string;
  }>;
}

export interface ProductGroup {
  id: number;
  name: string;
  headline: string;
  tagline: string;
}

export class ProductDomain {
  constructor(private client: WhmcsClient) {}

  async addProduct(params: AddProductParams) {
    const validated = addProductSchema.parse(params);
    // PHP treats the string "false" as truthy. Send explicit numeric booleans.
    const form = Object.fromEntries(Object.entries(validated)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, typeof value === 'boolean' ? Number(value) : value]));
    return this.client.call<{ pid?: number }>('AddProduct', form);
  }

  async getProductFull(productId: number): Promise<ProductFull> {
    const res = await this.client.call<{
      products: { product: ProductFull[] };
    }>('GetProducts', { pid: productId });
    const product = res.products?.product?.[0];
    if (!product) throw new Error(`Product ${productId} not found`);
    return product;
  }

  async getProductGroups(): Promise<ProductGroup[]> {
    try {
      const res = await this.client.call<{
        productgroups: { productgroup: ProductGroup[] };
      }>('GetProductGroups');
      return res.productgroups?.productgroup ?? [];
    } catch (error) {
      throw new Error(`${(error as Error).message}. GetProductGroups is not listed in the official WHMCS action API index; additional API permissions cannot add a missing action. No fallback was attempted.`);
    }
  }

  async getClientAddons(clientId: number, options: { limit?: number } = {}): Promise<Array<{
    id: number; name: string; domain: string; status: string;
    billingcycle: string; recurringamount: string;
  }>> {
    const res = await this.client.call<{
      products: { product: Array<{
        id: number; name: string; domain: string; status: string;
        billingcycle: string; recurringamount: string; groupname: string;
      }> };
    }>('GetClientsProducts', { clientid: clientId, limitnum: options.limit ?? 25 });
    return (res.products?.product ?? []).map((p) => ({
      id: p.id, name: p.name, domain: p.domain,
      status: p.status, billingcycle: p.billingcycle,
      recurringamount: p.recurringamount,
    }));
  }
}
