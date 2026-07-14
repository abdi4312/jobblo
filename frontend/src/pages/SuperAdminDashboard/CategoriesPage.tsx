import React, { useState } from 'react';
import { Plus, Loader2, Tag } from 'lucide-react';
import {
    useAdminCategories,
    useCreateAdminCategory,
    useUpdateAdminCategory,
    useToggleAdminCategory,
    useDeleteAdminCategory,
} from '../../hooks/admin';
import type { AdminCategory } from '../../api/admin';
import {
    AdminDataTable,
    AdminSearchInput,
    AdminFilterSelect,
    AdminConfirmDialog,
    AdminPageHeader,
    AdminStatusBadge,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const ACTIVE_OPTIONS = [
    { label: 'Aktive', value: 'true' },
    { label: 'Inaktive', value: 'false' },
];

interface CategoryForm {
    name: string;
    description: string;
    sortOrder: string;
}

const emptyForm: CategoryForm = { name: '', description: '', sortOrder: '0' };

export default function CategoriesPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
    const [editTarget, setEditTarget] = useState<AdminCategory | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState<CategoryForm>(emptyForm);
    const [formError, setFormError] = useState('');

    const handleSearchChange = (val: string) => {
        setSearch(val);
        clearTimeout((handleSearchChange as any)._t);
        (handleSearchChange as any)._t = setTimeout(() => {
            setDebouncedSearch(val);
            setPage(1);
        }, 400);
    };

    const { data, isLoading, isError, refetch } = useAdminCategories({
        page,
        limit: 20,
        search: debouncedSearch,
        ...(activeFilter && { isActive: activeFilter }),
    });

    const createMutation = useCreateAdminCategory();
    const updateMutation = useUpdateAdminCategory();
    const toggleMutation = useToggleAdminCategory();
    const deleteMutation = useDeleteAdminCategory();

    const openCreate = () => { setForm(emptyForm); setFormError(''); setCreateOpen(true); };
    const openEdit = (cat: AdminCategory) => {
        setEditTarget(cat);
        setForm({ name: cat.name, description: cat.description ?? '', sortOrder: String(cat.sortOrder) });
        setFormError('');
    };

    const handleSave = async () => {
        if (!form.name.trim()) { setFormError('Kategorinavn er påkrevd.'); return; }
        if (createOpen) {
            await createMutation.mutateAsync({
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                sortOrder: parseInt(form.sortOrder, 10) || 0,
            });
            setCreateOpen(false);
        } else if (editTarget) {
            await updateMutation.mutateAsync({
                id: editTarget._id,
                payload: {
                    name: form.name.trim(),
                    description: form.description.trim() || undefined,
                    sortOrder: parseInt(form.sortOrder, 10) || 0,
                },
            });
            setEditTarget(null);
        }
        setForm(emptyForm);
    };

    const isPending = createMutation.isPending || updateMutation.isPending;

    const columns: ColumnDef<AdminCategory>[] = [
        {
            key: 'name',
            header: 'Navn',
            render: (c) => (
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-100 rounded-lg" aria-hidden="true">
                        <Tag size={14} className="text-gray-500" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{c.slug}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'description',
            header: 'Beskrivelse',
            render: (c) => (
                <span className="text-sm text-gray-500 truncate max-w-[200px] block">
                    {c.description ?? <span className="text-gray-300 italic">–</span>}
                </span>
            ),
        },
        {
            key: 'sortOrder',
            header: 'Sortering',
            render: (c) => <span className="text-sm text-gray-600">{c.sortOrder}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            render: (c) => <AdminStatusBadge status={c.isActive ? 'active' : 'inactive'} />,
        },
        {
            key: 'date',
            header: 'Opprettet',
            render: (c) =>
                new Date(c.createdAt).toLocaleDateString('nb-NO', {
                    day: '2-digit', month: 'short', year: 'numeric',
                }),
        },
        {
            key: 'actions',
            header: 'Handlinger',
            className: 'whitespace-nowrap',
            render: (c) => (
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => openEdit(c)}
                        className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        aria-label={`Rediger ${c.name}`}
                    >
                        Rediger
                    </button>
                    <button
                        onClick={() => toggleMutation.mutate(c._id)}
                        disabled={toggleMutation.isPending}
                        className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                        aria-label={`${c.isActive ? 'Deaktiver' : 'Aktiver'} ${c.name}`}
                    >
                        {c.isActive ? 'Deaktiver' : 'Aktiver'}
                    </button>
                    <button
                        onClick={() => setDeleteTarget(c)}
                        className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        aria-label={`Slett ${c.name}`}
                    >
                        Slett
                    </button>
                </div>
            ),
        },
    ];

    const isFormOpen = createOpen || !!editTarget;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Kategorier"
                description="Administrer tjenestekategorier"
                actions={
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]"
                    >
                        <Plus size={16} />
                        Ny kategori
                    </button>
                }
            />

            <AdminDataTable
                columns={columns}
                data={data?.categories ?? []}
                keyExtractor={(c) => c._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen kategorier"
                emptyDescription="Opprett den første kategorien."
                pagination={data?.pagination}
                onPageChange={setPage}
                toolbar={
                    <div className="flex flex-wrap gap-3 w-full">
                        <AdminSearchInput
                            value={search}
                            onChange={handleSearchChange}
                            placeholder="Søk på kategorinavn..."
                            className="flex-1 min-w-[180px]"
                        />
                        <AdminFilterSelect
                            value={activeFilter}
                            onChange={(v) => { setActiveFilter(v); setPage(1); }}
                            options={ACTIVE_OPTIONS}
                            placeholder="Alle statuser"
                        />
                    </div>
                }
            />

            {/* Create / Edit dialog */}
            {isFormOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="cat-form-title"
                >
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h2 id="cat-form-title" className="text-lg font-bold text-gray-900">
                            {createOpen ? 'Ny kategori' : `Rediger: ${editTarget?.name}`}
                        </h2>

                        <div>
                            <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700 mb-1">
                                Navn *
                            </label>
                            <input
                                id="cat-name"
                                type="text"
                                value={form.name}
                                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFormError(''); }}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
                                aria-invalid={!!formError}
                                aria-describedby={formError ? 'cat-name-err' : undefined}
                            />
                            {formError && <p id="cat-name-err" className="text-xs text-red-600 mt-1">{formError}</p>}
                        </div>

                        <div>
                            <label htmlFor="cat-desc" className="block text-sm font-medium text-gray-700 mb-1">
                                Beskrivelse
                            </label>
                            <textarea
                                id="cat-desc"
                                rows={2}
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none"
                            />
                        </div>

                        <div>
                            <label htmlFor="cat-sort" className="block text-sm font-medium text-gray-700 mb-1">
                                Sorteringsrekkefølge
                            </label>
                            <input
                                id="cat-sort"
                                type="number"
                                min="0"
                                value={form.sortOrder}
                                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => { setCreateOpen(false); setEditTarget(null); }}
                                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors disabled:opacity-60"
                            >
                                {isPending && <Loader2 size={14} className="animate-spin" />}
                                {createOpen ? 'Opprett' : 'Lagre'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AdminConfirmDialog
                title="Slett kategori?"
                description={`"${deleteTarget?.name}" slettes permanent. Kun mulig om ingen tjenester bruker denne kategorien.`}
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
