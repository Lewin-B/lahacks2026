"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  Globe2,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AgentDeployment = {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  mode: string;
  gateway_port?: number;
  launcher_port?: number;
  gateway_url?: string;
  launcher_url?: string;
  public_url?: string;
};

type DeploymentsResponse = {
  deployments?: AgentDeployment[];
  error?: string;
};

type DeleteDeploymentResponse = {
  deployment?: AgentDeployment;
  error?: string;
};

async function readDeployments(signal?: AbortSignal) {
  const response = await fetch("/api/deployments", {
    cache: "no-store",
    signal,
  });
  const data = (await response.json().catch(() => ({}))) as DeploymentsResponse;

  if (!response.ok) {
    throw new Error(
      data.error || `Deployment listing failed with status ${response.status}.`
    );
  }

  return data.deployments ?? [];
}

async function removeDeployment(identifier: string) {
  const response = await fetch(
    `/api/deployments/${encodeURIComponent(identifier)}`,
    {
      method: "DELETE",
      cache: "no-store",
    }
  );
  const data = (await response
    .json()
    .catch(() => ({}))) as DeleteDeploymentResponse;

  if (!response.ok) {
    throw new Error(
      data.error || `Deployment delete failed with status ${response.status}.`
    );
  }

  return data.deployment;
}

export default function DeploymentsView() {
  const [deployments, setDeployments] = useState<AgentDeployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingDeploymentId, setDeletingDeploymentId] = useState("");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDeployments = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setDeployments(await readDeployments());
      setLastUpdated(new Date());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Deployment listing failed."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteDeployment = useCallback(async (deployment: AgentDeployment) => {
    const identifier = deployment.id || deployment.name;
    setDeletingDeploymentId(identifier);
    setError("");

    try {
      await removeDeployment(identifier);
      setDeployments((currentDeployments) =>
        currentDeployments.filter(
          (currentDeployment) =>
            currentDeployment.id !== deployment.id &&
            currentDeployment.name !== deployment.name
        )
      );
      setLastUpdated(new Date());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Deployment delete failed."
      );
    } finally {
      setDeletingDeploymentId("");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadInitialDeployments() {
      try {
        const nextDeployments = await readDeployments(controller.signal);
        if (!isActive) {
          return;
        }
        setDeployments(nextDeployments);
        setLastUpdated(new Date());
      } catch (caughtError) {
        if (!isActive || controller.signal.aborted) {
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Deployment listing failed."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialDeployments();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const stats = useMemo(() => {
    const running = deployments.filter(
      (deployment) => deployment.state.toLowerCase() === "running"
    ).length;
    const publicCount = deployments.filter(
      (deployment) => deployment.public_url
    ).length;

    return {
      total: deployments.length,
      running,
      publicCount,
    };
  }, [deployments]);

  return (
    <>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Bot}
          label="Deployments"
          value={String(stats.total)}
        />
        <MetricCard
          icon={Server}
          label="Running"
          value={String(stats.running)}
        />
        <MetricCard
          icon={Globe2}
          label="Public tunnels"
          value={String(stats.publicCount)}
        />
      </section>

      <section className="mt-5 rounded-[8px] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-cyan-950/25 backdrop-blur-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Current deployments
            </h2>
            <p className="mt-1 text-sm text-cyan-50/55">
              {lastUpdated
                ? `Updated ${formatUpdatedAt(lastUpdated)}`
                : "Waiting for deployment server"}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => void fetchDeployments()}
            className="border-cyan-200/20 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/15"
          >
            {isLoading ? (
              <Loader2
                aria-hidden="true"
                data-icon="inline-start"
                className="animate-spin"
              />
            ) : (
              <RefreshCw aria-hidden="true" data-icon="inline-start" />
            )}
            Refresh
          </Button>
        </div>

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

        {isLoading && deployments.length === 0 ? (
          <LoadingRows />
        ) : deployments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-5 space-y-3">
            {deployments.map((deployment) => (
              <DeploymentCard
                key={deployment.id || deployment.name}
                deployment={deployment}
                isDeleting={
                  deletingDeploymentId === (deployment.id || deployment.name)
                }
                onDelete={deleteDeployment}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-[#06111f]/65 p-4 shadow-xl shadow-cyan-950/20 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-cyan-50/60">{label}</span>
        <Icon aria-hidden="true" className="h-4 w-4 text-cyan-200" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function DeploymentCard({
  deployment,
  isDeleting,
  onDelete,
}: {
  deployment: AgentDeployment;
  isDeleting: boolean;
  onDelete: (deployment: AgentDeployment) => void;
}) {
  const state = deploymentState(deployment.state);

  return (
    <article className="rounded-[8px] border border-white/10 bg-[#06111f]/55 p-4 shadow-lg shadow-cyan-950/15">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(13rem,0.8fr)_minmax(12rem,0.65fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden="true"
              className={cn("h-2.5 w-2.5 rounded-full", state.dotClassName)}
            />
            <h3 className="min-w-0 break-words text-lg font-semibold text-white">
              {deployment.name || "Unnamed deployment"}
            </h3>
            <Badge className="border-cyan-200/15 bg-cyan-300/10 text-cyan-100">
              {modeLabel(deployment.mode)}
            </Badge>
          </div>
          <p className="mt-2 break-all font-mono text-xs text-cyan-50/50">
            {shortId(deployment.id)} / {deployment.image || "Unknown image"}
          </p>
          <p className="mt-3 text-sm leading-6 text-cyan-50/70">
            {deployment.status || state.label}
          </p>
        </div>

        <div className="grid gap-2 text-sm">
          <EndpointRow
            label="Gateway"
            value={
              deployment.gateway_port
                ? `localhost:${deployment.gateway_port}`
                : "Not exposed"
            }
          />
          <EndpointRow
            label="Launcher"
            value={
              deployment.launcher_port
                ? `localhost:${deployment.launcher_port}`
                : "Not exposed"
            }
          />
          {deployment.public_url ? (
            <EndpointRow label="Public" value={deployment.public_url} />
          ) : null}
          <EndpointRow
            label="Created"
            value={formatCreatedAt(deployment.created)}
          />
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isDeleting}
            onClick={() => onDelete(deployment)}
            className="border-red-300/20 bg-red-400/10 text-red-50 hover:bg-red-400/20"
          >
            {isDeleting ? (
              <Loader2
                aria-hidden="true"
                data-icon="inline-start"
                className="animate-spin"
              />
            ) : (
              <Trash2 aria-hidden="true" data-icon="inline-start" />
            )}
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}

function EndpointRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] px-3 py-2">
      <span className="flex items-center gap-2 text-cyan-50/45">
        <Network aria-hidden="true" className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="break-all text-right font-mono text-cyan-50/75">
        {value}
      </span>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="mt-5 space-y-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-32 animate-pulse rounded-[8px] border border-white/10 bg-white/[0.045]"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-5 rounded-[8px] border border-white/10 bg-[#06111f]/55 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            No agent deployments found
          </h3>
          <p className="mt-1 text-sm leading-6 text-cyan-50/60">
            Docker did not return any Drip or Picoclaw agent containers.
          </p>
        </div>
        <Button
          asChild
          className="h-10 rounded-[8px] bg-white text-[#06111f] hover:bg-cyan-50"
        >
          <Link href="/compute/agent">
            <Plus aria-hidden="true" data-icon="inline-start" />
            Deploy agent
          </Link>
        </Button>
      </div>
    </div>
  );
}

function deploymentState(state: string) {
  switch (state.toLowerCase()) {
    case "running":
      return {
        label: "Running",
        dotClassName: "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.65)]",
      };
    case "created":
    case "restarting":
      return {
        label: titleCase(state),
        dotClassName: "bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.55)]",
      };
    case "exited":
    case "dead":
      return {
        label: titleCase(state),
        dotClassName: "bg-red-300 shadow-[0_0_16px_rgba(252,165,165,0.55)]",
      };
    default:
      return {
        label: state ? titleCase(state) : "Unknown",
        dotClassName: "bg-cyan-100/45",
      };
  }
}

function modeLabel(mode: string) {
  if (mode === "launcher") {
    return "Agent launcher";
  }
  if (mode === "gateway") {
    return "Gateway";
  }
  return mode || "Agent";
}

function shortId(id: string) {
  if (!id) {
    return "unknown-id";
  }
  return id.length > 12 ? id.slice(0, 12) : id;
}

function formatCreatedAt(created: number) {
  if (!created) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(created * 1000));
}

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
