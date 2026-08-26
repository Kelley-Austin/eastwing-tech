"use client";

import type { Lead, LeadResponse } from "@/lib/types";

/**
 * The Act 0 payoff: the record that wrote itself.
 *
 * Everything here was derived — nothing was typed into a labelled field. The
 * provenance lines matter more than the values; they're the proof.
 */
export default function LeadPanel({
  lead,
  delivery,
}: {
  lead: Lead;
  delivery: LeadResponse["delivery"];
}) {
  const bandColor =
    lead.intent.band === "Hot"
      ? "var(--accent)"
      : lead.intent.band === "Warm"
        ? "var(--signal)"
        : "var(--faint)";

  const fullName =
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Not captured";

  return (
    <div className="animate-rise rounded-xl border border-[var(--border-strong)] bg-[var(--background)] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--faint)]">
            Lead created
          </p>
          <p className="truncate font-mono text-sm text-[var(--foreground)]">
            {lead.id}
          </p>
        </div>
        <div
          className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium"
          style={{ color: bandColor, border: `1px solid ${bandColor}` }}
        >
          {lead.intent.band} · {lead.intent.score}
        </div>
      </div>

      <Section title="Contact">
        <Row label="Name" value={fullName} />
        <Row label="Title" value={lead.title ?? "Not captured"} />
        <Row label="Email" value={lead.email ?? "Not captured"} />
      </Section>

      <Section title="Firmographics" note={lead.firmographics.source}>
        <Row label="Company" value={lead.firmographics.company} />
        <Row label="Industry" value={lead.firmographics.industry} />
        <Row label="Employees" value={lead.firmographics.employees} />
        <Row label="Revenue" value={lead.firmographics.revenue} />
        <Row label="HQ" value={lead.firmographics.headquarters} />
        <Row label="Fleet" value={lead.firmographics.fleetSize} />
        <Row label="TMS" value={lead.firmographics.tmsInUse ?? "Unknown"} />
      </Section>

      <Section title="Intent" note={`Scored ${lead.intent.score}/100`}>
        <ul className="space-y-1">
          {lead.intent.reasons.map((r) => (
            <li
              key={r}
              className="flex gap-2 text-xs leading-relaxed text-[var(--muted)]"
            >
              <span className="text-[var(--signal)]">+</span>
              {r}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Routing" note={lead.routing.rationale}>
        <Row label="Owner" value={lead.routing.owner} />
        <Row label="Territory" value={lead.routing.territory} />
      </Section>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] pt-3 font-mono text-[10px] text-[var(--faint)]">
        <span>{lead.source}</span>
        <span aria-hidden>·</span>
        <span>
          {delivery.forwarded
            ? `forwarded${delivery.status ? ` (${delivery.status})` : ""}`
            : delivery.error
              ? `forward failed: ${delivery.error}`
              : "no downstream configured"}
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--faint)]">
        {title}
      </p>
      {children}
      {note && (
        <p className="mt-1.5 text-[11px] italic leading-snug text-[var(--faint)]">
          {note}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const missing = value === "Not matched" || value === "Not captured" || value === "Unknown";
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
      <span className="shrink-0 text-[var(--faint)]">{label}</span>
      <span
        className={`min-w-0 truncate text-right ${
          missing ? "text-[var(--faint)] italic" : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
