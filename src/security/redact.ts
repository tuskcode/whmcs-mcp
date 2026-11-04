const SENSITIVE_KEY = /^(?:.*(?:password|passwd|secret|token|authorization|accesskey|api[_-]?key|private[_-]?key).*|identifier|cookie|set-cookie)$/i;

/** Remove credential fields and configured credential values before MCP output. */
export function redact<T>(value: T, credentials: readonly (string | undefined)[] = []): T {
  const secrets = credentials.filter((s): s is string => !!s).sort((a, b) => b.length - a.length);
  function visit(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(visit);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input).map(([key, item]) => [
        key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : visit(item),
      ]));
    }
    if (typeof input === 'string') {
      if (/https?:\/\/[^\s]+[?&](?:[^=&#]*token|password|secret|api[_-]?key)=/i.test(input)) return '[REDACTED]';
      let text = input;
      for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
      return text;
    }
    return input;
  }
  return visit(value) as T;
}
