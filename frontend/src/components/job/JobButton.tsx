import React from 'react';
import { Button } from '../Ui/button/Button';
import { MessageCircle, AlertCircle } from 'lucide-react';
import { Spinner } from '../Ui/Spinner';
import type { Jobs } from '../../types/Jobs';

interface JobButtonProps {
  handleSendMessage: () => void;
  handleFavoriteClick?: () => void; // Optional now
  isFavorited?: boolean; // Optional now
  isOwnJob: boolean;
  isMsgLoading: boolean; // Button action loading (spinner)
  id: string;
  job?: Jobs; // Added job prop to pass to modal
  hasRequested?: boolean;
  isTimerActive?: boolean; // Added for cooldown state
  wasDeclined?: boolean;
}

const JobButton: React.FC<JobButtonProps> = ({
  handleSendMessage,
  isOwnJob,
  isMsgLoading,
  job,
  hasRequested,
  isTimerActive,
  wasDeclined,
}) => {
  const isLimitReached = job?.isLimitReached;

  return (
    <div className="flex flex-col gap-3">
      {isLimitReached && !isOwnJob && !hasRequested && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-2 text-red-600 text-xs font-bold">
          <AlertCircle size={14} />
          <span>Søknadsfristen er nådd. Dette oppdraget tar ikke imot flere søknader.</span>
        </div>
      )}

      {/* Applicants are mass-declined when someone else wins the contract, and
          were never told. The button just stayed greyed out forever. */}
      {wasDeclined && !hasRequested && !isOwnJob && !isLimitReached && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2 text-amber-700 text-xs font-medium">
          <AlertCircle size={14} className="shrink-0" />
          <span>Forespørselen din ble ikke valgt denne gangen. Du kan søke på nytt.</span>
        </div>
      )}
      <div className="flex gap-3">
        {/* Søk / Apply Button */}
        <Button
          onClick={handleSendMessage}
          disabled={!isOwnJob && (isMsgLoading || hasRequested || isLimitReached || isTimerActive)}
          label={
            isMsgLoading
              ? ''
              : isOwnJob
                ? 'Se søkere'
                : hasRequested
                  ? 'Forespørsel sendt'
                  : isLimitReached
                    ? 'Fulltegnet'
                    : isTimerActive
                      ? 'Cooldown'
                      : 'Send forespørsel'
          }
          icon={isMsgLoading ? <Spinner size={18} label={null} /> : <MessageCircle size={18} />}
          className={`flex-1 h-12 text-[14px]! rounded-xl font-semibold! transition-all! whitespace-nowrap
                        ${
                          !isOwnJob && (hasRequested || isLimitReached || isTimerActive)
                            ? 'bg-gray-100! text-gray-400! cursor-not-allowed!'
                            : 'bg-custom-green! text-white! hover:bg-[#266b3c]!'
                        } 
                    `}
        />
      </div>
    </div>
  );
};

export default JobButton;
