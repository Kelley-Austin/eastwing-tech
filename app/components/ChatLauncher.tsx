"use client";

import { useEffect, useState } from "react";
import ChatWidget from "./ChatWidget";

/**
 * Floating chat launcher — the placement real sites use.
 *
 * Purely presentational: it positions and shows/hides `ChatWidget` without
 * touching how the widget works.
 *
 * Once opened, the widget stays mounted and is hidden with CSS rather than
 * unmounted. Unmounting would abort an in-flight agent turn and throw away the
 * Agent API session mid-request, so hiding is the safe way to close.
 */
export default function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [teaser, setTeaser] = useState(false);

  useEffect(() => {
    if (everOpened) return;
    const t = setTimeout(() => setTeaser(true), 2200);
    return () => clearTimeout(t);
  }, [everOpened]);

  // Escape closes the panel, as with any dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    setOpen((v) => !v);
    setEverOpened(true);
    setTeaser(false);
  }

  return (
    <>
      {/* Panel */}
      {everOpened && (
        <div
          className={`fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-[26rem] sm:right-6 ${
            open ? "animate-panel" : "hidden"
          }`}
          role="dialog"
          aria-label="Chat with the Eastwing assistant"
        >
          <ChatWidget onClose={() => setOpen(false)} />
        </div>
      )}

      {/* Teaser */}
      {teaser && !open && (
        <button
          onClick={toggle}
          className="animate-rise fixed bottom-24 right-4 z-40 max-w-[16rem] rounded-2xl rounded-br-md border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-left text-sm text-[var(--foreground)] shadow-xl shadow-black/40 sm:right-6"
        >
          Questions about dispatch, pricing, or your TMS? Ask me — no form.
        </button>
      )}

      {/* Launcher button */}
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? "Close chat" : "Open chat"}
        className={`fixed bottom-6 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] shadow-xl shadow-black/50 transition-transform hover:scale-105 active:scale-95 sm:right-6 ${
          !everOpened ? "animate-halo" : ""
        }`}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>
    </>
  );
}

function ChatIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
