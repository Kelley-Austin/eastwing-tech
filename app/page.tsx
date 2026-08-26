import ChatWidget from "./components/ChatWidget";

const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

const CAPABILITIES = [
  {
    title: "Continuous re-planning",
    body: "The board rebuilds itself as loads slip, drivers run out of hours, and weather moves. Dispatchers approve exceptions instead of redrawing the plan.",
  },
  {
    title: "Hours-aware assignment",
    body: "Every assignment respects the hours a driver actually has left, pulled live from your ELD — not what was available at the morning meeting.",
  },
  {
    title: "Your TMS stays the record",
    body: "Certified two-way connectors mean Eastwing decides the dispatch and your TMS keeps the book. No rip-and-replace, no parallel source of truth.",
  },
];

const METRICS = [
  { value: "12–18%", label: "fewer empty miles" },
  { value: "~30%", label: "less time planning" },
  { value: "6–9 pts", label: "on-time delivery" },
  { value: "6–8 wks", label: "to production" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div
              className="size-5 rounded-sm bg-[var(--accent)]"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 60%, 0 100%)" }}
              aria-hidden
            />
            <span className="text-sm font-semibold tracking-tight">
              Eastwing Tech
            </span>
          </div>
          <nav className="hidden gap-7 text-sm text-[var(--muted)] sm:flex">
            <span>Platform</span>
            <span>Integrations</span>
            <span>Customers</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* Hero: copy left, conversation right. The conversation IS the CTA. */}
        <section className="grid gap-12 py-16 lg:grid-cols-[1fr_28rem] lg:gap-16 lg:py-24">
          <div className="flex flex-col justify-center">
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
              Dispatch automation for freight
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Your dispatchers should approve the plan,
              <span className="text-[var(--muted)]"> not build it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
              Eastwing builds the daily assignment from your loads, equipment,
              hours-of-service, and live ETAs — then re-plans continuously as
              conditions change. It connects to the TMS you already run.
            </p>

            <dl className="mt-10 grid max-w-lg grid-cols-2 gap-6 sm:grid-cols-4">
              {METRICS.map((m) => (
                <div key={m.label}>
                  <dt className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                    {m.value}
                  </dt>
                  <dd className="mt-1 text-xs leading-snug text-[var(--faint)]">
                    {m.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col justify-center">
            <ChatWidget />
          </div>
        </section>

        <section className="grid gap-8 border-t border-[var(--border)] py-16 sm:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div key={c.title}>
              <h2 className="text-sm font-semibold tracking-tight">{c.title}</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--muted)]">
                {c.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 font-mono text-[11px] text-[var(--faint)]">
          <span>Eastwing Tech — demo environment</span>
          <span>build {commit}</span>
        </div>
      </footer>
    </div>
  );
}
