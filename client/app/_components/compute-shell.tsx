import type { ReactNode } from "react";
import Image from "next/image";
import { Droplet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ComputeShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

export default function ComputeShell({
  eyebrow,
  title,
  description,
  children,
  className,
}: ComputeShellProps) {
  return (
    <main className="relative isolate min-h-[100svh] overflow-hidden bg-[#06111f] px-6 pb-16 pt-28 text-white sm:pt-32">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_8%,rgba(56,189,248,0.32),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(34,197,94,0.16),transparent_24%),linear-gradient(135deg,#06111f_0%,#0d2b3a_44%,#123f44_72%,#17351f_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-35 [background-image:linear-gradient(120deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:38px_88px]" />
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <span className="rain-line left-[7%] h-28 [animation-delay:0s]" />
        <span className="rain-line left-[19%] h-40 [animation-delay:.4s]" />
        <span className="rain-line left-[36%] h-24 [animation-delay:.8s]" />
        <span className="rain-line left-[52%] h-44 [animation-delay:.2s]" />
        <span className="rain-line left-[69%] h-28 [animation-delay:.7s]" />
        <span className="rain-line left-[84%] h-36 [animation-delay:.1s]" />
        <span className="rain-line left-[94%] h-24 [animation-delay:1s]" />
      </div>

      <Image
        aria-hidden="true"
        src="/water_drop.png"
        alt=""
        width={330}
        height={550}
        sizes="(max-width: 768px) 66vw, 360px"
        className="pointer-events-none absolute right-[-3rem] top-32 -z-10 h-[min(52vh,31rem)] w-auto opacity-15 sm:right-[8%]"
      />

      <div className={cn("mx-auto max-w-5xl", className)}>
        <div className="max-w-2xl">
          <Badge
            variant="outline"
            className="border-white/15 bg-white/[0.07] px-3 py-1 text-cyan-50 shadow-sm shadow-cyan-950/30 backdrop-blur-md"
          >
            <Droplet aria-hidden="true" className="text-cyan-200" />
            {eyebrow}
          </Badge>
          <h1 className="mt-6 text-5xl font-semibold leading-[0.96] text-white sm:text-6xl md:text-7xl">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-cyan-50/75 sm:text-lg">
            {description}
          </p>
        </div>

        {children}
      </div>
    </main>
  );
}
