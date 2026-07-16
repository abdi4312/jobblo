import { useState, useMemo } from 'react';
import { Save, Settings, RefreshCw } from 'lucide-react';
import { useAllConfigs, useUpdateConfig } from '../../hooks/admin/content';
import { AdminPageHeader, AdminLoadingSkeleton, AdminErrorState } from '../../components/admin';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../../components/Ui/dialog';
import { Input } from '../../components/Ui/Input';
import { Textarea } from '../../components/Ui/textarea';
import { Button } from '../../components/Ui/Button';
import { toast } from 'sonner';

interface ConfigEntry {
  key: string;
  value: unknown;
  description?: string;
}

function getValueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeConfigs(data: Record<string, unknown> | undefined): ConfigEntry[] {
  if (!data) return [];
  return Object.entries(data).map(([key, val]) => {
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && 'value' in (val as Record<string, unknown>)) {
      const obj = val as { value: unknown; description?: string };
      return { key, value: obj.value, description: obj.description };
    }
    return { key, value: val, description: undefined };
  });
}

export default function GlobalSettingsPage() {
  const { data, isLoading, isError, refetch } = useAllConfigs();
  const updateMutation = useUpdateConfig();

  const [editingConfig, setEditingConfig] = useState<ConfigEntry | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const configs = useMemo(() => normalizeConfigs(data as Record<string, unknown> | undefined), [data]);

  const handleOpenEdit = (entry: ConfigEntry) => {
    setEditingConfig(entry);
    setEditValue(formatDisplayValue(entry.value));
    setEditDescription(entry.description ?? '');
  };

  const handleCloseEdit = () => {
    setEditingConfig(null);
    setEditValue('');
    setEditDescription('');
  };

  const handleSave = async () => {
    if (!editingConfig) return;
    setSaving(true);
    try {
      const originalValue = editingConfig.value;
      let parsedValue: unknown = editValue;

      if (typeof originalValue === 'number') {
        parsedValue = Number(editValue);
        if (isNaN(parsedValue as number)) {
          toast.error('Verdien må være et gyldig tall.');
          setSaving(false);
          return;
        }
      } else if (typeof originalValue === 'boolean') {
        if (editValue.toLowerCase() === 'true') parsedValue = true;
        else if (editValue.toLowerCase() === 'false') parsedValue = false;
        else {
          toast.error('Verdien må være "true" eller "false".');
          setSaving(false);
          return;
        }
      } else if (originalValue !== null && typeof originalValue === 'object') {
        try {
          parsedValue = JSON.parse(editValue);
        } catch {
          toast.error('Ugyldig JSON-format for objektverdien.');
          setSaving(false);
          return;
        }
      }

      await updateMutation.mutateAsync({
        key: editingConfig.key,
        value: parsedValue,
        ...(editDescription !== editingConfig.description ? { description: editDescription } : {}),
      });
      handleCloseEdit();
    } catch {
      toast.error('Kunne ikke lagre konfigurasjonen.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Globale innstillinger" description="Administrer systeminnstillinger og konfigurasjon" />
        <AdminLoadingSkeleton rows={8} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Globale innstillinger" description="Administrer systeminnstillinger og konfigurasjon" />
        <AdminErrorState onRetry={refetch} />
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Globale innstillinger"
          description="Administrer systeminnstillinger og konfigurasjon"
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
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="p-3 bg-gray-50 rounded-2xl inline-flex mb-3">
            <Settings size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700">Ingen innstillinger</p>
          <p className="text-xs text-gray-400 mt-0.5">Det er ingen konfigurasjonsinnstillinger tilgjengelig.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Globale innstillinger"
        description="Administrer systeminnstillinger og konfigurasjon"
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

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nøkkel</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Verdi</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Beskrivelse</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {configs.map((entry) => (
                <tr key={entry.key} className="hover:bg-gray-50/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <code className="text-sm font-mono font-medium text-gray-800">{entry.key}</code>
                  </td>
                  <td className="px-5 py-3.5 max-w-[260px]">
                    <span className="block truncate text-sm text-gray-600 font-mono" title={formatDisplayValue(entry.value)}>
                      {formatDisplayValue(entry.value)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                      {getValueType(entry.value)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 max-w-[200px]">
                    <span className="block truncate text-sm text-gray-500">
                      {entry.description ?? <span className="text-gray-300 italic">–</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleOpenEdit(entry)}
                      className="px-3 py-1.5 text-xs font-medium text-[#2d4a3e] bg-[#2d4a3e]/10 hover:bg-[#2d4a3e]/20 rounded-lg transition-colors"
                    >
                      Rediger
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/30">
          <p className="text-xs text-gray-400">{configs.length} innstillinger totalt</p>
        </div>
      </div>

      <Dialog open={!!editingConfig} onOpenChange={(open) => { if (!open) handleCloseEdit(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rediger innstilling</DialogTitle>
            <DialogDescription>Oppdater verdien og beskrivelsen for denne konfigurasjonsnøkkelen.</DialogDescription>
          </DialogHeader>

          {editingConfig && (
            <div className="space-y-4 py-2">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Nøkkel</label>
                <Input value={editingConfig.key} disabled className="bg-gray-50" />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Verdi
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">
                    ({getValueType(editingConfig.value)})
                  </span>
                </label>
                {typeof editingConfig.value === 'object' && editingConfig.value !== null && !Array.isArray(editingConfig.value) ? (
                  <Textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={5}
                    className="font-mono text-sm"
                    placeholder="Angi JSON-verdi..."
                  />
                ) : (
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Angi verdi..."
                  />
                )}
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Beskrivelse</label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Kort beskrivelse av innstillingen..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}>Avbryt</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#2d4a3e] hover:bg-[#233b31] text-white"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Lagrer...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save size={15} />
                  Lagre
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
