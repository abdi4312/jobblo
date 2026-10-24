import { useCallback, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, LockOpen, Mail, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { devApi, type RiskAssessment, type RiskLevel } from '../../api/developer';
import {
  RiskConfirmContext,
  StepUpContext,
  errMessage,
  type ConfirmRisk,
  type WithStepUp,
} from '../../features/developer/stepUp';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const RISK_TONE: Record<RiskLevel, string> = {
  low: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  medium: 'text-sky-700 border-sky-200 bg-sky-50',
  high: 'text-amber-700 border-amber-200 bg-amber-50',
  critical: 'text-red-700 border-red-200 bg-red-50',
};

/** Score badge, e.g. "62 · high". */
export function RiskBadge({
  risk,
}: {
  risk: Pick<RiskAssessment, 'score' | 'level'> | null | undefined;
}) {
  if (!risk) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium tabular-nums',
        RISK_TONE[risk.level]
      )}
    >
      {risk.score} · {risk.level}
    </span>
  );
}

/** Why a change is risky, and what lowers the risk. */
export function RiskFactors({ risk }: { risk: RiskAssessment }) {
  return (
    <div className="space-y-3 text-sm">
      {risk.factors.length ? (
        <ul className="space-y-1.5">
          {risk.factors.map((f) => (
            <li key={f.key} className="flex gap-2">
              <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                +{f.points}
              </span>
              <span>{f.why}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          Nothing in this change or the current situation adds risk.
        </p>
      )}
      {risk.mitigations.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            To lower the risk
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            {risk.mitigations.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Holds the step-up token in memory (never in storage) for its 10-minute life and asks
 * for an emailed code whenever a sensitive action needs a fresh one.
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const token = useRef<{ value: string; until: number } | null>(null);
  const pending = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null);
  const [open, setOpen] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [riskAsk, setRiskAsk] = useState<{
    risk: RiskAssessment;
    summary: string;
    resolve: () => void;
    reject: (e: Error) => void;
  } | null>(null);
  const confirmRisk: ConfirmRisk = useCallback(
    (risk, summary) =>
      new Promise<void>((resolve, reject) => setRiskAsk({ risk, summary, resolve, reject })),
    []
  );

  const askForToken = () =>
    new Promise<string>((resolve, reject) => {
      pending.current = { resolve, reject };
      setSentTo(null);
      setCode('');
      setOpen(true);
    });

  const withStepUp: WithStepUp = useCallback(async (fn) => {
    const valid =
      token.current && token.current.until > Date.now() + 15_000
        ? token.current.value
        : await askForToken();
    try {
      return await fn(valid);
    } catch (e) {
      // Server says the token is gone (expired, other session): ask once more.
      if (
        (e as { response?: { data?: { code?: string } } })?.response?.data?.code ===
        'STEP_UP_REQUIRED'
      ) {
        token.current = null;
        return fn(await askForToken());
      }
      throw e;
    }
  }, []);

  const close = () => {
    setOpen(false);
    pending.current?.reject(new Error('cancelled'));
    pending.current = null;
  };
  const send = async () => {
    setBusy(true);
    try {
      setSentTo((await devApi.stepUpSend()).sentTo);
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true);
    try {
      const r = await devApi.stepUpVerify(code);
      token.current = { value: r.token, until: new Date(r.expiresAt).getTime() };
      setOpen(false);
      pending.current?.resolve(r.token);
      pending.current = null;
      toast.success('Confirmed for 10 minutes');
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepUpContext.Provider value={withStepUp}>
      <RiskConfirmContext.Provider value={confirmRisk}>
        {children}
        <Dialog
          open={Boolean(riskAsk)}
          onOpenChange={(o) => {
            if (!o && riskAsk) {
              riskAsk.reject(new Error('cancelled'));
              setRiskAsk(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="size-4" /> Critical risk: {riskAsk?.risk.score}/100
              </DialogTitle>
              <DialogDescription>{riskAsk?.summary}</DialogDescription>
            </DialogHeader>
            {riskAsk && <RiskFactors risk={riskAsk.risk} />}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  riskAsk?.reject(new Error('cancelled'));
                  setRiskAsk(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  riskAsk?.resolve();
                  setRiskAsk(null);
                }}
              >
                I understand, apply it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={open} onOpenChange={(o) => !o && close()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" /> Confirm it's you
              </DialogTitle>
              <DialogDescription>
                Sensitive actions need a one-time code sent to your account email. It stays valid
                for 10 minutes in this tab.
              </DialogDescription>
            </DialogHeader>
            {sentTo ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  verify();
                }}
              >
                <Label htmlFor="stepup-code">Code sent to {sentTo}</Label>
                <Input
                  id="stepup-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="w-40 text-center font-mono tracking-[0.3em]"
                />
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">We will email you a 6-digit code.</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              {sentTo ? (
                <>
                  <Button variant="ghost" disabled={busy} onClick={send}>
                    Resend
                  </Button>
                  <Button disabled={code.length !== 6 || busy} onClick={verify}>
                    <LockOpen /> Confirm
                  </Button>
                </>
              ) : (
                <Button disabled={busy} onClick={send}>
                  <Mail /> Email me a code
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </RiskConfirmContext.Provider>
    </StepUpContext.Provider>
  );
}
