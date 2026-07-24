import { FeatureGrid } from "@/components/marketing/feature-grid";
import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";

export default function MarketingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <BackgroundGlow />
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <FeatureGrid />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <p className="text-sm font-semibold tracking-tight">LifeOS</p>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} LifeOS. One home for your whole life.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Soft ambient gradients behind the whole page (pure CSS, zero JS). */
function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-40 left-1/2 h-[34rem] w-[54rem] -translate-x-1/2 rounded-full bg-glow-primary blur-2xl" />
      <div className="absolute top-[38rem] -left-40 h-[28rem] w-[38rem] rounded-full bg-glow-cyan blur-2xl" />
      <div className="absolute top-[52rem] -right-40 h-[28rem] w-[38rem] rounded-full bg-glow-green blur-2xl" />
    </div>
  );
}
