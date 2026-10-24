import { lazy, Suspense, useEffect, useState, type ReactElement } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Copy, KeyRound, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import mainLink from '../../api/mainURLs';
import { useUserStore } from '../../stores/userStore';
import { Button } from '../developer/ui/button';
import { Input } from '../developer/ui/input';
import { AuthPending } from './ProtectedRoute';

type Status = { required: boolean; enabled: boolean; verified: boolean };
// Only admins setting up 2FA need the QR library — not every visitor in the main bundle.
const QRCode = lazy(() => import('react-qr-code'));
const message = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Something went wrong — try again.';

/**
 * Two-factor gate for superAdmin and developer: the backend refuses every call from their
 * session until the authenticator code is checked (middleware/auth.js, MFA_REQUIRED).
 * First time: scan a QR code, confirm a code, save the backup codes. Afterwards: a code
 * at every sign-in (or a one-time backup code).
 */
export function MfaGate({ children }: { children: ReactElement }) {
  const logout = useUserStore((s) => s.logout);
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = (await mainLink.get<Status>('/api/auth/mfa')).data;
        if (cancelled) return;
        setStatus(s);
        if (s.required && !s.verified && !s.enabled) setSetup((await mainLink.post('/api/auth/mfa/setup')).data);
      } catch (e) {
        if (!cancelled) setError(message(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await mainLink.post('/api/auth/mfa/verify', useBackup ? { backupCode: code } : { code })).data;
      if (r.backupCodes?.length) setBackupCodes(r.backupCodes);
      else setStatus((s) => s && { ...s, verified: true });
    } catch (e) {
      setError(message(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  if (!status && !error) return <AuthPending />;
  if (status && (!status.required || status.verified)) return children;

  return (
    <main className="dev-theme flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-md space-y-5 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5 text-primary" />
          {backupCodes ? 'Save your backup codes' : setup ? 'Set up an authenticator app' : 'Two-factor sign-in'}
        </div>

        {backupCodes ? (
          <>
            <p className="text-sm text-muted-foreground">If you lose your phone, each of these codes signs you in once. Store them somewhere safe — they are not shown again.</p>
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm">{backupCodes.map((c) => <span key={c}>{c}</span>)}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(backupCodes.join('\n'))}>
                <Copy /> Copy
              </Button>
              <Button size="sm" className="flex-1" onClick={() => setStatus((s) => s && { ...s, verified: true, enabled: true })}>
                I have saved them — continue
              </Button>
            </div>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code) void submit();
            }}
          >
            {setup && (
              <>
                <p className="text-sm text-muted-foreground">Admin and developer accounts need a second step at every sign-in. Scan this code with Google Authenticator, Microsoft Authenticator, 1Password or a similar app.</p>
                <div className="mx-auto w-fit rounded-md bg-white p-3">
                  <Suspense fallback={<div className="size-44" />}>
                    <QRCode value={setup.otpauthUrl} size={176} />
                  </Suspense>
                </div>
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Can't scan? Enter this key instead</summary>
                  <code className="mt-1 block break-all rounded bg-muted p-2 font-mono text-sm text-foreground">{setup.secret}</code>
                </details>
              </>
            )}
            {!setup && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Smartphone className="mt-0.5 size-4 shrink-0" />
                {useBackup ? 'Enter one of your backup codes (each works once).' : 'Open your authenticator app and enter the 6-digit code for Jobblo.'}
              </p>
            )}
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(useBackup ? e.target.value.toUpperCase().slice(0, 9) : e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode={useBackup ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              placeholder={useBackup ? 'ABCD-EFGH' : '123456'}
              aria-label={useBackup ? 'Backup code' : 'Authenticator code'}
              className="text-center font-mono text-lg tracking-[0.3em]"
            />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || (useBackup ? code.length < 8 : code.length !== 6)}>
              {busy ? 'Checking…' : setup ? 'Confirm and turn on' : 'Verify'}
            </Button>
            <div className="flex items-center justify-between text-xs">
              {!setup ? (
                <button
                  type="button"
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={() => {
                    setUseBackup(!useBackup);
                    setCode('');
                    setError(null);
                  }}
                >
                  <KeyRound className="size-3.5" /> {useBackup ? 'Use the app code' : 'Use a backup code'}
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="flex items-center gap-1 text-muted-foreground hover:underline" onClick={() => logout()}>
                <LogOut className="size-3.5" /> Sign out
              </button>
            </div>
            {!setup && <p className="text-[11px] text-muted-foreground">Lost your phone and your backup codes? Another Super Admin can reset your authenticator.</p>}
          </form>
        )}
      </div>
    </main>
  );
}

/** /mfa — where the API client sends a privileged session that still needs its code. */
export default function MfaPage() {
  const [params] = useSearchParams();
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const authReady = useUserStore((s) => s.authReady);
  const next = params.get('next') || '/';
  if (!authReady) return <AuthPending />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <MfaGate>
      <Navigate to={next.startsWith('/') && !next.startsWith('//') ? next : '/'} replace />
    </MfaGate>
  );
}
