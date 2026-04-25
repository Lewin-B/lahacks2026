import Image from "next/image";
import { ArrowRight, Droplet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="relative isolate min-h-screen overflow-hidden px-6 text-white">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.35),transparent_30%),linear-gradient(135deg,#06111f_0%,#0d2b3a_42%,#123f44_70%,#17351f_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-45 [background-image:linear-gradient(120deg,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:38px_88px]" />
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <span className="rain-line left-[8%] h-24 [animation-delay:0s]" />
        <span className="rain-line left-[18%] h-36 [animation-delay:.3s]" />
        <span className="rain-line left-[31%] h-28 [animation-delay:.7s]" />
        <span className="rain-line left-[49%] h-40 [animation-delay:1s]" />
        <span className="rain-line left-[63%] h-24 [animation-delay:.5s]" />
        <span className="rain-line left-[78%] h-36 [animation-delay:.2s]" />
        <span className="rain-line left-[91%] h-28 [animation-delay:.9s]" />
      </div>

      <Image
        aria-hidden="true"
        src="/water_drop.png"
        alt=""
        width={330}
        height={550}
        preload
        sizes="(max-width: 768px) 70vw, 360px"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[min(58vh,34rem)] w-auto -translate-x-1/2 -translate-y-1/2 opacity-20"
      />

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center py-24 text-center">
        <Badge
          variant="outline"
          className="border-white/15 bg-white/[0.07] px-3 py-1 text-cyan-50 shadow-sm shadow-cyan-950/30 backdrop-blur-md"
        >
          <Droplet aria-hidden="true" className="text-cyan-200" />
          Drip
        </Badge>

        <h1 className="mt-6 text-7xl font-semibold leading-none sm:text-8xl md:text-9xl">
          Drip
        </h1>

        <p className="mt-5 max-w-sm text-base leading-7 text-cyan-50/75 sm:text-lg">
          Burn tokens make water
        </p>

        <Button
          size="lg"
          variant="secondary"
          className="mt-9 rounded-full bg-white text-[#06111f] shadow-lg shadow-cyan-950/25 hover:bg-cyan-50"
        >
          Get started
          <ArrowRight aria-hidden="true" data-icon="inline-end" />
        </Button>
      </div>
    </section>
  );
}
