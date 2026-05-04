import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="bg-[#ffff] mt-10 flex flex-col rounded-2xl items-center justify-center py-10 px-4 text-center max-w-[400px] mx-auto">
      {/* Cactus/Desert Illustration Placeholder */}
      <div className="w-35 h-35 bg-[#fff0ed] rounded-full flex items-center justify-center mb-8 relative overflow-hidden">
        <div className="absolute bottom-0 w-full h-1/2 bg-[#ffd8d1] opacity-50"></div>
        {/* Simple SVG Cactus Illustration */}
        <svg 
          viewBox="0 0 100 100" 
          className="w-32 h-32 z-10"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M50 80V30" stroke="#e06c5a" strokeWidth="8" strokeLinecap="round"/>
          <path d="M50 55C40 55 35 45 35 45" stroke="#e06c5a" strokeWidth="6" strokeLinecap="round"/>
          <path d="M50 45C60 45 65 35 65 35" stroke="#e06c5a" strokeWidth="6" strokeLinecap="round"/>
          <circle cx="38" cy="48" r="1.5" fill="#4a1a14"/>
          <circle cx="42" cy="52" r="1.5" fill="#4a1a14"/>
          <circle cx="58" cy="38" r="1.5" fill="#4a1a14"/>
          <circle cx="62" cy="42" r="1.5" fill="#4a1a14"/>
          <circle cx="48" cy="32" r="1.5" fill="#4a1a14"/>
          <circle cx="52" cy="36" r="1.5" fill="#4a1a14"/>
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-base text-gray-500 font-medium leading-relaxed">
        {description}
      </p>
    </div>
  );
}
