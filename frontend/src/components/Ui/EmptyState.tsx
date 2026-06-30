import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from './button/Button';

interface EmptyStateProps {
  type: 'jobs' | 'applicants' | 'notifications' | 'reviews';
  title?: string;
  description?: string;
  actionLabel?: string;
  onActionClick?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  title,
  description,
  actionLabel,
  onActionClick,
}) => {
  const config = {
    jobs: {
      illustration:
        'https://coresg-normal.trae.ai/api/ide/v1/text-to-image?prompt=empty%20state%20illustration%20of%20a%20briefcase%20with%20no%20jobs%20found%2C%20friendly%20style%2C%20pastel%20colors&image_size=square_hd',
      defaultTitle: 'Ingen oppdrag enda',
      defaultDescription: 'Opprett ditt første oppdrag og finn kvalifiserte arbeidere.',
      defaultActionLabel: 'Opprett oppdrag',
    },
    applicants: {
      illustration:
        'https://coresg-normal.trae.ai/api/ide/v1/text-to-image?prompt=empty%20state%20illustration%20of%20people%20waiting%20to%20apply%20for%20a%20job%2C%20friendly%20style%2C%20pastel%20colors&image_size=square_hd',
      defaultTitle: 'Ingen søkere enda',
      defaultDescription: 'Vent på at søkere skal søke om jobben din.',
      defaultActionLabel: null,
    },
    notifications: {
      illustration:
        'https://coresg-normal.trae.ai/api/ide/v1/text-to-image?prompt=empty%20state%20illustration%20of%20a%20bell%20with%20no%20notifications%2C%20friendly%20style%2C%20pastel%20colors&image_size=square_hd',
      defaultTitle: 'Ingen varsler',
      defaultDescription: 'Du har ingen nye varsler enda.',
      defaultActionLabel: null,
    },
    reviews: {
      illustration:
        'https://coresg-normal.trae.ai/api/ide/v1/text-to-image?prompt=empty%20state%20illustration%20of%20stars%20with%20no%20reviews%20yet%2C%20friendly%20style%2C%20pastel%20colors&image_size=square_hd',
      defaultTitle: 'Ingen anmeldelser enda',
      defaultDescription: 'Start å samle anmeldelser etter fullførte oppdrag.',
      defaultActionLabel: null,
    },
  };

  const { illustration, defaultTitle, defaultDescription, defaultActionLabel } = config[type];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <img
        src={illustration}
        alt={title || defaultTitle}
        className="w-40 h-40 object-cover mb-6 rounded-lg"
      />
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title || defaultTitle}</h3>
      <p className="text-gray-500 max-w-md mb-8">{description || defaultDescription}</p>
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
