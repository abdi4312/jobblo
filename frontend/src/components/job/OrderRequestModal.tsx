import React, { useState } from 'react';
import { Send, X } from 'lucide-react';
import { TailSpin } from 'react-loader-spinner';

interface OrderRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (message?: string) => void;
  isLoading?: boolean;
  jobTitle?: string;
}

const OrderRequestModal: React.FC<OrderRequestModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  jobTitle,
}) => {
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    onConfirm(message.trim() || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Send forespørsel</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {jobTitle && (
          <p className="text-sm text-gray-500 mb-4">
            <span className="font-medium text-gray-700">{jobTitle}</span>
          </p>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Melding til leverandøren{' '}
            <span className="text-gray-400 font-normal">(valgfritt)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skriv en melding til leverandøren..."
            rows={4}
            maxLength={500}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F7E47] focus:border-transparent resize-none transition-all"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/500</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-[#2F7E47] text-white rounded-xl text-sm font-semibold hover:bg-[#266b3c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <TailSpin height={18} width={18} color="#ffffff" />
            ) : (
              <>
                <Send size={16} />
                Send forespørsel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderRequestModal;
