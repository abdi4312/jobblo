import { useState } from 'react';
import { Save, RefreshCw, Megaphone } from 'lucide-react';
import { useAnnouncements, useUpdateAnnouncement } from '../../hooks/admin/content';
import { AdminPageHeader, AdminLoadingSkeleton, AdminErrorState, AdminEmptyState } from '../../components/admin';
import { toast } from 'sonner';

interface Announcement {
  key: string;
  text: string;
  type: string;
  active: boolean;
  linkUrl?: string;
}

export default function AnnouncementsPage() {
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Announcement>>>({});

  const { data: announcements, isLoading, isError, refetch } = useAnnouncements();
  const updateMutation = useUpdateAnnouncement();

  const handleChange = (key: string, field: keyof Announcement, value: string | boolean) => {
    setEdits((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSave = async (announcement: Announcement) => {
    const key = announcement.key;
    const edit = edits[key];
    if (!edit) return;

    setSavingKey(key);
    try {
      const payload = { ...announcement, ...edit };
      await updateMutation.mutateAsync(payload as unknown as Record<string, unknown>);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success('Kunngjøring lagret.');
    } catch {
      toast.error('Kunne ikke lagre kunngjøring.');
    } finally {
      setSavingKey(null);
    }
  };

  const announcementList = (announcements as unknown as Announcement[]) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Kunngjøringer" description="Administrer systemmeldinger og varsler" />
        <AdminLoadingSkeleton rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Kunngjøringer" description="Administrer systemmeldinger og varsler" />
        <AdminErrorState onRetry={refetch} />
      </div>
    );
  }

  if (!announcementList.length) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Kunngjøringer" description="Administrer systemmeldinger og varsler" />
        <AdminEmptyState
          title="Ingen kunngjøringer"
          description="Det er ingen kunngjøringer opprettet ennå."
          icon={<Megaphone size={32} />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Kunngjøringer"
        description="Administrer systemmeldinger og varsler"
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

      <div className="grid gap-4">
        {announcementList.map((announcement) => {
          const key = announcement.key;
          const edit = edits[key] ?? {};
          const text = edit.text ?? announcement.text;
          const type = edit.type ?? announcement.type;
          const active = edit.active ?? announcement.active;
          const linkUrl = edit.linkUrl ?? announcement.linkUrl ?? '';
          const isSaving = savingKey === key;
          const hasChanges = key in edits;

          return (
            <div
              key={key}
              className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Megaphone size={16} className="text-gray-400" />
                  <span className="text-xs font-mono text-gray-400 select-all">{key}</span>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Melding</label>
                  <textarea
                    value={text as string}
                    onChange={(e) => handleChange(key, 'text', e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/30 resize-y"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
                    <select
                      value={type as string}
                      onChange={(e) => handleChange(key, 'type', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/30"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Advarsel</option>
                      <option value="success">Suksess</option>
                      <option value="error">Feil</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Aktiv</label>
                    <button
                      onClick={() => handleChange(key, 'active', !active)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 ${
                        active ? 'bg-[#2d4a3e]' : 'bg-gray-200'
                      }`}
                      role="switch"
                      aria-checked={active as boolean}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
                          active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Lenke-URL</label>
                  <input
                    type="text"
                    value={linkUrl as string}
                    onChange={(e) => handleChange(key, 'linkUrl', e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/30"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleSave(announcement)}
                  disabled={!hasChanges || isSaving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#243a30] disabled:opacity-50 rounded-xl transition-colors"
                >
                  <Save size={15} />
                  {isSaving ? 'Lagrer...' : 'Lagre'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
