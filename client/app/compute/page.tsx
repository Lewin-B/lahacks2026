import Link from "next/link";
import { ArrowRight, Bot, Cpu, Sparkles } from "lucide-react";

import ComputeShell from "../_components/compute-shell";
import { Badge } from "@/components/ui/badge";

export default function ComputePage() {
  return (
    <ComputeShell
      eyebrow="Compute"
      title="Choose your compute flow"
      description="Deploy PicoClaw agents with your choice of inference backend, or chat directly with AI models."
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

        <Link
          href="/chat"
          className="group flex min-h-[19rem] flex-col justify-between rounded-[8px] border border-cyan-200/20 bg-white/[0.075] p-6 shadow-2xl shadow-cyan-950/25 backdrop-blur-2xl transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-white/[0.105] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45"
        >
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-cyan-100/15 bg-cyan-300/10 text-cyan-100 shadow-lg shadow-cyan-950/20">
                <Cpu aria-hidden="true" className="h-6 w-6" />
              </div>
              <Badge className="border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                Active
              </Badge>
            </div>
            <h2 className="mt-7 text-3xl font-semibold leading-tight text-white">
              Chat
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-cyan-50/70">
              Chat with AI models directly - use your local Gemma running on ASUS
              or connect to external providers like OpenAI and Google.
            </p>
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5 text-sm font-medium text-cyan-100">
            Start chatting
            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
            />
          </div>
        </Link>
      </div>
    </ComputeShell>
  );
}
