import React, { useState, useCallback } from 'react';
import { CreditCard, CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';
import { useAdminTransactions } from '../../hooks/admin';
import type { AdminTransactionsQuery, AdminTransaction } from '../../api/admin';
import {
  AdminDataTable,
  AdminSearchInput,
  AdminFilterSelect,
  AdminStatusBadge,
  AdminPageHeader,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const STATUS_OPTIONS = [
  { label: 'Venter', value: 'pending' },
  { label: 'Vellykket', value: 'succeeded' },
  { label: 'Feilet', value: 'failed' },
  { label: 'Refundert', value: 'refunded' },
];
const TYPE_OPTIONS = [
  { label: 'Abonnement', value: 'subscription' },
  { label: 'Ekstra kontakter', value: 'extra_contact' },
];

function StatusIcon({ status }: { status: string }) {
  if (status === 'succeeded') return <CheckCircle2 size={14} className="text-green-500" />;
  if (status === 'failed') return <XCircle size={14} className="text-red-500" />;
  if (status === 'refunded') return <RotateCcw size={14} className="text-purple-500" />;
  return <Clock size={14} className="text-yellow-500" />;
}

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  }, []);

  const query: AdminTransactionsQuery = {
    page,
    limit: 15,
    search: debouncedSearch,
    ...(statusFilter && { status: statusFilter }),
    ...(typeFilter && { type: typeFilter }),
    sortOrder: 'desc',
  };

  const { data, isLoading, isError, refetch } = useAdminTransactions(query);

  const columns: ColumnDef<AdminTransaction>[] = [
    {
      key: 'user',
      header: 'Bruker',
      render: (t) => (
        <div>
          <p className="text-sm font-medium text-gray-800">{t.userId?.name ?? '–'}</p>
          <p className="text-xs text-gray-400">{t.userId?.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (t) => (
        <div>
          <p className="text-sm text-gray-700">{t.planName}</p>
          <p className="text-xs text-gray-400 capitalize">{t.planType}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (t) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          {t.type === 'subscription' ? 'Abonnement' : 'Ekstra kontakter'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Beløp',
      render: (t) => (
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {(t.amount / 100).toLocaleString('nb-NO')} {t.currency.toUpperCase()}
          </p>
          {t.discountAmount > 0 && (
            <p className="text-xs text-green-600">
              -{(t.discountAmount / 100).toLocaleString('nb-NO')} rabatt
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <div className="flex items-center gap-1.5">
          <StatusIcon status={t.status} />
          <AdminStatusBadge status={t.status} />
        </div>
      ),
    },
    {
      key: 'refunded',
      header: 'Refundert',
      render: (t) => (
        <span className={`text-xs font-medium ${t.refunded ? 'text-purple-600' : 'text-gray-400'}`}>
          {t.refunded ? 'Ja' : 'Nei'}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Dato',
      render: (t) =>
        new Date(t.createdAt).toLocaleDateString('nb-NO', {
          day: '2-digit', month: 'short', year: 'numeric',
        }),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Transaksjoner"
        description="Alle betalingstransaksjoner — ingen sensitive betalingsdata vises"
      />

      <AdminDataTable
        columns={columns}
        data={data?.transactions ?? []}
        keyExtractor={(t) => t._id}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
        emptyTitle="Ingen transaksjoner"
        emptyDescription="Ingen transaksjoner matcher søket."
        pagination={data?.pagination}
        onPageChange={setPage}
        toolbar={
          <div className="flex flex-wrap gap-3 w-full">
            <AdminSearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Søk på plannavn eller kupong..."
              className="flex-1 min-w-[200px]"
            />
            <AdminFilterSelect
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={STATUS_OPTIONS}
              placeholder="Alle statuser"
            />
            <AdminFilterSelect
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v); setPage(1); }}
              options={TYPE_OPTIONS}
              placeholder="Alle typer"
            />
          </div>
        }
      />

      {/* Summary cards */}
      {data && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Totalt', value: data.pagination.total, icon: <CreditCard size={16} />, color: 'text-gray-600' },
            { label: 'Denne siden', value: data.transactions.length, icon: <CreditCard size={16} />, color: 'text-blue-600' },
            {
              label: 'Vellykket',
              value: data.transactions.filter((t) => t.status === 'succeeded').length,
              icon: <CheckCircle2 size={16} />,
              color: 'text-green-600',
            },
            {
              label: 'Feilet',
              value: data.transactions.filter((t) => t.status === 'failed').length,
              icon: <XCircle size={16} />,
              color: 'text-red-600',
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <span className={s.color}>{s.icon}</span>
              <div>
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
