import { apiEndpoint } from '../security/endpoint.js';
import type { WhmcsApiResponse, WhmcsClientConfig } from './types.js';
import { readWhmcsResponse } from './response.js';

export class WhmcsClient {
  private endpoint: string;

  constructor(private config: WhmcsClientConfig) {
    this.endpoint = apiEndpoint(config.apiUrl, config.allowInsecureLocalhost);
  }

  async call<T extends Record<string, unknown> = Record<string, unknown>>(
    action: string,
    params: Record<string, unknown> = {},
  ): Promise<T & WhmcsApiResponse> {
    const body = new URLSearchParams({
      action,
      identifier: this.config.identifier,
      secret: this.config.secret,
      responsetype: 'json',
      ...(this.config.accesskey ? { accesskey: this.config.accesskey } : {}),
    });
    // PHP-style form arrays, as used by AddProduct pricing and recommendations.
    // Preserve existing scalar and null serialization for all existing calls.
    const append = (key: string, value: unknown): void => {
      if (value !== null && typeof value === 'object') {
        for (const [child, item] of Object.entries(value)) append(`${key}[${child}]`, item);
      } else body.set(key, value == null ? '' : String(value));
    };
    for (const [key, value] of Object.entries(params)) append(key, value);

    const url = this.endpoint;

    if (process.env.WHMCS_DEBUG === 'true') {
      console.error('[whmcs-mcp] API request');
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (err) {
      throw new Error(`WHMCS connection error (${action})`);
    }

    if (process.env.WHMCS_DEBUG === 'true') {
      console.error(`[whmcs-mcp] API response (${res.status})`);
    }

    return readWhmcsResponse<T>(res, action, [this.config.identifier, this.config.secret, this.config.accesskey]);
  }
}
