import React, { useState } from 'react';
import { X, Flag } from 'lucide-react';
import { Spinner } from '../Ui/Spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Ui/select';

const REPORT_TYPE_OPTIONS = [
  { label: 'Falsk annonse', value: 'fake_job' },
  { label: 'Svindel', value: 'scam_or_fraud' },
  { label: 'Spam', value: 'spam' },
  { label: 'Duplikat', value: 'duplicate' },
  { label: 'Upassende innhold', value: 'inappropriate_content' },
  { label: 'Feil kategori', value: 'wrong_category' },
  { label: 'Villedende informasjon', value: 'misleading_info' },
  { label: 'Utløpt annonse', value: 'expired_job' },
  { label: 'Betalingsproblem', value: 'payment_issue' },
  { label: 'Annet', value: 'other' },
];

interface ReportJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { reportType: string; description: string }) => void;
  isLoading?: boolean;
  jobTitle?: string;
}

const ReportJobModal: React.FC<ReportJobModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  jobTitle,
}) => {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!reportType || !description.trim()) return;
    onSubmit({ reportType, description: description.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 fade-in duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Flag size={18} className="text-red-500" /> Rapporter annonse
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
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
            Årsak <span className="text-red-500">*</span>
          </label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-full border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
              <SelectValue placeholder="Velg årsak..." />
            </SelectTrigger>
            <SelectContent className="z-[10010] bg-white">
              {REPORT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Beskrivelse <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Fortell oss hva som er galt med denne annonsen..."
            rows={4}
            maxLength={2000}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F7E47] focus:border-transparent resize-none transition-all"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/2000</p>
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
            disabled={isLoading || !reportType || !description.trim()}
            className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Spinner size={18} label={null} />
            ) : (
              <>
                <Flag size={16} />
                Send rapport
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportJobModal;
