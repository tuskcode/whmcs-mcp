export interface WhmcsApiResponse {
  result: 'success' | 'error';
  message?: string;
}

export interface WhmcsClientConfig {
  apiUrl: string;
  allowInsecureLocalhost?: boolean;
  identifier: string;
  secret: string;
  accesskey?: string;
}
