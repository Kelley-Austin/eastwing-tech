const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "local";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-black">
      <main className="w-full max-w-xl">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          Eastwing Tech
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Deployment pipeline is live.
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Placeholder page. Act 0 of the Self-Driving CRM demo — the
          conversational entry point that replaces the contact form — gets built
          on top of this.
        </p>
        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-800">
          <div className="bg-white p-4 dark:bg-black">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              Branch
            </dt>
            <dd className="mt-1 text-black dark:text-zinc-50">{branch}</dd>
          </div>
          <div className="bg-white p-4 dark:bg-black">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              Commit
            </dt>
            <dd className="mt-1 text-black dark:text-zinc-50">{commit}</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
