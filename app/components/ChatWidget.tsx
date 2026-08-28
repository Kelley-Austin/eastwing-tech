"use client";

import { useEffect, useRef, useState } from "react";
import { GREETING, SUGGESTED_PROMPTS } from "@/lib/copy";
import type { ChatResponse, LeadResponse, Message } from "@/lib/types";

type Phase = "chatting" | "capturing" | "creating" | "done";

/** Typing delay, so answers land like a person is on the other end. */
const THINKING_MS = 700;

/**
 * The live Salesforce agent asks for identity in its own words, at a moment we
 * don't control. So rather than gating on our own capture prompt, treat an
 * email address appearing in the visitor's message as the signal to create the
 * Lead. Works identically for the scripted path.
 */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

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
  /**
   * Guards against a second Lead if she mentions another email later. A ref,
   * not state, because the check and the set happen inside one async turn where
   * a state update wouldn't have landed yet.
   */
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

    // Scripted path: we asked explicitly, so this turn is the answer.
    if (phase === "capturing") {
      await createLead(trimmed, withVisitor);
      return;
    }

    // Live-agent path: she volunteered an email in reply to the agent's own
    // request. Let the agent answer naturally, then write the Lead.
    const identityTurn = EMAIL_RE.test(trimmed);

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

      if (identityTurn && !leadCreatedRef.current) {
        // The agent already closed in its own words; just reveal the record and
        // leave the conversation open.
        await createLead(
          trimmed,
          [...withVisitor, { role: "agent", content: data.reply }],
          { announce: data.source === "scripted", end: false }
        );
        return;
      }

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
   * `announce` writes our own closing line, and `end` closes the conversation.
   * Both are false on the live-agent path: the agent has already acknowledged
   * her details in its own words and often offers to book a call, so adding our
   * closing would both repeat it and contradict the offer — while disabling the
   * input would stop her accepting it.
   */
  async function createLead(
    identityText: string,
    transcript: Message[],
    { announce = true, end = true }: { announce?: boolean; end?: boolean } = {}
  ) {
    if (leadCreatedRef.current) return;
    leadCreatedRef.current = true;

    if (end) setPhase("creating");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityText,
          signals,
          topics,
          transcript,
        }),
      });
      if (!res.ok) throw new Error(`Lead creation returned ${res.status}`);
      const data: LeadResponse = await res.json();

      if (announce) {
        await pause(THINKING_MS);
        setMessages((m) => [
          ...m,
          {
            role: "agent",
            content: `Thanks${
              data.lead.firstName ? `, ${data.lead.firstName}` : ""
            } — that's everything I need. ${
              data.lead.routing.owner.startsWith("Unassigned")
                ? "I've put this in the routing queue and someone will pick it up shortly."
                : `${data.lead.routing.owner} covers ${data.lead.routing.territory} and will reach out shortly.`
            } You can close the tab; nothing else is needed from you.`,
          },
        ]);
      }

      // The record is created server-side and lives in Salesforce, not here.
      // Nothing about it is rendered in the chat: the visitor's surface stays a
      // conversation, and the record belongs on the second screen.
      if (end) setPhase("done");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong creating the lead."
      );
      // Allow a retry — the visitor's details were never recorded.
      leadCreatedRef.current = false;
      if (end) setPhase("capturing");
    }
  }

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-2 rounded-full bg-[var(--signal)] opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--signal)]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Eastwing assistant</p>
            <p className="truncate font-mono text-[11px] text-[var(--faint)]">
              headless · no sign-in required
            </p>
          </div>
        </div>

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="h-[26rem] space-y-4 overflow-y-auto px-5 py-5"
          aria-live="polite"
        >
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}

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
                  ? "Priya Chen, VP of Operations at Northwind Logistics, priya@northwindlogistics.com"
                  : phase === "done"
                    ? "Conversation ended — the lead already exists."
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

      <p className="mt-3 text-center font-mono text-[11px] text-[var(--faint)]">
        No form fields. No sign-in. The record is written when the conversation ends.
      </p>
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
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
