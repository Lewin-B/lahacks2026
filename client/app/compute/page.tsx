import Link from "next/link";
import { ArrowRight, Bot, Cpu, Sparkles } from "lucide-react";

import ComputeShell from "../_components/compute-shell";
import { Badge } from "@/components/ui/badge";

export default function ComputePage() {
  return (
    <ComputeShell
      eyebrow="Compute"
      title="Choose your compute flow"
      description="Start with a guided Agent deployment today. LLM hosting stays visible as the next path in the Drip compute roadmap."
    >
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <Link
          href="/compute/agent"
          className="group flex min-h-[19rem] flex-col justify-between rounded-[8px] border border-cyan-200/20 bg-white/[0.075] p-6 shadow-2xl shadow-cyan-950/25 backdrop-blur-2xl transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-white/[0.105] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45"
        >
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-cyan-100/15 bg-cyan-300/10 text-cyan-100 shadow-lg shadow-cyan-950/20">
                <Bot aria-hidden="true" className="h-6 w-6" />
              </div>
              <Badge className="border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                Active
              </Badge>
            </div>
            <h2 className="mt-7 text-3xl font-semibold leading-tight text-white">
              Agent
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-cyan-50/70">
              Launch a Picoclaw agent container with controlled ports, token
              handling, image pull, replacement, and dry-run behavior.
            </p>
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5 text-sm font-medium text-cyan-100">
            Configure deployment
            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
            />
          </div>
        </Link>

        <div
          aria-disabled="true"
          className="flex min-h-[19rem] flex-col justify-between rounded-[8px] border border-white/10 bg-white/[0.04] p-6 opacity-75 shadow-2xl shadow-cyan-950/15 backdrop-blur-2xl"
        >
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.055] text-cyan-50/70">
                <Cpu aria-hidden="true" className="h-6 w-6" />
              </div>
              <Badge
                variant="outline"
                className="border-white/15 bg-white/[0.05] text-cyan-50/65"
              >
                Coming soon
              </Badge>
            </div>
            <h2 className="mt-7 text-3xl font-semibold leading-tight text-white/70">
              LLMs
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-cyan-50/55">
              Provision dedicated model endpoints through the same guided Drip
              compute experience once LLM deployments are ready.
            </p>
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5 text-sm font-medium text-cyan-50/50">
            Roadmap path
            <Sparkles aria-hidden="true" className="h-4 w-4" />
          </div>
        </div>
      </div>
    </ComputeShell>
  );
}
