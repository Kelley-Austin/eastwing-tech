import ChatLauncher from "./components/ChatLauncher";

const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

/**
 * Every customer name here is fictional, as is Eastwing itself. The TMS and ELD
 * names are real products and appear only as stated integrations — the same
 * claim the agent makes in conversation.
 */
const CUSTOMERS = [
  "Northwind Logistics",
  "Meridian Freight",
  "Calder Transport",
  "Vantage 3PL",
  "Harbor Line",
];

const METRICS = [
  { value: "12–18%", label: "fewer empty miles" },
  { value: "~30%", label: "less time planning" },
  { value: "6–9 pts", label: "on-time delivery" },
  { value: "6–8 wks", label: "to production" },
];

const FEATURES = [
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

const STEPS = [
  {
    n: "01",
    title: "Connect your TMS",
    body: "A certified connector goes in during week one. Loads, stops, and status start flowing both directions.",
  },
  {
    n: "02",
    title: "Shadow-run the plan",
    body: "Eastwing plans alongside your dispatchers for two weeks. They see it's sound before anyone trusts it with a truck.",
  },
  {
    n: "03",
    title: "Roll out by terminal",
    body: "Go live one terminal at a time. No big-bang cutover, no weekend where dispatch stops working.",
  },
];

const INTEGRATIONS = [
  "McLeod PowerBroker",
  "Trimble TMW",
  "MercuryGate",
  "Oracle OTM",
  "SAP TM",
  "Descartes",
  "Samsara",
  "Motive",
  "Geotab",
];

const NAV = ["Platform", "Integrations", "Customers", "Pricing", "Resources"];

const FOOTER = [
  { heading: "Product", links: ["Platform", "Dispatch planner", "Integrations", "Security", "Pricing"] },
  { heading: "Solutions", links: ["Truckload", "LTL", "Final mile", "3PL & brokerage", "Private fleet"] },
  { heading: "Company", links: ["About", "Customers", "Careers", "Newsroom", "Contact"] },
  { heading: "Resources", links: ["Documentation", "API reference", "Implementation guide", "Status", "Support"] },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Header />

      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <Metrics />
        <Features />
        <HowItWorks />
        <Integrations />
        <Testimonial />
        <CallToAction />
      </main>

      <Footer />
      <ChatLauncher />
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="size-5 shrink-0 rounded-sm bg-[var(--accent)]"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 60%, 0 100%)" }}
        aria-hidden
      />
      <span className="text-sm font-semibold tracking-tight">Eastwing Tech</span>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
        <Logo />
        <nav className="hidden flex-1 items-center gap-7 text-sm text-[var(--muted)] lg:flex">
          {NAV.map((item) => (
            <a
              key={item}
              href="#"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              {item}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <a
            href="#"
            className="hidden text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)] sm:block"
          >
            Sign in
          </a>
          <a
            href="#"
            className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90"
          >
            Book a demo
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b border-[var(--border)]">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:py-28">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
            Dispatch automation for freight
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Your dispatchers should approve the plan,
            <span className="text-[var(--muted)]"> not build it.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
            Eastwing builds the daily assignment from your loads, equipment,
            hours-of-service, and live ETAs — then re-plans continuously as
            conditions change. It connects to the TMS you already run.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#"
              className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90"
            >
              Book a demo
            </a>
            <a
              href="#how"
              className="rounded-lg border border-[var(--border-strong)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)]"
            >
              See how it works
            </a>
          </div>

          <p className="mt-6 text-xs text-[var(--faint)]">
            SOC 2 Type II · US &amp; EU data residency · Connector live in under two weeks
          </p>
        </div>

        <DispatchBoard />
      </div>
    </section>
  );
}

/**
 * Stylised product view. Built from markup rather than a screenshot so it stays
 * crisp on a projector and needs no image assets.
 */
function DispatchBoard() {
  const rows = [
    { id: "LD-4821", lane: "Columbus → Indianapolis", driver: "R. Mata", hours: "6h 20m", status: "Assigned" },
    { id: "LD-4822", lane: "Toledo → Detroit", driver: "K. Osei", hours: "4h 05m", status: "Assigned" },
    { id: "LD-4823", lane: "Dayton → Louisville", driver: "—", hours: "—", status: "Re-planning" },
    { id: "LD-4824", lane: "Akron → Pittsburgh", driver: "J. Vance", hours: "8h 45m", status: "Assigned" },
    { id: "LD-4825", lane: "Cleveland → Buffalo", driver: "—", hours: "—", status: "Needs approval" },
  ];

  const tone: Record<string, string> = {
    Assigned: "text-[var(--signal)] border-[var(--signal)]",
    "Re-planning": "text-[var(--accent)] border-[var(--accent)]",
    "Needs approval": "text-[var(--alert)] border-[var(--alert)]",
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
        <p className="text-sm font-medium">Today · Columbus terminal</p>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--faint)]">
          <span className="size-1.5 rounded-full bg-[var(--signal)]" />
          Live
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] font-mono text-[10px] uppercase tracking-wider text-[var(--faint)]">
              <th className="px-4 py-2.5 font-normal">Load</th>
              <th className="px-4 py-2.5 font-normal">Lane</th>
              <th className="px-4 py-2.5 font-normal">Driver</th>
              <th className="px-4 py-2.5 font-normal">HOS left</th>
              <th className="px-4 py-2.5 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--muted)]">{r.id}</td>
                <td className="whitespace-nowrap px-4 py-3">{r.lane}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">{r.driver}</td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--muted)]">{r.hours}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${tone[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 font-mono text-[10px] text-[var(--faint)]">
        Re-planned 14 seconds ago · 2 exceptions awaiting approval
      </div>
    </div>
  );
}

function TrustStrip() {
  return (
    <section className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--faint)]">
          Moving freight for
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {CUSTOMERS.map((name) => (
            <span
              key={name}
              className="text-sm font-medium tracking-tight text-[var(--muted)]"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metrics() {
  return (
    <section className="border-b border-[var(--border)]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 sm:grid-cols-4">
        {METRICS.map((m) => (
          <div key={m.label}>
            <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {m.value}
            </p>
            <p className="mt-1.5 text-xs leading-snug text-[var(--faint)]">
              {m.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Built for the way dispatch actually breaks
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <h3 className="text-sm font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Live in six to eight weeks
        </h2>
        <p className="mt-3 max-w-xl text-[var(--muted)]">
          Nobody replaces their dispatch system over a weekend. Eastwing goes in
          beside what you run today.
        </p>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <p className="font-mono text-xs text-[var(--accent)]">{s.n}</p>
              <h3 className="mt-3 text-sm font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--muted)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Integrations() {
  return (
    <section className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Works with your stack
            </h2>
            <p className="mt-4 text-[var(--muted)]">
              Certified two-way connectors for the major transportation
              management and telematics platforms, plus a REST API for anything
              homegrown. Typical connector stand-up is under two weeks.
            </p>
          </div>
          <div className="flex flex-wrap content-start gap-2.5">
            {INTEGRATIONS.map((name) => (
              <span
                key={name}
                className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]"
              >
                {name}
              </span>
            ))}
            <span className="rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--faint)]">
              REST API
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonial() {
  return (
    <section className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <blockquote className="text-xl font-medium leading-relaxed tracking-tight sm:text-2xl">
          “We stopped building the board every morning. My dispatchers spend
          their day on the exceptions that actually need a human, and on-time
          delivery moved seven points in a quarter.”
        </blockquote>
        <p className="mt-6 text-sm text-[var(--muted)]">
          Priya Chen · VP of Operations, Northwind Logistics
        </p>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] px-8 py-12 text-center sm:px-14">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            See it planned against your own loads
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
            We&apos;ll run a week of your historical dispatch through Eastwing and
            show you what it would have done differently.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#"
              className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90"
            >
              Book a demo
            </a>
            <a
              href="#"
              className="rounded-lg border border-[var(--border-strong)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--accent)]"
            >
              Talk to sales
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-[var(--faint)]">
              Dispatch and transportation operations, automated end to end.
            </p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.heading}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--faint)]">
                {col.heading}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-6 font-mono text-[11px] text-[var(--faint)]">
          <span>© 2026 Eastwing Tech — demo environment</span>
          <span>build {commit}</span>
        </div>
      </div>
    </footer>
  );
}
