import { CaretDownIcon } from "@phosphor-icons/react";
import type { ProviderId } from "../types";
import { ProviderMark } from "./ProviderMark";

export function ProviderSwitch({ value, onChange }: { value: ProviderId; onChange: (provider: ProviderId) => void }) {
  return (
    <div className="provider-switch">
      <span className="field-label">Agent</span>
      <button className="provider-button motion-border" onClick={() => onChange(value === "codex" ? "claude" : "codex")}>
        <ProviderMark provider={value} size={19} />
        <span>{value === "codex" ? "OpenAI Codex" : "Claude Code"}</span>
        <CaretDownIcon />
      </button>
    </div>
  );
}
