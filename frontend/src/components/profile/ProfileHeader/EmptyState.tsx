import React from 'react';
import { Award, Briefcase, Star, InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="bg-white w-full mt-10 flex flex-col rounded-2xl items-center justify-center py-14 px-4 text-center max-w-sm mx-auto">
      <div className="w-20 h-20 rounded-full bg-[#f0faf0] flex items-center justify-center mb-5">
        {icon ?? <InboxIcon size={40} className="text-custom-green" />}
      </div>
      <h3 className="text-[18px] font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-[14px] text-gray-500 max-w-sm leading-relaxed">{description}</p>
    </div>
  );
}
