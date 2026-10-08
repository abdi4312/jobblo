import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, Edit2, Megaphone, Plus, RefreshCw, Save, ScrollText, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminConfirmDialog,
  AdminDataTable,
  AdminFilterSelect,
  AdminLoadingSkeleton,
  AdminPageHeader,
  AdminSearchInput,
  AdminStatCard,
  AdminStatusBadge,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';
import { Button } from '../../components/Ui/Button';
import { Input } from '../../components/Ui/Input';
import { Textarea } from '../../components/Ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/Ui/select';
import {
  useCampaignAnalytics,
  useCampaignDefaults,
  useCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  useUpdateCampaign,
} from '../../hooks/admin/campaigns';
import type { Campaign } from '../../api/admin/campaigns';

type EditableCampaign = Omit<Campaign, '_id'>;
type EditorSection = 'campaign' | 'banner' | 'popup' | 'terms';
type CampaignStatus = 'active' | 'inactive' | 'pending' | 'closed';

const statusOf = (campaign: Campaign, now = Date.now()): CampaignStatus => {
  if (!campaign.enabled) return 'inactive';
  if (new Date(campaign.startDate).getTime() > now) return 'pending';
  if (new Date(campaign.endDate).getTime() < now) return 'closed';
  return 'active';
};

const dateInput = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border-l-2 border-custom-green pl-3 py-1">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      {detail && <p className="text-xs text-gray-500">{detail}</p>}
    </div>
  );
}

export default function CampaignManagementPage() {
  const { data: campaigns = [], isLoading, isError, refetch } = useCampaigns();
  const { data: campaignDefaults, isLoading: isLoadingDefaults } = useCampaignDefaults();
  const createMutation = useCreateCampaign();
  const deleteMutation = useDeleteCampaign();
  const updateMutation = useUpdateCampaign();
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [isNewCampaign, setIsNewCampaign] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeSection, setActiveSection] = useState<EditorSection>('campaign');
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const selected = campaigns.find((campaign) => campaign._id === selectedId) ?? campaigns[0];
  const { data: analytics } = useCampaignAnalytics(selected?._id);
  const [form, setForm] = useState<EditableCampaign | null>(null);
  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('nb-NO');
    return campaigns.filter((campaign) => {
      const matchesSearch = !query || campaign.name.toLocaleLowerCase('nb-NO').includes(query);
      const matchesStatus = !statusFilter || statusOf(campaign) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, search, statusFilter]);
  const campaignColumns: ColumnDef<Campaign>[] = [
    {
      key: 'campaign',
      header: 'Kampanje',
      render: (campaign) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-800">{campaign.name}</p>
          <p className="mt-0.5 truncate text-xs text-gray-400">{campaign.bannerCtaLabel} · Popup {campaign.popupDelayMs / 1000}s</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (campaign) => <AdminStatusBadge status={statusOf(campaign)} />,
    },
    {
      key: 'period',
      header: 'Kampanjeperiode',
      render: (campaign) => (
        <span className="whitespace-nowrap text-sm text-gray-600">
          {new Date(campaign.startDate).toLocaleDateString('nb-NO')} – {new Date(campaign.endDate).toLocaleDateString('nb-NO')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Handlinger',
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (campaign) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-auto gap-1.5 rounded-lg px-2.5 text-xs"
            onClick={() => {
              setSelectedId(campaign._id);
              setActiveSection('campaign');
              setView('edit');
            }}
          >
            <Edit2 size={13} /> Rediger
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="w-9 text-red-600 hover:bg-red-50 hover:text-red-700"
            aria-label={`Slett ${campaign.name}`}
            title={`Slett ${campaign.name}`}
            onClick={() => setDeleteTarget(campaign)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  useEffect(() => {
    if (isNewCampaign || !selected) return;
    const { _id, ...values } = selected;
    setForm({ ...values, startDate: dateInput(values.startDate), endDate: dateInput(values.endDate) });
  }, [selected, isNewCampaign]);

  const change = (field: keyof EditableCampaign) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target instanceof HTMLInputElement && event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;
      setForm((previous) => previous ? { ...previous, [field]: value } : previous);
    };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || (!isNewCampaign && !selected)) return;
    if (form.startDate >= form.endDate) {
      toast.error('Sluttdato må være etter startdato.');
      return;
    }
    const payload: EditableCampaign = {
      ...form,
      startDate: new Date(`${form.startDate}T12:00:00.000Z`).toISOString(),
      endDate: new Date(`${form.endDate}T12:00:00.000Z`).toISOString(),
    };
    try {
      if (isNewCampaign) {
        const created = await createMutation.mutateAsync(payload);
        setSelectedId(created._id);
        setIsNewCampaign(false);
        toast.success('Kampanjen ble opprettet.');
      } else if (selected) {
        await updateMutation.mutateAsync({ ...payload, _id: selected._id });
      }
    } catch {
      return;
    }
  };

  const openCreate = () => {
    if (!campaignDefaults) {
      toast.error('Kampanjestandarder lastes fortsatt. Prøv igjen om litt.');
      return;
    }
    setForm({
      ...campaignDefaults,
      name: '',
      enabled: false,
      startDate: dateInput(campaignDefaults.startDate),
      endDate: dateInput(campaignDefaults.endDate),
    });
    setSelectedId('');
    setIsNewCampaign(true);
    setActiveSection('campaign');
    setView('edit');
  };

  const backToList = () => {
    setView('list');
    if (isNewCampaign) {
      setIsNewCampaign(false);
      setForm(null);
    }
  };

  const deleteSelected = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget._id);
    if (selected?._id === deleteTarget._id) {
      const nextCampaign = campaigns.find((campaign) => campaign._id !== deleteTarget._id);
      setSelectedId(nextCampaign?._id ?? '');
      setForm(null);
      setView('list');
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Kampanjer" description="Administrer kampanjeinnhold og resultater." />
        <AdminLoadingSkeleton rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Kampanjer" description="Administrer kampanjeinnhold og resultater." />
        <AdminErrorState onRetry={refetch} />
      </div>
    );
  }

  const sections: { id: EditorSection; label: string; description: string; icon: React.ReactNode }[] = [
    { id: 'campaign', label: 'Kampanje', description: 'Status og periode', icon: <CalendarDays size={17} /> },
    { id: 'banner', label: 'Banner', description: 'Landingsside', icon: <Megaphone size={17} /> },
    { id: 'popup', label: 'Popup', description: 'A/B-varianter', icon: <Sparkles size={17} /> },
    { id: 'terms', label: 'Vilkår', description: 'Vilkårsside', icon: <ScrollText size={17} /> },
  ];

  const campaignStatus = selected ? statusOf(selected) : 'inactive';
  const activeCount = campaigns.filter((campaign) => statusOf(campaign) === 'active').length;
  const scheduledCount = campaigns.filter((campaign) => statusOf(campaign) === 'pending').length;

  const sectionContent = () => {
    if (!form) return null;
    switch (activeSection) {
      case 'campaign':
        return (
          <section className="space-y-5" aria-labelledby="campaign-settings-heading">
            <div>
              <h2 id="campaign-settings-heading" className="text-base font-semibold text-gray-900">Grunninnstillinger</h2>
              <p className="mt-1 text-sm text-gray-500">Navngi kampanjen og velg når den skal være synlig.</p>
            </div>
            <Field label="Kampanjenavn" id="campaign-name">
              <Input id="campaign-name" value={form.name} onChange={change('name')} maxLength={120} required />
            </Field>
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-gray-800">Publiser kampanjen</p>
                <p className="mt-0.5 text-xs text-gray-500">Når aktivert, blir kampanjen vist innenfor den valgte perioden.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-3">
                <span className="text-sm text-gray-600">{form.enabled ? 'På' : 'Av'}</span>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={change('enabled')}
                  className="peer sr-only"
                  aria-label="Aktiver kampanje"
                />
                <span className="relative h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-[#2d4a3e] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#2d4a3e] after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Startdato" id="campaign-start-date">
                <Input id="campaign-start-date" type="date" value={form.startDate} onChange={change('startDate')} required />
              </Field>
              <Field label="Sluttdato" id="campaign-end-date">
                <Input id="campaign-end-date" type="date" value={form.endDate} onChange={change('endDate')} required />
              </Field>
            </div>
          </section>
        );
      case 'banner':
        return (
          <section className="space-y-5" aria-labelledby="campaign-banner-heading">
            <div>
              <h2 id="campaign-banner-heading" className="text-base font-semibold text-gray-900">Landingssidebanner</h2>
              <p className="mt-1 text-sm text-gray-500">Banneret vises så lenge kampanjen er aktiv og innenfor kampanjeperioden.</p>
            </div>
            <Field label="Bannertekst" id="campaign-banner-text">
              <Textarea id="campaign-banner-text" rows={4} value={form.bannerText} onChange={change('bannerText')} maxLength={1000} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Knappetekst" id="campaign-banner-label">
                <Input id="campaign-banner-label" value={form.bannerCtaLabel} onChange={change('bannerCtaLabel')} maxLength={80} required />
              </Field>
              <Field label="Knappelenke" id="campaign-banner-url">
                <Input id="campaign-banner-url" value={form.bannerCtaUrl} onChange={change('bannerCtaUrl')} maxLength={300} required />
              </Field>
            </div>
          </section>
        );
      case 'popup':
        return (
          <section className="space-y-5" aria-labelledby="campaign-popup-heading">
            <div>
              <h2 id="campaign-popup-heading" className="text-base font-semibold text-gray-900">Popup og A/B-varianter</h2>
              <p className="mt-1 text-sm text-gray-500">Besøkende fordeles automatisk likt mellom variant A og B.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Variant A" id="campaign-popup-a">
                <Textarea id="campaign-popup-a" rows={4} value={form.popupVersionA} onChange={change('popupVersionA')} maxLength={500} required />
              </Field>
              <Field label="Variant B" id="campaign-popup-b">
                <Textarea id="campaign-popup-b" rows={4} value={form.popupVersionB} onChange={change('popupVersionB')} maxLength={500} required />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Knappetekst" id="campaign-popup-label">
                <Input id="campaign-popup-label" value={form.popupCtaLabel} onChange={change('popupCtaLabel')} maxLength={80} required />
              </Field>
              <Field label="Knappelenke" id="campaign-popup-url">
                <Input id="campaign-popup-url" value={form.popupCtaUrl} onChange={change('popupCtaUrl')} maxLength={300} required />
              </Field>
              <Field label="Vis etter (sekunder)" id="campaign-popup-delay">
                <Input id="campaign-popup-delay" type="number" min={0} max={30} step="0.5" value={form.popupDelayMs / 1000} onChange={(event) => setForm({ ...form, popupDelayMs: Number(event.target.value) * 1000 })} required />
              </Field>
              <Field label="Pause etter lukking (timer)" id="campaign-popup-cooldown">
                <Input id="campaign-popup-cooldown" type="number" min={1 / 60} max={8760} step="0.25" value={form.popupCooldownMs / 3600000} onChange={(event) => setForm({ ...form, popupCooldownMs: Number(event.target.value) * 3600000 })} required />
              </Field>
            </div>
          </section>
        );
      case 'terms':
        return (
          <section className="space-y-5" aria-labelledby="campaign-terms-heading">
            <div>
              <h2 id="campaign-terms-heading" className="text-base font-semibold text-gray-900">Kampanjevilkår</h2>
              <p className="mt-1 text-sm text-gray-500">Fullstendige vilkår vises på den offentlige vilkårssiden.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Lenketekst" id="campaign-terms-label">
                <Input id="campaign-terms-label" value={form.termsLabel} onChange={change('termsLabel')} maxLength={80} required />
              </Field>
              <Field label="Vilkårsside" id="campaign-terms-url">
                <Input id="campaign-terms-url" value={form.termsUrl} onChange={change('termsUrl')} maxLength={300} required />
              </Field>
            </div>
            <Field label="Vilkårstekst" id="campaign-disclaimer">
              <Textarea id="campaign-disclaimer" rows={8} value={form.disclaimer} onChange={change('disclaimer')} maxLength={10000} required />
            </Field>
          </section>
        );
    }
  };

  return (
    <main className="space-y-5">
      <AdminPageHeader
        title={view === 'edit' ? (isNewCampaign ? 'Ny kampanje' : 'Rediger kampanje') : 'Kampanjer'}
        description={view === 'edit' ? (isNewCampaign ? 'Konfigurer kampanjen. Den opprettes når du lagrer.' : 'Oppdater kampanjeinnhold, publisering og vilkår.') : 'Administrer kampanjeinnhold, publisering og resultater.'}
        actions={
          <>
            {view === 'edit' ? (
              <Button type="button" variant="secondary" size="sm" className="w-auto gap-2 rounded-lg" onClick={backToList}>
                <ArrowLeft size={15} /> Tilbake til kampanjer
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" size="sm" className="w-auto gap-2 rounded-lg" onClick={() => refetch()}>
                  <RefreshCw size={15} /> Oppdater
                </Button>
                <Button type="button" size="sm" className="w-auto gap-2 rounded-lg" onClick={openCreate} disabled={isLoadingDefaults || !campaignDefaults}>
                  <Plus size={16} /> Ny kampanje
                </Button>
              </>
            )}
          </>
        }
      />

      {view === 'list' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard title="Totale kampanjer" value={campaigns.length} icon={<Megaphone size={18} />} />
            <AdminStatCard title="Aktive nå" value={activeCount} icon={<Sparkles size={18} />} />
            <AdminStatCard title="Planlagt" value={scheduledCount} icon={<CalendarDays size={18} />} />
            <AdminStatCard title="Popupvisninger" value={analytics?.total.impressions ?? '–'} icon={<BarChart3 size={18} />} subtitle={selected ? `Målt for ${selected.name}` : undefined} />
          </div>
          <AdminDataTable
            columns={campaignColumns}
            data={filteredCampaigns}
            keyExtractor={(campaign) => campaign._id}
            loading={false}
            error={false}
            emptyTitle={campaigns.length ? 'Ingen treff' : 'Ingen kampanjer ennå'}
            emptyDescription={campaigns.length ? 'Prøv et annet søk eller statusfilter.' : 'Opprett en kampanje for å konfigurere banner, popup og vilkår.'}
            toolbar={
              <div className="flex w-full flex-wrap gap-3">
                <AdminSearchInput value={search} onChange={setSearch} placeholder="Søk på kampanjenavn..." className="min-w-50 flex-1" />
                <AdminFilterSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="Alle statuser"
                  options={[
                    { label: 'Aktive', value: 'active' },
                    { label: 'Planlagt', value: 'pending' },
                    { label: 'Inaktive', value: 'inactive' },
                    { label: 'Avsluttet', value: 'closed' },
                  ]}
                />
              </div>
            }
          />
        </>
      )}

      {view === 'edit' && !isNewCampaign && campaigns.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <AdminEmptyState
            title="Ingen kampanjer ennå"
            description="Opprett en kampanje for å konfigurere landingssidebanner, popup og vilkår."
            icon={<Megaphone size={30} />}
            action={
              <Button type="button" size="sm" className="w-auto gap-2" onClick={openCreate}>
                <Plus size={16} /> Opprett kampanje
              </Button>
            }
          />
        </div>
      ) : view === 'edit' && form && (isNewCampaign || selected) ? (
        <>
          {!isNewCampaign && selected && <section className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0 flex-1">
              <label htmlFor="campaign-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Valgt kampanje</label>
              <Select value={selected._id} onValueChange={setSelectedId}>
                <SelectTrigger id="campaign-select" className="max-w-xl rounded-xl border-gray-200 bg-white">
                  <SelectValue placeholder="Velg kampanje" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign._id} value={campaign._id}>{campaign.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <AdminStatusBadge status={campaignStatus} />
              <span className="text-xs text-gray-500">
                {new Date(selected.startDate).toLocaleDateString('nb-NO')} – {new Date(selected.endDate).toLocaleDateString('nb-NO')}
              </span>
            </div>
          </section>}

          {!isNewCampaign && analytics && (
            <section aria-label="Kampanjeanalyse" className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800"><BarChart3 size={17} className="text-[#2d4a3e]" /> Resultater</div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Metric label="Visninger" value={analytics.total.impressions.toLocaleString('nb-NO')} />
                <Metric label="CTA-klikk" value={analytics.total.clicks.toLocaleString('nb-NO')} />
                <Metric label="Lukket" value={analytics.total.closes.toLocaleString('nb-NO')} />
                <Metric label="CTR" value={`${analytics.total.ctr}%`} />
              </div>
              <div className="mt-5 grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-2">
                {(['A', 'B'] as const).map((variant) => {
                  const stats = analytics.variants[variant];
                  return <div key={variant} className="min-w-0">
                    <p className="mb-2 text-sm font-semibold text-gray-800">Variant {variant}</p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-500 sm:grid-cols-4">
                      <span>{stats.impressions} visninger</span><span>{stats.clicks} klikk</span><span>{stats.closes} lukket</span><span className="font-semibold text-[#2d4a3e]">CTR {stats.ctr}%</span>
                    </div>
                  </div>;
                })}
              </div>
            </section>
          )}

          <form onSubmit={save} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="grid min-h-112 lg:grid-cols-[14rem_minmax(0,1fr)]">
              <nav aria-label="Kampanjeinnstillinger" className="flex gap-1 overflow-x-auto border-b border-gray-100 p-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:p-3">
                {sections.map((section) => {
                  const active = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveSection(section.id)}
                      className={`flex min-w-max items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors lg:w-full ${active ? 'bg-[#edf3ed] text-[#244b32]' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <span className={active ? 'text-[#2d4a3e]' : 'text-gray-400'}>{section.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{section.label}</span>
                        <span className="hidden text-xs text-gray-500 lg:block">{section.description}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>
              <div role="tabpanel" className="min-w-0 p-4 sm:p-6 lg:p-7">
                {sectionContent()}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-gray-500">Endringer trer i kraft etter lagring.</p>
              <div className="flex items-center justify-end gap-2">
                {activeSection !== 'campaign' && (
                  <Button type="button" variant="secondary" size="sm" className="w-auto rounded-lg" onClick={() => setActiveSection(sections[sections.findIndex((section) => section.id === activeSection) - 1].id)}>
                    Tilbake
                  </Button>
                )}
                {activeSection !== 'terms' && (
                  <Button type="button" variant="secondary" size="sm" className="w-auto rounded-lg" onClick={() => setActiveSection(sections[sections.findIndex((section) => section.id === activeSection) + 1].id)}>
                    Neste
                  </Button>
                )}
                <Button type="submit" size="sm" className="w-auto gap-2 rounded-lg" disabled={updateMutation.isPending || createMutation.isPending}>
                  <Save size={15} />{updateMutation.isPending || createMutation.isPending ? 'Lagrer...' : (isNewCampaign ? 'Opprett kampanje' : 'Lagre kampanje')}
                </Button>
              </div>
            </div>
          </form>
        </>
      ) : null}

      <AdminConfirmDialog
        isOpen={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Slett kampanje?"
        description={deleteTarget ? `«${deleteTarget.name}» fjernes fra kampanjelisten og slås av umiddelbart. Analysehistorikken beholdes.` : 'Denne kampanjen fjernes fra kampanjelisten.'}
        confirmText="Slett kampanje"
        cancelText="Avbryt"
        variant="destructive"
        onConfirm={deleteSelected}
      />
    </main>
  );
}
