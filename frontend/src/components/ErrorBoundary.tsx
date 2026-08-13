import React from 'react';
import mainLink from '../api/mainURLs';

class ErrorBoundary extends React.Component {
  constructor(props:any) {
    super(props);
    this.state = { hasError: false, referenceId: null };
  }

  async componentDidCatch(error:any, info:any) {
    this.setState({ hasError: true });
    try {
      const payload = {
        errorCode: 'FRONTEND_RENDER_ERROR',
        message: String(error?.message || 'Component render error'),
        route: window.location.pathname,
        component: info?.componentStack || null,
        metadata: { info },
      };
      const resp = await mainLink.post('/api/errors/client', payload);
      this.setState({ referenceId: resp.data.data.referenceId });
    } catch (e) {
      // ignore
    }
  }

  render() {
    if ((this.state as any).hasError) {
      return (
        <div className="p-6 bg-white rounded shadow">
          <h3 className="text-lg font-bold">Noe gikk galt</h3>
          <p className="mt-2">Vi oppdaget et problem i grensesnittet. Vennligst prøv å oppdatere siden.</p>
          {(this.state as any).referenceId && (
            <p className="mt-2 text-sm text-gray-500">Referanse: {(this.state as any).referenceId}</p>
          )}
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}

export default ErrorBoundary;
