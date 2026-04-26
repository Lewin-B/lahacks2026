"use client";

import Link from "next/link";
import { FormEvent, useId, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  Rocket,
  Server,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const deploymentProfiles = [
  {
    id: "local",
    label: "Local agent",
    name: "drip-agent",
    gatewayPort: 18790,
    launcherPort: 18800,
    description: "Default launcher ports for a single local deployment.",
  },
  {
    id: "parallel",
    label: "Parallel agent",
    name: "drip-agent-parallel",
    gatewayPort: 18791,
    launcherPort: 18801,
    description: "Adjacent ports for a second deployment on the same host.",
  },
  {
    id: "demo",
    label: "Demo agent",
    name: "drip-agent-demo",
    gatewayPort: 18792,
    launcherPort: 18802,
    description: "A clearly named deployment for demos and rehearsals.",
  },
] as const;

type DeploymentProfileId = (typeof deploymentProfiles)[number]["id"];
type TokenMode = "auto" | "custom";

type DeployPayload = {
  mode: "launcher";
  name: string;
  gateway_port: number;
  launcher_port: number;
  dashboard_token: string;
  pull: boolean;
  replace: boolean;
  print_only: boolean;
};

type DeployResponse = {
  public_url?: string;
  token?: string | null;
  error?: string;
};

type SuccessState = {
  publicUrl?: string;
  token: string;
  name: string;
  gatewayPort: number;
  launcherPort: number;
  dryRun: boolean;
};

const portInputClass =
  "h-11 w-full rounded-[8px] border border-white/10 bg-[#06111f]/70 px-3 text-sm text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-cyan-50/30 focus:border-cyan-200/45 focus:ring-2 focus:ring-cyan-300/20";

const textInputClass =
  "h-11 w-full rounded-[8px] border border-white/10 bg-[#06111f]/70 px-3 text-sm text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-cyan-50/30 focus:border-cyan-200/45 focus:ring-2 focus:ring-cyan-300/20";

function generateDashboardToken() {
  const bytes = new Uint8Array(12);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return `drip-${Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")}`;
  }

  return `drip-${Math.random().toString(36).slice(2)}${Date.now().toString(
    36
  )}`;
}

function isValidPort(port: number) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function tokenFromStableId(id: string) {
  const normalized = id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `drip-${normalized || "agent"}-token`;
}

export default function AgentConfigurator() {
  const defaultProfile = deploymentProfiles[0];
  const autoTokenId = useId();
  const [profileId, setProfileId] =
    useState<DeploymentProfileId>(defaultProfile.id);
  const [name, setName] = useState<string>(defaultProfile.name);
  const [gatewayPort, setGatewayPort] = useState(
    String(defaultProfile.gatewayPort)
  );
  const [launcherPort, setLauncherPort] = useState(
    String(defaultProfile.launcherPort)
  );
  const [tokenMode, setTokenMode] = useState<TokenMode>("auto");
  const [autoToken, setAutoToken] = useState(tokenFromStableId(autoTokenId));
  const [customToken, setCustomToken] = useState("");
  const [pullLatest, setPullLatest] = useState(true);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const selectedProfile = useMemo(
    () =>
      deploymentProfiles.find((profile) => profile.id === profileId) ??
      defaultProfile,
    [defaultProfile, profileId]
  );

  const parsedGatewayPort = Number(gatewayPort);
  const parsedLauncherPort = Number(launcherPort);
  const activeToken =
    tokenMode === "auto" ? autoToken.trim() : customToken.trim();

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name.trim())) {
      errors.push(
        "Deployment name must start with a letter or number and use only letters, numbers, dots, underscores, or hyphens."
      );
    }

    if (!isValidPort(parsedGatewayPort)) {
      errors.push("Gateway port must be a whole number from 1 to 65535.");
    }

    if (!isValidPort(parsedLauncherPort)) {
      errors.push("Launcher port must be a whole number from 1 to 65535.");
    }

    if (
      isValidPort(parsedGatewayPort) &&
      isValidPort(parsedLauncherPort) &&
      parsedGatewayPort === parsedLauncherPort
    ) {
      errors.push("Gateway and launcher ports must be different.");
    }

    if (tokenMode === "auto" && autoToken.trim() === "") {
      errors.push("Dashboard token is still being generated.");
    }

    if (tokenMode === "custom" && customToken.trim() === "") {
      errors.push("Custom token mode needs a dashboard token.");
    }

    return errors;
  }, [
    autoToken,
    customToken,
    name,
    parsedGatewayPort,
    parsedLauncherPort,
    tokenMode,
  ]);

  const payload: DeployPayload | null = useMemo(() => {
    if (validationErrors.length > 0) {
      return null;
    }

    return {
      mode: "launcher",
      name: name.trim(),
      gateway_port: parsedGatewayPort,
      launcher_port: parsedLauncherPort,
      dashboard_token: activeToken,
      pull: pullLatest,
      replace: replaceExisting,
      print_only: dryRun,
    };
  }, [
    activeToken,
    dryRun,
    name,
    parsedGatewayPort,
    parsedLauncherPort,
    pullLatest,
    replaceExisting,
    validationErrors.length,
  ]);

  function applyProfile(profile: (typeof deploymentProfiles)[number]) {
    setProfileId(profile.id);
    setName(profile.name);
    setGatewayPort(String(profile.gatewayPort));
    setLauncherPort(String(profile.launcherPort));
    setSuccess(null);
    setError("");
  }

  async function submitDeployment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!payload) {
      setError(validationErrors[0] ?? "Check the deployment controls.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess(null);

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as DeployResponse;

      if (!response.ok) {
        throw new Error(
          data.error || `Deploy request failed with status ${response.status}.`
        );
      }

      setSuccess({
        publicUrl: data.public_url,
        token: data.token ?? payload.dashboard_token,
        name: payload.name,
        gatewayPort: payload.gateway_port,
        launcherPort: payload.launcher_port,
        dryRun: payload.print_only,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Deploy request failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submitDeployment}
      className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]"
    >
      <div className="space-y-5">
        <section className="rounded-[8px] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-cyan-950/25 backdrop-blur-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Deployment profile
              </h2>
              <p className="mt-1 text-sm leading-6 text-cyan-50/65">
                Profile presets choose the container name and starting ports.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
              <Rocket aria-hidden="true" className="h-3.5 w-3.5" />
              Launcher mode
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {deploymentProfiles.map((profile) => {
              const isSelected = profile.id === profileId;

              return (
                <button
                  key={profile.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => applyProfile(profile)}
                  className={cn(
                    "min-h-36 rounded-[8px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/35",
                    isSelected
                      ? "border-cyan-200/45 bg-cyan-300/10 shadow-lg shadow-cyan-950/20"
                      : "border-white/10 bg-[#06111f]/45 hover:border-cyan-200/25 hover:bg-white/[0.06]"
                  )}
                >
                  <span className="text-sm font-semibold text-white">
                    {profile.label}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-cyan-50/60">
                    {profile.description}
                  </span>
                  <span className="mt-4 block font-mono text-xs text-cyan-100/80">
                    {profile.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[8px] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <Server aria-hidden="true" className="h-4 w-4 text-cyan-200" />
            <h2 className="text-xl font-semibold text-white">
              Agent endpoint controls
            </h2>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-cyan-50/85">
                Deployment name
              </span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSuccess(null);
                }}
                className={textInputClass}
                placeholder={selectedProfile.name}
                autoComplete="off"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-cyan-50/85">
                Gateway port
              </span>
              <input
                type="number"
                min={1}
                max={65535}
                step={1}
                inputMode="numeric"
                value={gatewayPort}
                onChange={(event) => {
                  setGatewayPort(event.target.value);
                  setSuccess(null);
                }}
                className={portInputClass}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-cyan-50/85">
                Launcher port
              </span>
              <input
                type="number"
                min={1}
                max={65535}
                step={1}
                inputMode="numeric"
                value={launcherPort}
                onChange={(event) => {
                  setLauncherPort(event.target.value);
                  setSuccess(null);
                }}
                className={portInputClass}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[8px] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <KeyRound aria-hidden="true" className="h-4 w-4 text-cyan-200" />
            <h2 className="text-xl font-semibold text-white">
              Dashboard token
            </h2>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["auto", "Auto-generate"],
                ["custom", "Custom token"],
              ] as const
            ).map(([mode, label]) => {
              const isSelected = tokenMode === mode;

              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setTokenMode(mode);
                    setSuccess(null);
                    setError("");
                  }}
                  className={cn(
                    "rounded-[8px] border px-4 py-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/35",
                    isSelected
                      ? "border-cyan-200/45 bg-cyan-300/10 text-cyan-50"
                      : "border-white/10 bg-[#06111f]/45 text-cyan-50/60 hover:border-cyan-200/25"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {tokenMode === "auto" ? (
            <div className="mt-4 flex flex-col gap-3 rounded-[8px] border border-white/10 bg-[#06111f]/45 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-100/55">
                  Generated token
                </p>
                <p className="mt-2 break-all font-mono text-sm text-cyan-50/85">
                  {autoToken || "Generating token..."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAutoToken(generateDashboardToken());
                  setSuccess(null);
                }}
                className="border-cyan-200/20 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/15"
              >
                <RefreshCw aria-hidden="true" data-icon="inline-start" />
                Regenerate
              </Button>
            </div>
          ) : (
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-cyan-50/85">
                Custom dashboard token
              </span>
              <input
                value={customToken}
                onChange={(event) => {
                  setCustomToken(event.target.value);
                  setSuccess(null);
                }}
                className={textInputClass}
                placeholder="Enter a token for launcher access"
                autoComplete="off"
              />
            </label>
          )}
        </section>

        <section className="rounded-[8px] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl">
          <h2 className="text-xl font-semibold text-white">
            Deployment behavior
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ToggleField
              checked={pullLatest}
              label="Pull latest"
              description="Fetch the latest launcher image before starting."
              onChange={setPullLatest}
            />
            <ToggleField
              checked={replaceExisting}
              label="Replace existing"
              description="Recreate an existing container with this name."
              onChange={setReplaceExisting}
            />
            <ToggleField
              checked={dryRun}
              label="Dry run"
              description="Generate the deployment plan without starting it."
              onChange={setDryRun}
            />
          </div>
        </section>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
        <section className="rounded-[8px] border border-cyan-200/15 bg-[#06111f]/75 p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur-2xl">
          <h2 className="text-xl font-semibold text-white">Request summary</h2>
          <div className="mt-5 space-y-4 text-sm leading-6 text-cyan-50/75">
            <SummaryRow label="Mode" value="Agent launcher" />
            <SummaryRow label="Profile" value={selectedProfile.label} />
            <SummaryRow label="Name" value={name.trim() || "Missing name"} />
            <SummaryRow
              label="Gateway"
              value={
                isValidPort(parsedGatewayPort)
                  ? `localhost:${parsedGatewayPort}`
                  : "Invalid port"
              }
            />
            <SummaryRow
              label="Launcher"
              value={
                isValidPort(parsedLauncherPort)
                  ? `localhost:${parsedLauncherPort}`
                  : "Invalid port"
              }
            />
            <SummaryRow
              label="Token"
              value={
                tokenMode === "auto"
                  ? "Auto-generated dashboard token"
                  : "Custom dashboard token"
              }
            />
            <SummaryRow label="Pull latest" value={pullLatest ? "Yes" : "No"} />
            <SummaryRow
              label="Replace existing"
              value={replaceExisting ? "Yes" : "No"}
            />
            <SummaryRow label="Dry run" value={dryRun ? "Yes" : "No"} />
          </div>

          {validationErrors.length > 0 ? (
            <div className="mt-5 rounded-[8px] border border-amber-200/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50/90">
              <div className="flex gap-2">
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <p>{validationErrors[0]}</p>
              </div>
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={!payload || isSubmitting}
            className="mt-6 h-11 w-full rounded-[8px] bg-white text-[#06111f] shadow-lg shadow-cyan-950/25 hover:bg-cyan-50"
          >
            {isSubmitting ? (
              <>
                <Loader2
                  aria-hidden="true"
                  data-icon="inline-start"
                  className="animate-spin"
                />
                Deploying
              </>
            ) : (
              <>
                <Rocket aria-hidden="true" data-icon="inline-start" />
                Submit deploy request
              </>
            )}
          </Button>

          {error ? (
            <div className="mt-5 rounded-[8px] border border-red-300/20 bg-red-400/10 p-4 text-sm leading-6 text-red-50">
              <div className="flex gap-2">
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <p>{error}</p>
              </div>
            </div>
          ) : null}
        </section>

        {success ? (
          <section className="rounded-[8px] border border-emerald-200/20 bg-emerald-300/10 p-5 shadow-2xl shadow-cyan-950/25 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-emerald-50">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
              <h2 className="text-xl font-semibold">
                {success.dryRun ? "Dry run ready" : "Deployment submitted"}
              </h2>
            </div>
            <div className="mt-5 space-y-4">
              <ResultField label="Agent name" value={success.name} />
              <ResultField
                label="Public URL"
                value={success.publicUrl || "No public URL returned"}
                href={success.publicUrl}
              />
              <ResultField
                label="Dashboard token"
                value={success.token || "No token returned"}
              />
              <ResultField
                label="Local launcher"
                value={`localhost:${success.launcherPort}`}
              />
            </div>
            <Button
              asChild
              variant="outline"
              className="mt-5 h-10 w-full rounded-[8px] border-emerald-200/20 bg-emerald-300/10 text-emerald-50 hover:bg-emerald-300/15"
            >
              <Link href="/compute/agent/deployments">
                <Server aria-hidden="true" data-icon="inline-start" />
                View deployments
              </Link>
            </Button>
          </section>
        ) : null}
      </aside>
    </form>
  );
}

function ToggleField({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-32 cursor-pointer flex-col justify-between rounded-[8px] border p-4 transition",
        checked
          ? "border-cyan-200/45 bg-cyan-300/10"
          : "border-white/10 bg-[#06111f]/45 hover:border-cyan-200/25"
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white">{label}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-cyan-300"
        />
      </span>
      <span className="mt-3 text-xs leading-5 text-cyan-50/60">
        {description}
      </span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <span className="text-cyan-50/45">{label}</span>
      <span className="max-w-[12rem] text-right font-medium text-cyan-50">
        {value}
      </span>
    </div>
  );
}

function ResultField({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-[#06111f]/50 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-50/55">
        {label}
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block break-all font-mono text-sm text-cyan-100 underline decoration-cyan-100/30 underline-offset-4"
        >
          {value}
        </a>
      ) : (
        <p className="mt-2 break-all font-mono text-sm text-cyan-50/90">
          {value}
        </p>
      )}
    </div>
  );
}
