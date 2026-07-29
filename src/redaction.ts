const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[opsu]_[A-Za-z0-9]{20,})\b/g, "[REDACTED_TOKEN]"],
  [/(authorization\s*:\s*bearer\s+)[^\s"',]+/gi, "$1[REDACTED]"],
  [/(api[_-]?key|password|secret|token)(\s*[=:]\s*)[^\s"',]+/gi, "$1$2[REDACTED]"],
  [/\bAKIA[A-Z0-9]{16}\b/g, "[REDACTED_AWS_KEY]"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"]
];

export function redactSecrets(input: string) {
  return SECRET_PATTERNS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), input);
}

export function redactPayload(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      /password|secret|token|authorization|cookie/i.test(key)
        ? [key, "[REDACTED]"]
        : [key, redactPayload(item)]
    ));
  }
  return value;
}
