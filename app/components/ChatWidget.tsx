"use client";

import { useEffect, useRef, useState } from "react";
import { GREETING, SUGGESTED_PROMPTS } from "@/lib/copy";
import { parseOffer, type Slot } from "@/lib/slots";
import type { ChatResponse, Message } from "@/lib/types";

type Phase = "chatting" | "capturing" | "creating" | "done";

/** Typing delay, so answers land like a person is on the other end. */
const THINKING_MS = 700;

export default function ChatWidget() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "agent", content: GREETING },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [phase, setPhase] = useState<Phase>("chatting");
  const [signals, setSignals] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Agent API session, carried across turns so the agent keeps context. */
  const [sessionId, setSessionId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const leadCreatedRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  const busy = thinking || phase === "creating";

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setError(null);
    setDraft("");

    const withVisitor: Message[] = [
      ...messages,
      { role: "visitor", content: trimmed },
    ];
    setMessages(withVisitor);

    // Scripted-fallback path only: we asked for her details explicitly, so this
    // turn is the answer. See createLead for why this path still writes a Lead.
    if (phase === "capturing") {
      await createLead(withVisitor);
      return;
    }

    setThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: messages, message: trimmed, sessionId }),
      });
      if (!res.ok) throw new Error(`Agent returned ${res.status}`);
      const data: ChatResponse = await res.json();

      setSessionId(data.sessionId);
      setSignals((s) => [...s, ...data.signals]);
      setTopics((t) => [...t, ...data.groundedIn]);

      await pause(THINKING_MS);

      setMessages((m) => [...m, { role: "agent", content: data.reply }]);

      // On the live path the Salesforce agent creates the Lead itself, so we do
      // nothing here — a second record would just compete with the real one.
      if (data.readyToCapture && data.capturePrompt) {
        await pause(500);
        setMessages((m) => [
          ...m,
          { role: "agent", content: data.capturePrompt! },
        ]);
        setPhase("capturing");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong reaching the agent."
      );
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  /**
   * Writes a Lead from this app — reached only on the scripted fallback path.
   *
   * Salesforce owns Lead creation whenever the Agent API is answering. This
   * exists purely so an Agent API outage doesn't silently throw away a real
   * enquiry: the two paths are mutually exclusive, so no duplicate is possible.
   */
  async function createLead(transcript: Message[]) {
    if (leadCreatedRef.current) return;
    leadCreatedRef.current = true;

    setPhase("creating");
    try {
      const identityText = transcript
        .filter((m) => m.role === "visitor")
        .map((m) => m.content)
        .join("\n");

      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityText, signals, topics, transcript }),
      });
      if (!res.ok) throw new Error(`Lead creation returned ${res.status}`);

      await pause(THINKING_MS);
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          content:
            "Thanks — that's everything I need. Someone will be in touch shortly.",
        },
      ]);
      setPhase("done");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong saving your details."
      );
      leadCreatedRef.current = false;
      setPhase("capturing");
    }
  }

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-4">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-2 rounded-full bg-[var(--signal)] opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--signal)]" />
          </span>
          <p className="truncate text-sm font-medium">Eastwing assistant</p>
        </div>

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="h-[26rem] space-y-4 overflow-y-auto px-5 py-5"
          aria-live="polite"
        >
          {messages.map((m, i) => {
            if (m.role !== "agent") {
              return <Bubble key={i} role="visitor" content={m.content} />;
            }

            // Lift any offered times out of the prose so they render as taps
            // rather than a wall of text. Historical messages keep the cleaned
            // text but lose the buttons — only the latest offer is actionable.
            const offer = parseOffer(m.content);
            const isLatest = i === messages.length - 1;

            return (
              <div key={i} className="space-y-2">
                <Bubble role="agent" content={offer.text} />
                {isLatest && !thinking && offer.slots.length > 0 && (
                  <SlotPicker
                    slots={offer.slots}
                    disabled={busy || phase === "done"}
                    onPick={(slot) => send(slot.label)}
                  />
                )}
              </div>
            );
          })}

          {thinking && (
            <div className="flex gap-1.5 px-1" aria-label="Assistant is typing">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="dot size-1.5 rounded-full bg-[var(--faint)]"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Suggested prompts — only before the visitor has said anything */}
        {messages.length === 1 && !thinking && (
          <div className="flex flex-wrap gap-2 px-5 pb-4">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-left text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="border-t border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3"
        >
          {error && (
            <p className="mb-2 font-mono text-xs text-[var(--alert)]">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={phase === "done" || busy}
              placeholder={
                phase === "capturing"
                  ? "Your name, work email, and role"
                  : phase === "done"
                    ? "Thanks — we have what we need."
                    : "Ask about integrations, pricing, timelines…"
              }
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--faint)] disabled:cursor-not-allowed"
              aria-label="Your message"
            />
            <button
              type="submit"
              disabled={!draft.trim() || busy || phase === "done"}
              className="shrink-0 rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition-opacity disabled:opacity-30"
            >
              {phase === "creating" ? "Working…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Renders offered times as buttons. Tapping one sends its exact label back as
 * the visitor's message, so the agent receives precisely the text it offered
 * and the conversation stays consistent with what it planned.
 */
function SlotPicker({
  slots,
  disabled,
  onPick,
}: {
  slots: Slot[];
  disabled: boolean;
  onPick: (slot: Slot) => void;
}) {
  return (
    <div className="animate-rise max-w-[85%] space-y-1.5 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-2.5">
      <p className="px-1 pb-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--faint)]">
        Choose a time
      </p>
      {slots.map((slot) => (
        <button
          key={slot.label}
          onClick={() => onPick(slot)}
          disabled={disabled}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left text-sm transition-colors hover:border-[var(--accent)] hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="min-w-0 truncate">{slot.label}</span>
          <span aria-hidden className="shrink-0 text-[var(--accent)]">
            →
          </span>
        </button>
      ))}
    </div>
  );
}

function Bubble({ role, content }: { role: Message["role"]; content: string }) {
  const isAgent = role === "agent";
  return (
    <div
      className={`animate-rise flex ${isAgent ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isAgent
            ? "bg-[var(--surface-raised)] text-[var(--foreground)]"
            : "bg-[var(--accent)] text-[var(--accent-fg)]"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
