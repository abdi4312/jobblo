import React from 'react';
import { Plus, Briefcase, Users, Bell, Star, ClipboardList } from 'lucide-react';
import { Button } from './button/Button';

interface EmptyStateProps {
  type: 'jobs' | 'applicants' | 'notifications' | 'reviews' | 'applications';
  title?: string;
  description?: string;
  actionLabel?: string;
  onActionClick?: () => void;
}

const config: Record<string, {
  icon: React.ReactNode;
  defaultTitle: string;
  defaultDescription: string;
  defaultActionLabel: string | null;
}> = {
  jobs: {
    icon: <Briefcase size={40} className="text-custom-green" />,
    defaultTitle: 'Ingen oppdrag enda',
    defaultDescription: 'Opprett ditt første oppdrag og finn kvalifiserte arbeidere.',
    defaultActionLabel: 'Opprett oppdrag',
  },
  applicants: {
    icon: <Users size={40} className="text-custom-green" />,
    defaultTitle: 'Ingen søkere enda',
    defaultDescription: 'Vent på at søkere skal søke om jobben din.',
    defaultActionLabel: null,
  },
  notifications: {
    icon: <Bell size={40} className="text-custom-green" />,
    defaultTitle: 'Ingen varsler',
    defaultDescription: 'Du har ingen nye varsler enda.',
    defaultActionLabel: null,
  },
  reviews: {
    icon: <Star size={40} className="text-custom-green" />,
    defaultTitle: 'Ingen anmeldelser enda',
    defaultDescription: 'Start å samle anmeldelser etter fullførte oppdrag.',
    defaultActionLabel: null,
  },
  applications: {
    icon: <ClipboardList size={40} className="text-custom-green" />,
    defaultTitle: 'Ingen søknader enda',
    defaultDescription: 'Du har ikke søkt på noen oppdrag ennå. Utforsk oppdrag for å komme i gang.',
    defaultActionLabel: 'Utforsk oppdrag',
  },
};

const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  title,
  description,
  actionLabel,
  onActionClick,
}) => {
  const typeConfig = config[type] ?? config['jobs'];
  const { icon, defaultTitle, defaultDescription, defaultActionLabel } = typeConfig;

  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-[#f0faf0] flex items-center justify-center mb-5">
        {icon}
      </div>
      <h3 className="text-[18px] font-bold text-gray-900 mb-2">{title || defaultTitle}</h3>
      <p className="text-[14px] text-gray-500 max-w-sm mb-6">{description || defaultDescription}</p>
      {(actionLabel || defaultActionLabel) && onActionClick && (
        <Button
          icon={<Plus size={16} />}
          label={actionLabel || defaultActionLabel!}
          onClick={onActionClick}
          className="bg-custom-green text-white rounded-full py-3 px-6"
        />
      )}
    </div>
  );
};

export default EmptyState;
