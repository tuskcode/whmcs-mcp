/** HTTP is only permitted for explicitly opted-in local development mocks. */
export function apiEndpoint(baseUrl: string, allowInsecureLocalhost = false): string {
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error('WHMCS_API_URL must be a valid HTTPS URL'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowInsecureLocalhost && local && url.protocol === 'http:')) {
    throw new Error('WHMCS_API_URL must use HTTPS (HTTP is only allowed for opted-in localhost development)');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('WHMCS_API_URL must not contain credentials, a query or a fragment');
  }
  url.pathname = url.pathname.replace(/\/$/, '') + '/includes/api.php';
  return url.href;
}
