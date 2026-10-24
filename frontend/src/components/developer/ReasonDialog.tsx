import { useEffect, useState, type ReactNode } from 'react';
import { useDevMe } from '../../features/developer/hooks';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

/**
 * Confirm a sensitive action with a reason. The button says whether it will run now
 * (Super Admin) or go for approval (operations developer).
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  children,
  canSubmit = true,
  selfService = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  children?: ReactNode;
  canSubmit?: boolean;
  /** Runs directly for operations developers too (no approval). */
  selfService?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const { data: me } = useDevMe();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const direct = me?.can.execute || (selfService && me?.can.request);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch {
      /* the action hook already reported it */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description} {direct ? 'Runs immediately after you confirm with a one-time code.' : 'A Super Admin must approve this before it runs.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {children}
          <div className="space-y-1.5">
            <Label htmlFor="action-reason">Reason</Label>
            <Textarea id="action-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Why is this needed? (recorded in the audit log)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} disabled={!canSubmit || reason.trim().length < 5 || busy} onClick={submit}>
            {direct ? confirmLabel : `Request: ${confirmLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
