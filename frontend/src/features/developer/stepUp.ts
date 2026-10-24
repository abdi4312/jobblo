import { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { devApi, type ActionType, type Doc, type RiskAssessment } from '../../api/developer';

/** Runs fn with a valid step-up token, asking for an emailed code first if needed. */
export type WithStepUp = <T>(fn: (token: string) => Promise<T>) => Promise<T>;
export const StepUpContext = createContext<WithStepUp | null>(null);

/** Shows a critical risk assessment and resolves when the person confirms (rejects 'cancelled'). */
export type ConfirmRisk = (risk: RiskAssessment, summary: string) => Promise<void>;
export const RiskConfirmContext = createContext<ConfirmRisk | null>(null);

/** The server answered 409 RISK_CONFIRM: the assessment it wants confirmed. */
export const riskToConfirm = (e: unknown) => {
  const d = (e as { response?: { status?: number; data?: { code?: string; data?: { risk: RiskAssessment; summary: string } } } })?.response;
  return d?.status === 409 && d.data?.code === 'RISK_CONFIRM' ? d.data.data : null;
};

/** Run fn(false); if the change is critical-risk, show why, and on confirm run fn(true). */
export function useRiskConfirm() {
  const confirm = useContext(RiskConfirmContext);
  if (!confirm) throw new Error('useRiskConfirm must be used inside <StepUpProvider>');
  return async <T,>(fn: (acknowledgeRisk: boolean) => Promise<T>): Promise<T> => {
    try {
      return await fn(false);
    } catch (e) {
      const r = riskToConfirm(e);
      if (!r) throw e;
      await confirm(r.risk, r.summary);
      return fn(true);
    }
  };
}

export function useStepUp(): WithStepUp {
  const ctx = useContext(StepUpContext);
  if (!ctx) throw new Error('useStepUp must be used inside <StepUpProvider>');
  return ctx;
}

export const errMessage = (e: unknown, fallback = 'Request failed') =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e as Error)?.message || fallback;

/**
 * Submit a sensitive action. A Super Admin executes it; an operations developer creates
 * an approval request. Either way the caller sees what happened.
 */
export function useSensitiveAction(invalidate: string[] = []) {
  const withStepUp = useStepUp();
  const withRisk = useRiskConfirm();
  const qc = useQueryClient();
  return async (type: ActionType, input: Doc, reason: string) => {
    try {
      const r = await withRisk((ack) => withStepUp((token) => devApi.action(type, input, reason, token, ack)));
      toast.success(r.executed ? `Done: ${r.summary}` : `Sent for Super Admin approval: ${r.summary}`);
      [...invalidate, 'approvals'].forEach((k) => qc.invalidateQueries({ queryKey: ['dev', k] }));
      return r;
    } catch (e) {
      if ((e as Error)?.message !== 'cancelled') toast.error(errMessage(e));
      throw e;
    }
  };
}
