import { useEffect, useState } from 'react';
import { useSensitiveAction } from '../../features/developer/stepUp';
import { ReasonDialog } from './ReasonDialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const DURATIONS = [
  { value: '1', label: '1 hour' },
  { value: '24', label: '24 hours' },
  { value: '168', label: '7 days' },
  { value: '720', label: '30 days' },
  { value: 'permanent', label: 'Always (until unblocked)' },
];

/** Block an IP or a narrow CIDR range (step-up; Super Admin runs it, operations requests it). */
export function BlockIpDialog({ ip, open, onOpenChange }: { ip?: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [target, setTarget] = useState(ip || '');
  const [duration, setDuration] = useState('24');
  const submit = useSensitiveAction(['blocks', 'security', 'ips']);
  useEffect(() => {
    if (open) {
      setTarget(ip || '');
      setDuration('24');
    }
  }, [open, ip]);

  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Block IP address"
      description="Every API request from this address gets 403 within 30 seconds on all servers. Shared networks (offices, mobile carriers) may contain real customers — prefer a short duration."
      confirmLabel="Block"
      destructive
      selfService
      canSubmit={Boolean(target.trim())}
      onConfirm={(reason) => submit('ip_block', { ip: target.trim(), expiresInHours: duration === 'permanent' ? null : Number(duration) }, reason)}
    >
      <div className="space-y-1.5">
        <Label htmlFor="blk-ip">IP or CIDR range</Label>
        <Input id="blk-ip" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="203.0.113.7 or 203.0.113.0/24" className="font-mono" />
      </div>
      <div className="space-y-1.5">
        <Label>Duration</Label>
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATIONS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ReasonDialog>
  );
}
