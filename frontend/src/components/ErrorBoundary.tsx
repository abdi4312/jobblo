import React from 'react';
import { Link, useRouteError } from 'react-router-dom';
import mainLink from '../api/mainURLs';

/** Best-effort report to the backend error log. Returns a reference id if one came back. */
async function reportClientError(error: unknown, componentStack?: string | null) {
  const err = error as { message?: string; stack?: string } | null | undefined;
  try {
    const resp = await mainLink.post('/api/errors/client', {
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

class ErrorBoundary extends React.Component {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, referenceId: null };
  }

  async componentDidCatch(error: any, info: any) {
    this.setState({ hasError: true });
    const referenceId = await reportClientError(error, info?.componentStack);
    this.setState({ referenceId });
  }

  render() {
    if ((this.state as any).hasError) {
      return (
        <div className="p-6 bg-white rounded shadow">
          <h3 className="text-lg font-bold">Noe gikk galt</h3>
          <p className="mt-2">
            Vi oppdaget et problem i grensesnittet. Vennligst prøv å oppdatere siden.
          </p>
          {(this.state as any).referenceId && (
            <p className="mt-2 text-sm text-gray-500">
              Referanse: {(this.state as any).referenceId}
            </p>
          )}
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}

export default ErrorBoundary;
