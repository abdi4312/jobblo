import { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertTriangle, Wrench } from 'lucide-react';
import { useMaintenanceMode, useToggleMaintenanceMode } from '../../hooks/admin/content';
import { AdminPageHeader, AdminLoadingSkeleton, AdminErrorState } from '../../components/admin';
import { toast } from 'sonner';

export default function MaintenanceModePage() {
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError, refetch } = useMaintenanceMode();
  const toggleMutation = useToggleMaintenanceMode();

  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setMessage(data.message ?? '');
    }
  }, [data]);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (!newEnabled) {
      setMessage('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await toggleMutation.mutateAsync({ enabled, message: enabled ? message : undefined });
      toast.success(enabled ? 'Vedlikeholdsmodus er aktivert.' : 'Vedlikeholdsmodus er deaktivert.');
    } catch {
      toast.error('Kunne ikke oppdatere vedlikeholdsmodus.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Vedlikeholdsmodus" description="Sett plattformen i vedlikeholdsmodus" />
        <AdminLoadingSkeleton rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Vedlikeholdsmodus" description="Sett plattformen i vedlikeholdsmodus" />
        <AdminErrorState onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Vedlikeholdsmodus"
        description="Sett plattformen i vedlikeholdsmodus"
        actions={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            <RefreshCw size={16} />
            Oppdater
          </button>
        }
      />

      {enabled && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Vedlikeholdsmodus er aktiv</p>
            <p className="text-red-500 mt-0.5">
              Plattformen er utilgjengelig for vanlige brukere. Den angitte meldingen vises på allmenningssiden.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Aktiver vedlikeholdsmodus</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Slå på for å hindre brukertilgang mens du gjør endringer
            </p>
          </div>
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 ${
              enabled ? 'bg-red-500' : 'bg-gray-200'
            }`}
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? 'Deaktiver vedlikeholdsmodus' : 'Aktiver vedlikeholdsmodus'}
          >
            <span
              className={`pointer-events-none inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            >
              <Wrench size={14} className={enabled ? 'text-red-500' : 'text-gray-400'} />
            </span>
          </button>
        </div>

        {enabled && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Vedlikeholdsmelding
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Skriv inn en melding som vises for brukerne..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 focus:border-transparent resize-y"
            />
            <p className="text-xs text-gray-400">
              Denne meldingen vises på innloggingssiden når vedlikeholdsmodus er aktiv.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] disabled:opacity-50 rounded-xl transition-colors"
          >
            <Save size={16} />
            {saving ? 'Lagrer...' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  );
}
