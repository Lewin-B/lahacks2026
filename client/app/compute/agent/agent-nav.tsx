import Link from "next/link";
import { ListChecks, Rocket } from "lucide-react";

import { cn } from "@/lib/utils";

type AgentNavProps = {
  active: "deploy" | "deployments";
};

const navItems = [
  {
    id: "deploy",
    label: "Deploy",
    href: "/compute/agent",
    icon: Rocket,
  },
  {
    id: "deployments",
    label: "Deployments",
    href: "/compute/agent/deployments",
    icon: ListChecks,
  },
] as const;

export default function AgentNav({ active }: AgentNavProps) {
  return (
    <div className="mt-10 inline-flex rounded-[8px] border border-white/10 bg-[#06111f]/70 p-1 shadow-xl shadow-cyan-950/25 backdrop-blur-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;

        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-10 min-w-32 items-center justify-center gap-2 rounded-[7px] px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/35",
              isActive
                ? "bg-cyan-300/15 text-cyan-50 shadow-sm shadow-cyan-950/20"
                : "text-cyan-50/55 hover:bg-white/[0.055] hover:text-cyan-50"
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
