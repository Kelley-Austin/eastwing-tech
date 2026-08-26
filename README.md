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

## Status

The site is currently a placeholder. The Act 0 conversational widget is not
built yet — it needs decisions on the chat engine, whether the site itself writes
the Lead, and Eastwing Tech's product positioning.
