import React, { useState, useCallback } from 'react';
import { Users, UserPlus, Calendar, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminUsers, useCreateAdminUser, useChangeUserRole, useSoftDeleteUser, useVerifyUser, useUpdateUserStatus } from '../../hooks/admin';
import { AdminDataTable, AdminSearchInput, AdminFilterSelect, AdminStatusBadge, AdminConfirmDialog, AdminPageHeader, AdminStatCard } from '../../components/admin';
import type { AdminUser } from '../../types/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';
import { useUserStore } from '../../stores/userStore';

// Role options — superAdmin is NOT in this list (cannot be set via form)
const ROLE_OPTIONS = [
  { label: 'Bruker', value: 'user' },
  { label: 'Tilbyder', value: 'provider' },
  { label: 'Bedrift', value: 'company' },
];
const ROLE_FILTER_OPTIONS = [
  { label: 'Bruker', value: 'user' },
  { label: 'Tilbyder', value: 'provider' },
  { label: 'Bedrift', value: 'company' },
  { label: 'Super Admin', value: 'superAdmin' },
];
const STATUS_OPTIONS = [
  { label: 'Aktiv', value: 'active' },
  { label: 'Inaktiv', value: 'inactive' },
  { label: 'Verifisert', value: 'verified' },
];

export default function UsersPage() {
  const currentUser = useUserStore((s) => s.user);

  // Query state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Debounce search
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  }, []);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<{ user: AdminUser; newRole: string } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'user' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Data
  const { data, isLoading, isError, refetch } = useAdminUsers({
    page,
    limit: 15,
    search: debouncedSearch,
    role: roleFilter,
    accountStatus: statusFilter,
  });

  // Mutations
  const createMutation = useCreateAdminUser();
  const roleMutation = useChangeUserRole();
  const deleteMutation = useSoftDeleteUser();
  const verifyMutation = useVerifyUser();
  const statusMutation = useUpdateUserStatus();

  // Table columns
  const columns: ColumnDef<AdminUser>[] = [
    {
      key: 'user',
      header: 'Bruker',
      render: (u) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={
              u.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=2d4a3e&color=fff&size=40`
            }
            alt={u.name}
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
            <p className="text-xs text-gray-400 truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rolle',
      render: (u) => <AdminStatusBadge status={u.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => <AdminStatusBadge status={u.accountStatus} />,
    },
    {
      key: 'verified',
      header: 'Verifisert',
      render: (u) => (
        <span className={`text-xs font-medium ${u.verified ? 'text-green-600' : 'text-gray-400'}`}>
          {u.verified ? 'Ja' : 'Nei'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Registrert',
      render: (u) =>
        new Date(u.createdAt).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      key: 'actions',
      header: 'Handlinger',
      className: 'whitespace-nowrap',
      render: (u) => {
        const isSelf = u._id === currentUser?._id;
        return (
          <div className="flex items-center gap-1.5">
            {/* Verify */}
            {!u.verified && (
              <button
                onClick={() => verifyMutation.mutate(u._id)}
                disabled={verifyMutation.isPending}
                className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                aria-label={`Verifiser ${u.name}`}
              >
                Verifiser
              </button>
            )}
            {/* Toggle status */}
            {!isSelf && (
              <button
                onClick={() =>
                  statusMutation.mutate({
                    id: u._id,
                    accountStatus: u.accountStatus === 'active' ? 'inactive' : 'active',
                  })
                }
                disabled={statusMutation.isPending}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                aria-label={`${u.accountStatus === 'active' ? 'Deaktiver' : 'Aktiver'} ${u.name}`}
              >
                {u.accountStatus === 'active' ? 'Deaktiver' : 'Aktiver'}
              </button>
            )}
            {/* Change role — only for non-superAdmin targets and non-self */}
            {!isSelf && u.role !== 'superAdmin' && (
              <select
                value={u.role}
                onChange={(e) => {
                  const newRole = e.target.value;
                  if (newRole !== u.role) {
                    setRoleTarget({ user: u, newRole });
                  }
                }}
                className="px-2 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
                aria-label={`Endre rolle for ${u.name}`}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}
            {/* Delete */}
            {!isSelf && (
              <button
                onClick={() => setDeleteTarget(u)}
                disabled={deleteMutation.isPending}
                className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                aria-label={`Arkiver ${u.name}`}
              >
                Arkiver
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // Form validation
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Navn er påkrevd.';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Gyldig e-post er påkrevd.';
    if (!form.password || form.password.length < 6) errors.password = 'Passord må ha minst 6 tegn.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    await createMutation.mutateAsync({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password,
      role: form.role,
    });
    setCreateOpen(false);
    setForm({ name: '', email: '', phone: '', password: '', role: 'user' });
    setFormErrors({});
  };

  const stats = data?.pagination
    ? {
      total: data.pagination.total,
      thisPage: data.users.length,
    }
    : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Brukere"
        description="Administrer alle plattformbrukere"
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]"
          >
            <Plus size={16} />
            Ny bruker
          </button>
        }
      />

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AdminStatCard
            title="Totale brukere"
            value={stats.total}
            icon={<Users size={18} />}
          />
          <AdminStatCard
            title="Søkeresultater"
            value={stats.thisPage}
            icon={<UserPlus size={18} />}
          />
          <AdminStatCard
            title="Sider"
            value={data?.pagination.totalPages ?? 0}
            icon={<Calendar size={18} />}
          />
        </div>
      )}

      {/* Table with toolbar */}
      <AdminDataTable
        columns={columns}
        data={data?.users ?? []}
        keyExtractor={(u) => u._id}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
        emptyTitle="Ingen brukere"
        emptyDescription="Ingen brukere matcher søket ditt."
        pagination={data?.pagination}
        onPageChange={setPage}
        toolbar={
          <div className="flex flex-wrap gap-3 w-full">
            <AdminSearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Søk på navn, e-post, telefon..."
              className="flex-1 min-w-[200px]"
            />
            <AdminFilterSelect
              value={roleFilter}
              onChange={(v) => { setRoleFilter(v); setPage(1); }}
              options={ROLE_FILTER_OPTIONS}
              placeholder="Alle roller"
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

      {/* Create user dialog */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-title"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 id="create-user-title" className="text-lg font-bold text-gray-900">
              Opprett ny bruker
            </h2>

            {(['name', 'email', 'phone', 'password'] as const).map((field) => (
              <div key={field}>
                <label htmlFor={`create-${field}`} className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                  {field === 'name' ? 'Navn *' : field === 'email' ? 'E-post *' : field === 'phone' ? 'Telefon' : 'Passord *'}
                </label>
                <input
                  id={`create-${field}`}
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 focus:border-[#2d4a3e]"
                  aria-describedby={formErrors[field] ? `err-${field}` : undefined}
                  aria-invalid={!!formErrors[field]}
                />
                {formErrors[field] && (
                  <p id={`err-${field}`} className="text-xs text-red-600 mt-1">{formErrors[field]}</p>
                )}
              </div>
            ))}

            <div>
              <label htmlFor="create-role" className="block text-sm font-medium text-gray-700 mb-1">
                Rolle *
              </label>
              <select
                id="create-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setCreateOpen(false); setFormErrors({}); }}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors disabled:opacity-60"
              >
                {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Opprett bruker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role change confirm */}
      <AdminConfirmDialog
        title="Endre brukerrolle?"
        description={`Vil du endre rollen til "${roleTarget?.user.name}" til "${roleTarget?.newRole}"?`}
        confirmText="Ja, endre rolle"
        cancelText="Avbryt"
        isOpen={!!roleTarget}
        onOpenChange={(open) => !open && setRoleTarget(null)}
        onConfirm={async () => {
          if (!roleTarget) return;
          await roleMutation.mutateAsync({ id: roleTarget.user._id, role: roleTarget.newRole });
          setRoleTarget(null);
        }}
      />

      {/* Delete confirm */}
      <AdminConfirmDialog
        title="Arkiver bruker?"
        description={`"${deleteTarget?.name}" vil bli deaktivert og arkivert. Alle tilhørende data bevares.`}
        confirmText="Ja, arkiver"
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
