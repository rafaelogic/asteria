import { OpenAiLogoIcon } from "@phosphor-icons/react";
import claudeIcon from "../assets/claude-icon.png";
import type { ProviderId } from "../types";

export function ProviderMark({ provider, size = 20 }: { provider: ProviderId; size?: number }) {
  if (provider === "claude") {
    return <img className="provider-company-mark claude-mark" src={claudeIcon} width={size} height={size} alt="" aria-hidden="true" />;
  }
  return <OpenAiLogoIcon className="provider-company-mark openai-mark" width={size} height={size} weight="fill" aria-hidden="true" />;
}
