import { useState } from 'react';
import { ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import { useFeatureFlags, useToggleFeatureFlag } from '../../hooks/admin/content';
import { AdminPageHeader, AdminLoadingSkeleton, AdminErrorState } from '../../components/admin';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { toast } from 'sonner';

function formatKey(key: string): string {
  const cleaned = key.replace(/^flag_/i, '');
  return cleaned
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function groupFlags(flags: { key: string; value: boolean; description?: string }[]): Record<string, typeof flags> {
  const groups: Record<string, typeof flags> = {};
  for (const flag of flags) {
    const group = flag.key.includes('_') ? flag.key.split('_')[0] : 'Generelt';
    if (!groups[group]) groups[group] = [];
    groups[group].push(flag);
  }
  return groups;
}

export default function FeatureFlagsPage() {
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: flags, isLoading, isError, refetch } = useFeatureFlags();
  const toggleMutation = useToggleFeatureFlag();

  const handleToggle = async (flag: { key: string; value: boolean }) => {
    setSavingKey(flag.key);
    try {
      await toggleMutation.mutateAsync({ key: flag.key, enabled: !flag.value });
      toast.success(`"${formatKey(flag.key)}" er ${flag.value ? 'deaktivert' : 'aktivert'}.`);
    } catch {
      toast.error(`Kunne ikke endre "${formatKey(flag.key)}".`);
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Funksjonsflagg" description="Slå funksjoner av og på i plattformen" />
        <AdminLoadingSkeleton rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Funksjonsflagg" description="Slå funksjoner av og på i plattformen" />
        <AdminErrorState onRetry={refetch} />
      </div>
    );
  }

  if (!flags || flags.length === 0) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Funksjonsflagg" description="Slå funksjoner av og på i plattformen" />
        <AdminEmptyState title="Ingen funksjonsflagg" description="Det er ingen funksjonsflagg konfigurert ennå." />
      </div>
    );
  }

  const grouped = groupFlags(flags);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Funksjonsflagg"
        description="Slå funksjoner av og på i plattformen"
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

      {Object.entries(grouped).map(([group, groupFlags]) => (
        <div key={group}>
          <h2 className="text-lg font-bold text-gray-800 mb-3 capitalize">{group}</h2>
          <div className="grid gap-4">
            {groupFlags.map((flag) => {
              const isSaving = savingKey === flag.key;
              return (
                <div
                  key={flag.key}
                  className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800">{formatKey(flag.key)}</p>
                    {flag.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{flag.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggle(flag)}
                    disabled={isSaving}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 disabled:opacity-60 ${
                      flag.value ? 'bg-[#2d4a3e]' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={flag.value}
                    aria-label={`${flag.value ? 'Deaktiver' : 'Aktiver'} ${formatKey(flag.key)}`}
                  >
                    <span
                      className={`pointer-events-none inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
                        flag.value ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    >
                      {flag.value ? (
                        <ToggleRight size={14} className="text-[#2d4a3e]" />
                      ) : (
                        <ToggleLeft size={14} className="text-gray-400" />
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
