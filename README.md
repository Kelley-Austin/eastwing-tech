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

### Environment variables

All server-side only. Never prefix with `NEXT_PUBLIC_`.

| Var | Required | Purpose |
| --- | --- | --- |
| `SF_MY_DOMAIN_URL` | yes | My Domain root, e.g. `https://xxx.my.salesforce.com`. Not `lightning.force.com`. |
| `SF_CLIENT_ID` | yes | External Client App consumer key |
| `SF_CLIENT_SECRET` | yes | ECA consumer secret |
| `SF_AGENT_ID` | yes | 18-char agent id from the agent detail page URL |
| `SF_API_BASE` | no | Defaults to `https://api.salesforce.com/einstein/ai-agent/v1` |
| `SF_BYPASS_USER` | no | Defaults `true`. Set `false` to run as the ECA Run As user instead of the agent's assigned user. |
| `SF_AGENT_ENABLED` | no | Set `false` to force the scripted path without deleting credentials. |
| `SF_AGENT_TIMEOUT_MS` | no | Defaults `12000`. |
| `LEAD_WEBHOOK_URL` | no | If set, the Lead is POSTed here. |
| `LEAD_WEBHOOK_TOKEN` | no | Bearer token for the above. |

Check which path is live at `/api/health` — it reports config, token, and session
stages separately, with a hint per failure, and never returns secret values.

Two gotchas that cost real time:

- `bypassUser: true` runs as the user **assigned to the agent**, not as no user.
  If that assignment is empty, start session fails with
  `Invalid user ID provided on start session:`. `SF_BYPASS_USER=false` works
  around it with no Salesforce change.
- Env vars set through a shell pipe pick up a trailing newline, producing an
  `invalid_client` error indistinguishable from a wrong secret. Config reads are
  trimmed defensively.

### Who creates the Lead

**Salesforce does.** The sales agent has its own create-Lead and book-meeting
actions, so the app does not write a competing record on the live path. Meetings
land on the standard `Event` object, linked to the Lead via `WhoId`.

Two supporting pieces exist because the agent is not deterministic:

- `POST /api/lead/sync` — fills fields the agent left blank on the Lead it
  created (observed: `Email` populated on only 2 of 4 records, including one the
  agent updated afterwards). Only ever fills empty fields, so it cannot
  overwrite what the agent got right. Matches by exact email, else surname
  within a 30-minute window.
- `POST /api/lead` — writes a Lead from this app, reached **only** on the
  scripted fallback, where the Agent API is unreachable and Salesforce could not
  have created one. The two paths are mutually exclusive, so no duplicate is
  possible.

### Scheduling UI

`lib/slots.ts` lifts offered times out of the agent's prose so the chat can
render them as buttons; tapping one sends back the exact text the agent offered.
Booking confirmations are excluded so a confirmed slot can't be re-picked.

The pattern must tolerate several phrasings — the live agent writes
`"Friday, August 28, at 9:30 AM"` with a comma before `at`, while earlier
replies used `"August 28 at 9:00 AM"`. Comma, year, and the word `at` are all
optional.

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
