import { describe, expect, it } from "vitest";
import { redactPayload, redactSecrets } from "../src/redaction";

describe("secret redaction", () => {
  it("redacts tokens before persistence", () => {
    const secret = `sk-proj-${"a".repeat(24)}`;
    expect(redactSecrets(`Authorization: Bearer ${secret}`)).not.toContain(secret);
  });

  it("recursively removes secret-bearing fields", () => {
    const value = redactPayload({ prompt: "safe", nested: { accessToken: "sensitive", output: "ok" } });
    expect(value).toEqual({ prompt: "safe", nested: { accessToken: "[REDACTED]", output: "ok" } });
  });
});
