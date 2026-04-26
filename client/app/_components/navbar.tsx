import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Navbar() {
  const navItems = [
    { label: "Compute", href: "/compute" },
    { label: "Water", href: "/" },
    { label: "Impact", href: "/" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-5 py-5">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex h-12 max-w-5xl items-center justify-between rounded-2xl border border-white/[0.06] bg-[#030c17]/75 px-2 backdrop-blur-2xl"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.03) inset, 0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 60px -12px rgba(0,0,0,0.8), 0 0 40px -8px rgba(14,165,233,0.08)",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all duration-200 hover:bg-white/[0.04] outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
        >
          <Image
            src="/water_drop.png"
            alt="Drip logo"
            width={330}
            height={550}
            loading="eager"
            fetchPriority="high"
            sizes="24px"
            className="h-6 w-auto shrink-0 opacity-90 group-hover:opacity-100 transition-opacity"
            style={{ filter: "drop-shadow(0 0 8px rgba(56,189,248,0.4))" }}
          />
          <span className="text-sm font-semibold tracking-wide text-white/90 group-hover:text-white transition-colors">
            drip
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden items-center md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="relative px-4 py-1.5 text-[13px] font-medium text-white/40 transition-colors duration-150 hover:text-white/80 outline-none focus-visible:text-white/80"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/compute"
          className="group flex items-center gap-1.5 rounded-xl bg-sky-500/10 border border-sky-400/20 px-3.5 py-1.5 text-[13px] font-medium text-sky-300 transition-all duration-200 hover:bg-sky-500/20 hover:border-sky-400/30 hover:text-sky-200 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
        >
          Get started
          <ArrowRight
            className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
            aria-hidden="true"
          />
        </Link>
      </nav>
    </header>
  );
}
