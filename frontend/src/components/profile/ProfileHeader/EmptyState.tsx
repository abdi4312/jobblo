import React from 'react';
import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl flex flex-col items-center justify-center py-14 px-6 text-center w-full">
      <div className="w-20 h-20 rounded-full bg-[#f0faf0] flex items-center justify-center mb-5">
        {icon ?? <InboxIcon size={36} className="text-custom-green" />}
      </div>
      <h3 className="text-[17px] font-bold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-[13px] text-gray-500 leading-relaxed max-w-xs">{description}</p>
    </div>
  );
}
