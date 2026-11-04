import { redact } from '../security/redact.js';
import { apiEndpoint } from '../security/endpoint.js';
import type { WhmcsApiResponse, WhmcsClientConfig } from './types.js';

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
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, v == null ? '' : String(v)]),
      ),
    });

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

    if (!res.ok) {
      throw new Error(`WHMCS HTTP error (${action}): ${res.status} ${res.statusText}`);
    }

    const rawText = await res.text();

    if (process.env.WHMCS_DEBUG === 'true') {
      console.error(`[whmcs-mcp] API response (${res.status})`);
    }

    // WHMCS sometimes returns HTML (PHP errors/warnings) instead of JSON
    let data: T & WhmcsApiResponse;
    try {
      data = JSON.parse(rawText) as T & WhmcsApiResponse;
    } catch {
      throw new Error(`WHMCS returned non-JSON response for "${action}"`);
    }

    data = redact(data, [this.config.identifier, this.config.secret, this.config.accesskey]);

    if (data.result === 'error') {
      throw new Error(`WHMCS API error (${action}): ${data.message ?? 'unknown'}`);
    }

    return data;
  }
}
