const permanentDeny = new Set([
  "frugpmstpnojnhfyimgv.supabase.co",
  "telemetry.asteria.invalid"
]);

const baseAllow = new Set([
  "api.github.com",
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
  "api.openai.com",
  "chatgpt.com",
  "auth.openai.com",
  "api.anthropic.com",
  "claude.ai",
  "console.anthropic.com"
]);

export function decideNetworkRequest(rawUrl: string) {
  const url = new URL(rawUrl);
  if (permanentDeny.has(url.hostname) || /telemetry|community-pulse|analytics/i.test(url.pathname)) {
    return { decision: "deny" as const, reason: "Creator telemetry and analytics are permanently blocked." };
  }
  if (baseAllow.has(url.hostname)) return { decision: "allow" as const, reason: "Approved provider or GitHub destination." };
  if (url.protocol === "file:" || url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    return { decision: "allow" as const, reason: "Local application resource." };
  }
  return { decision: "review" as const, reason: "Destination requires an explicit workflow approval." };
}
