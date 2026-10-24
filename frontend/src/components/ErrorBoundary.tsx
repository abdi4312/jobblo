import React from 'react';
import { Link, useRouteError } from 'react-router-dom';
import { postClientError } from '../api/publicAPI';
import { reportProblem } from '../lib/rum';

/** Best-effort report to the backend error log. Returns a reference id if one came back. */
async function reportClientError(error: unknown, componentStack?: string | null) {
  const err = error as { message?: string; stack?: string } | null | undefined;
  try {
    const resp = await postClientError({
      errorCode: 'FRONTEND_RENDER_ERROR',
      message: String(err?.message || 'Component render error'),
      route: window.location.pathname,
      component: componentStack || null,
      metadata: { stack: err?.stack || null },
    });
    return resp?.data?.data?.referenceId ?? null;
  } catch {
    return null;
  }
}

/**
 * Route-level error element. React Router renders this instead of the route
 * subtree when anything below it throws during render, or when a lazy chunk
 * fails to load. Without it the user gets React Router's unstyled English
 * "Unexpected Application Error!" screen with no way back.
 */
export function RouteErrorElement() {
  const error = useRouteError();
  const [referenceId, setReferenceId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const message = String((error as { message?: string } | null)?.message || 'Render error');
    reportProblem(/dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed/i.test(message) ? 'chunk' : 'render', message);
    reportClientError(error).then((id) => {
      if (!cancelled) setReferenceId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl text-center">
        <h1 className="text-2xl font-bold text-custom-black">Noe gikk galt</h1>
        <p className="mt-2 text-base text-gray-500">
          Vi klarte ikke å vise denne siden. Prøv å laste den på nytt, eller gå tilbake til
          forsiden.
        </p>
        {referenceId && (
          <p className="mt-2 text-sm text-gray-400">Referanse: {referenceId}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-custom-green px-6 py-3 font-bold text-white transition-colors hover:bg-[#1E5230]"
          >
            Prøv igjen
          </button>
          <Link
            to="/"
            className="rounded-2xl border border-black/15 px-6 py-3 font-bold text-custom-black! transition-colors hover:bg-gray-50"
          >
            Til forsiden
          </Link>
        </div>
      </div>
    </main>
  );
}
