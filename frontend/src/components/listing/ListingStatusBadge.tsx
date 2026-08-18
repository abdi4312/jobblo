import {
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock3,
  FileEdit,
  Hourglass,
  Lock,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { statusLabel } from '../../constants/statuses';

/**
 * The status of one of the owner's own listings.
 *
 * Two rules this exists to keep.
 *
 * **The words come from `constants/statuses.ts`.** That file is already the single
 * Norwegian vocabulary for services and orders, written after three call sites had
 * drifted apart and started printing raw `awaiting_payment` at users. Nothing here
 * invents a label; `statusLabel()` is the only source, and it falls back to
 * "Ukjent status" rather than leaking snake_case.
 *
 * **Colour is never the only signal.** Every state carries its own icon and its own
 * word, so the badge reads identically to someone who cannot separate the green from
 * the amber. The tint is a reinforcement, not the message — which is also why the
 * palette here is restrained: brand green for the states that are going well, neutral
 * stone for the inert ones, amber for waiting, and red used exactly once, for
 * cancelled.
 */

type Tone = 'green' | 'neutral' | 'amber' | 'red' | 'ink';

const TONES: Record<Tone, string> = {
  // The stem green at 12 %, the same tint as ICON_PLATE and the SafePay badges.
  green: 'bg-[#EAF1E9] text-[#2E6641]',
  neutral: 'bg-[#F1F2EC] text-[#63665F]',
  amber: 'bg-[#FBF3E6] text-[#8A5A1B]',
  red: 'bg-[#FCF4F3] text-[#B0453B]',
  ink: 'bg-[#122A1C] text-white',
};

const PRESENTATION: Record<string, { tone: Tone; icon: ReactNode }> = {
  open: { tone: 'green', icon: <CircleDot size={11} strokeWidth={2.4} /> },
  active: { tone: 'green', icon: <CircleDot size={11} strokeWidth={2.4} /> },
  draft: { tone: 'neutral', icon: <FileEdit size={11} strokeWidth={2.4} /> },
  pending: { tone: 'amber', icon: <Hourglass size={11} strokeWidth={2.4} /> },
  awaiting_payment: { tone: 'amber', icon: <Clock3 size={11} strokeWidth={2.4} /> },
  paid: { tone: 'green', icon: <ShieldCheck size={11} strokeWidth={2.4} /> },
  in_progress: { tone: 'ink', icon: <Wrench size={11} strokeWidth={2.4} /> },
  ready_for_review: { tone: 'amber', icon: <Hourglass size={11} strokeWidth={2.4} /> },
  waiting_for_approval: { tone: 'amber', icon: <Hourglass size={11} strokeWidth={2.4} /> },
  completed: { tone: 'green', icon: <CheckCircle2 size={11} strokeWidth={2.4} /> },
  cancelled: { tone: 'red', icon: <XCircle size={11} strokeWidth={2.4} /> },
  closed: { tone: 'neutral', icon: <Lock size={11} strokeWidth={2.4} /> },
  expired: { tone: 'neutral', icon: <CircleDashed size={11} strokeWidth={2.4} /> },
  disputed: { tone: 'red', icon: <XCircle size={11} strokeWidth={2.4} /> },
};

const FALLBACK = { tone: 'neutral' as Tone, icon: <CircleDashed size={11} strokeWidth={2.4} /> };

interface ListingStatusBadgeProps {
  status?: string | null;
  className?: string;
}

/** Matches the `BADGE` geometry in `component/jobCard/JobCard.tsx`. */
const BADGE =
  'inline-flex h-6.5 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[0.6875rem] font-semibold';

export const ListingStatusBadge = ({ status, className = '' }: ListingStatusBadgeProps) => {
  const { tone, icon } = PRESENTATION[status ?? ''] ?? FALLBACK;

  return (
    <span className={`${BADGE} ${TONES[tone]} ${className}`}>
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span className="truncate">{statusLabel(status)}</span>
    </span>
  );
};

export default ListingStatusBadge;
