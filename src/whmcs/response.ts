import { STATUS_CODES } from 'node:http';
import { redact } from '../security/redact.js';
import type { WhmcsApiResponse } from './types.js';

/** Inspect responses without reflecting HTTP bodies, headers, URLs or credentials. */
export async function readWhmcsResponse<T>(
  response: Response,
  action: string,
  credentials: readonly (string | undefined)[],
): Promise<T & WhmcsApiResponse> {
  let raw: string;
  try { raw = await response.text(); }
  catch { throw new Error(`WHMCS response read error (${action}): HTTP ${response.status}`); }

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { /* HTTP errors may contain HTML. */ }
  const envelope = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown> : undefined;
  const http = `${response.status} ${STATUS_CODES[response.status] ?? 'Unknown status'}`;

  if (envelope?.result === 'error') {
    const message = typeof envelope.message === 'string' ? envelope.message : 'unknown';
    throw new Error(redact(
      `WHMCS API error (${action}): ${message}${response.ok ? '' : ` [HTTP ${http}; WHMCS application error response]`}`,
      credentials,
    ));
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const format = contentType.includes('html') ? 'HTML'
      : contentType.includes('json') ? 'JSON' : 'other/unspecified';
    const cloudflare = response.headers.has('cf-ray')
      || response.headers.get('server')?.toLowerCase() === 'cloudflare'
      || /cf-chl-|cloudflare ray id/i.test(raw);
    throw new Error(
      `WHMCS HTTP error (${action}): ${http}; response=${format}; no WHMCS application error envelope. `
      + (cloudflare ? 'Cloudflare indicators present; a proxy/WAF block is possible. ' : '')
      + 'Check HTTP server/proxy/WAF logs and API access controls; HTTP status alone does not establish a WHMCS credential or role error.',
    );
  }

  if (!envelope) throw new Error(`WHMCS returned non-JSON or invalid response for "${action}"`);
  return redact(envelope, credentials) as T & WhmcsApiResponse;
}
