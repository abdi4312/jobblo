import React from 'react';
import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  /** Optional call to action — an empty state the owner can act on beats a dead end. */
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center rounded-3xl border border-[#E6E7E1] bg-white px-6 py-14 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
        {icon ?? <InboxIcon size={26} strokeWidth={1.8} />}
      </div>
      <h3 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">{title}</h3>
      <p className="mt-1.5 max-w-80 text-[0.875rem] leading-relaxed text-[#63665F]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
