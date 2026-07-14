import React, { useState, useCallback } from 'react';
import { Briefcase } from 'lucide-react';
import { useAdminServices, useUpdateServiceStatus, useDeleteAdminService } from '../../hooks/admin';
import type { AdminServicesQuery, AdminService } from '../../api/admin';
import {
  AdminDataTable,
  AdminSearchInput,
  AdminFilterSelect,
  AdminStatusBadge,
  AdminConfirmDialog,
  AdminPageHeader,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const STATUS_OPTIONS = [
  { label: 'Åpen', value: 'open' },
  { label: 'Lukket', value: 'closed' },
  { label: 'Pågår', value: 'in_progress' },
  { label: 'Fullført', value: 'completed' },
  { label: 'Venter', value: 'pending' },
  { label: 'Avbrutt', value: 'cancelled' },
  { label: 'Utløpt', value: 'expired' },
  { label: 'Utkast', value: 'draft' },
];

export default function ServicesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminService | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ service: AdminService; newStatus: string } | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  }, []);

  const query: AdminServicesQuery = {
    page,
    limit: 15,
    search: debouncedSearch,
    ...(statusFilter && { status: statusFilter }),
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  const { data, isLoading, isError, refetch } = useAdminServices(query);
  const statusMutation = useUpdateServiceStatus();
  const deleteMutation = useDeleteAdminService();

  const columns: ColumnDef<AdminService>[] = [
    {
      key: 'image',
      header: 'Bilde',
      render: (s) => {
        const img = s.images?.[0];
        return img ? (
          <img src={img} alt={s.title} className="w-12 h-12 object-cover rounded-lg" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <Briefcase size={16} className="text-gray-300" />
          </div>
        );
      },
      className: 'w-16',
    },
    {
      key: 'title',
      header: 'Tittel',
      render: (s) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">{s.title}</p>
          <p className="text-xs text-gray-400 truncate max-w-[200px]">
            {s.categories.slice(0, 2).join(', ')}
          </p>
        </div>
      ),
    },
    {
      key: 'provider',
      header: 'Tilbyder',
      render: (s) => (
        <div>
          <p className="text-sm text-gray-700">{s.userId?.name ?? '–'}</p>
          <p className="text-xs text-gray-400">{s.userId?.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Pris',
      render: (s) => (
        <span className="font-semibold text-gray-800">
          {s.price.toLocaleString('nb-NO')} NOK
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => <AdminStatusBadge status={s.status} />,
    },
    {
      key: 'views',
      header: 'Visninger',
      render: (s) => <span className="text-sm text-gray-600">{s.views}</span>,
    },
    {
      key: 'date',
      header: 'Opprettet',
      render: (s) =>
        new Date(s.createdAt).toLocaleDateString('nb-NO', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: 'Handlinger',
      className: 'whitespace-nowrap',
      render: (s) => (
        <div className="flex items-center gap-1.5">
          {/* Quick status toggle open/closed */}
          <button
            onClick={() =>
              setStatusTarget({
                service: s,
                newStatus: s.status === 'open' ? 'closed' : 'open',
              })
            }
            className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label={`${s.status === 'open' ? 'Lukk' : 'Åpne'} ${s.title}`}
          >
            {s.status === 'open' ? 'Lukk' : 'Åpne'}
          </button>
          <button
            onClick={() => setDeleteTarget(s)}
            className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            aria-label={`Slett ${s.title}`}
          >
            Slett
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tjenester"
        description="Alle tjenester publisert på plattformen"
      />

      <AdminDataTable
        columns={columns}
        data={data?.services ?? []}
        keyExtractor={(s) => s._id}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
        emptyTitle="Ingen tjenester"
        emptyDescription="Ingen tjenester matcher søket."
        pagination={data?.pagination}
        onPageChange={setPage}
        toolbar={
          <div className="flex flex-wrap gap-3 w-full">
            <AdminSearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Søk på tittel eller beskrivelse..."
              className="flex-1 min-w-[200px]"
            />
            <AdminFilterSelect
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={STATUS_OPTIONS}
              placeholder="Alle statuser"
            />
          </div>
        }
      />

      {/* Status change confirm */}
      <AdminConfirmDialog
        title="Endre tjenestestatus?"
        description={`Sett "${statusTarget?.service.title}" til "${statusTarget?.newStatus}"?`}
        confirmText="Ja, oppdater"
        cancelText="Avbryt"
        isOpen={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        onConfirm={async () => {
          if (!statusTarget) return;
          await statusMutation.mutateAsync({ id: statusTarget.service._id, status: statusTarget.newStatus });
          setStatusTarget(null);
        }}
      />

      {/* Delete confirm */}
      <AdminConfirmDialog
        title="Slett tjeneste?"
        description={`"${deleteTarget?.title}" vil bli permanent slettet. Bilder fjernes fra Cloudinary.`}
        confirmText="Ja, slett"
        cancelText="Avbryt"
        variant="destructive"
        isOpen={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMutation.mutateAsync(deleteTarget._id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
