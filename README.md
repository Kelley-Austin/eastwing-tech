# Eastwing Tech

Act 0 of the **Self-Driving CRM** demo — the conversational website that replaces
the contact form. A visitor asks a real question in plain language; a headless
site agent answers it, enriches her firmographics, scores intent, and creates the
Lead before she closes the tab. No human opens Salesforce.

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS 4
- TypeScript
- Deployed on Vercel

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deployment

Pushes to `main` deploy to production automatically via the Vercel GitHub
integration. Pull requests get preview deployments.

- Repo: https://github.com/Kelley-Austin/eastwing-tech
- Production: https://eastwing-tech.vercel.app
- Vercel project: `perficient4/eastwing-tech`

The home page prints the deployed branch and commit SHA, which is the quickest
way to confirm a given commit actually reached production.

## How Act 0 works

The hero CTA is a conversation, not a form.

1. `app/components/ChatWidget.tsx` posts each visitor turn to `/api/chat`.
2. `lib/agent.ts` matches the message against `lib/knowledge.ts` and answers
   from it. The corpus is `server-only`, so it never ships to the browser.
3. After two substantive exchanges the agent asks who she is, in one open
   question — no labelled fields.
4. `/api/lead` extracts identity from that free text, enriches firmographics,
   scores intent, routes by territory, and returns the finished Lead.

### Swap points

Both stubs are deliberately isolated, so replacing them is configuration, not
a rewrite:

| To make real | Change |
| --- | --- |
| The agent | `respond()` in `lib/agent.ts` — call the Salesforce Agent API instead of matching locally. Credentials stay server-side. |
| The Lead write | Set `LEAD_WEBHOOK_URL` (and optionally `LEAD_WEBHOOK_TOKEN`). Absent them, forwarding is a no-op and the demo still works fully. |
| Enrichment | `enrich()` in `lib/enrichment.ts` — swap the fixtures for Data 360. |

### Deliberate demo choices

- **Deterministic agent.** No live LLM call, so nothing can fail on stage.
- **Scores don't saturate.** A strong four-topic conversation lands around 73,
  not 100 — a maxed-out score reads as rigged.
- **Unknown companies stay empty.** Unmatched domains return `Not matched`
  rather than invented revenue, which an audience would catch.
- **The agent admits ignorance** instead of bluffing on unknown questions.

### Not built yet

The `Times a human opened Salesforce: 0` counter and the simulated right-hand
record pane. Both are additive and don't change what exists.
