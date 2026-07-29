import { useCallback, useEffect, useState } from "react";
import type { Project, ProviderId } from "../types";

export interface RaDioReadiness {
  ready: boolean;
  loading: boolean;
  checks: Array<{ label: string; ready: boolean; detail: string }>;
  refresh: () => Promise<void>;
}

export function useRadioReadiness(provider: ProviderId, project?: Project): RaDioReadiness {
  const [loading, setLoading] = useState(Boolean(window.asteria));
  const [checks, setChecks] = useState<RaDioReadiness["checks"]>([]);
  const refresh = useCallback(async () => {
    if (!window.asteria) {
      setChecks([{ label: "Electron runtime", ready: false, detail: "RaDio is available in the installed application." }]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [providers, accounts, legacyAuth] = await Promise.all([
        window.asteria.providers.detect(),
        window.asteria.accounts.list(),
        window.asteria.providers.authState(provider),
      ]);
      const installed = providers.find((item) => item.id === provider)?.available === true;
      const selectedIds = project?.radio.accountPool.enabled ? project.radio.accountPool.accountIds : undefined;
      const eligibleAccounts = accounts.filter((account) =>
        account.provider === provider && account.enabled && (!selectedIds || selectedIds.includes(account.id))
      );
      const authenticated = eligibleAccounts.some((account) => account.authenticated && account.health !== "unavailable")
        || (!project?.radio.accountPool.enabled && legacyAuth.status === "connected");
      const next = [
        { label: `${provider === "codex" ? "OpenAI Codex" : "Claude Code"} CLI`, ready: installed, detail: installed ? "Installed and compatible" : "Install a supported provider CLI." },
        { label: "Isolated provider account", ready: authenticated, detail: authenticated ? "Authenticated and available" : "Sign in or reconnect from Settings → Provider account pool." },
      ];
      if (project) next.push({
        label: "Orbit repository",
        ready: Boolean(project.repositoryPath),
        detail: project.repositoryPath ? "Validated local repository bound" : "Choose or clone a local repository for this Orbit.",
      });
      setChecks(next);
    } catch (error) {
      setChecks([{ label: "RaDio preflight", ready: false, detail: error instanceof Error ? error.message : "Readiness could not be verified." }]);
    } finally {
      setLoading(false);
    }
  }, [project?.id, project?.repositoryPath, project?.radio.accountPool.enabled, project?.radio.accountPool.accountIds.join(","), provider]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { ready: !loading && checks.length > 0 && checks.every((check) => check.ready), loading, checks, refresh };
}
