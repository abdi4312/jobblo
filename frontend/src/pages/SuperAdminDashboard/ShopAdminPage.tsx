import { useState } from 'react';
import { Plus, Save, Edit3, Trash2, ShoppingBag, Coins, ToggleLeft, ToggleRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import mainLink from '../../api/mainURLs';
import { AdminDataTable, AdminPageHeader, AdminConfirmDialog, AdminStatusBadge } from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

interface ShopItem {
    _id: string;
    title: string;
    description: string;
    coins: number;
    category: 'coins' | 'premium' | 'feature';
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface ShopForm {
    title: string;
    description: string;
    coins: string;
    category: 'coins' | 'premium' | 'feature';
}

const emptyForm: ShopForm = { title: '', description: '', coins: '0', category: 'coins' };

const fetchShopItems = async (page: number) => {
    const resp = await mainLink.get(`/api/admin/shop?page=${page}&limit=15`);
    return { items: resp.data.data.items as ShopItem[], pagination: resp.data.pagination };
};

const createShopItem = async (payload: ShopForm) => {
    const resp = await mainLink.post('/api/admin/shop', {
        ...payload,
        coins: parseInt(payload.coins, 10) || 0,
    });
    return resp.data;
};

const updateShopItem = async (id: string, payload: ShopForm) => {
    const resp = await mainLink.put(`/api/admin/shop/${id}`, {
        ...payload,
        coins: parseInt(payload.coins, 10) || 0,
    });
    return resp.data;
};

const toggleShopItem = async (id: string) => {
    const resp = await mainLink.put(`/api/admin/shop/${id}/toggle`);
    return resp.data;
};

const deleteShopItem = async (id: string) => {
    await mainLink.delete(`/api/admin/shop/${id}`);
};

export default function ShopAdminPage() {
    const qc = useQueryClient();
    const [page, setPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState<ShopItem | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<ShopItem | null>(null);
    const [form, setForm] = useState<ShopForm>(emptyForm);
    const [formError, setFormError] = useState('');

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['admin-shop', page],
        queryFn: () => fetchShopItems(page),
        staleTime: 30_000,
    });

    const toggleMutation = useMutation({
        mutationFn: toggleShopItem,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-shop'] }); toast.success('Status oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere status.'),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteShopItem,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-shop'] }); toast.success('Vare slettet.'); },
        onError: () => toast.error('Kunne ikke slette varen.'),
    });

    const saveMutation = useMutation({
        mutationFn: async (values: ShopForm) => {
            if (editTarget) {
                await updateShopItem(editTarget._id, values);
            } else {
                await createShopItem(values);
            }
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin-shop'] });
            toast.success(editTarget ? 'Vare oppdatert.' : 'Vare opprettet.');
            setCreateOpen(false);
            setEditTarget(null);
        },
        onError: (err: { response?: { data?: { error?: string } } }) =>
            toast.error(err?.response?.data?.error || 'Operasjon feilet.'),
    });

    const openCreate = () => {
        setForm(emptyForm);
        setEditTarget(null);
        setFormError('');
        setCreateOpen(true);
    };

    const openEdit = (item: ShopItem) => {
        setEditTarget(item);
        setForm({
            title: item.title,
            description: item.description || '',
            coins: String(item.coins),
            category: item.category,
        });
        setFormError('');
        setCreateOpen(true);
    };

    const handleSave = async () => {
        if (!form.title.trim()) { setFormError('Tittel er påkrevd.'); return; }
        await saveMutation.mutateAsync(form);
        setForm(emptyForm);
    };

    const items = data?.items ?? [];
    const pagination = data?.pagination;

    const columns: ColumnDef<ShopItem>[] = [
        {
            key: 'title',
            header: 'Tittel',
            render: (item) => (
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-100 rounded-lg" aria-hidden="true">
                        <ShoppingBag size={14} className="text-gray-500" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{item.title}</span>
                </div>
            ),
        },
        {
            key: 'description',
            header: 'Beskrivelse',
            render: (item) => (
                <span className="text-sm text-gray-500 truncate max-w-[220px] block">
                    {item.description || <span className="text-gray-300 italic">–</span>}
                </span>
            ),
        },
        {
            key: 'coins',
            header: 'Mynter',
            render: (item) => (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                    <Coins size={12} /> {item.coins}
                </span>
            ),
        },
        {
            key: 'category',
            header: 'Kategori',
            render: (item) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                    {item.category === 'coins' ? 'Mynter' : item.category === 'premium' ? 'Premium' : 'Funksjon'}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (item) => <AdminStatusBadge status={item.isActive ? 'active' : 'inactive'} />,
        },
        {
            key: 'created',
            header: 'Opprettet',
            render: (item) =>
                new Date(item.createdAt).toLocaleDateString('nb-NO', {
                    day: '2-digit', month: 'short', year: 'numeric',
                }),
        },
        {
            key: 'actions',
            header: 'Handlinger',
            className: 'whitespace-nowrap',
            render: (item) => (
                <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                        <Edit3 size={12} /> Rediger
                    </button>
                    <button onClick={() => toggleMutation.mutate(item._id)} disabled={toggleMutation.isPending}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
                        {item.isActive ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}
                        {item.isActive ? 'Deaktiver' : 'Aktiver'}
                    </button>
                    <button onClick={() => setDeleteTarget(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                        <Trash2 size={12} /> Slett
                    </button>
                </div>
            ),
        },
    ];

    const isFormOpen = createOpen || !!editTarget;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Shop - Mynthandel"
                description="Administrer Jobblo Shop-varer og myntpakker"
                actions={
                    <button onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors">
                        <Plus size={16} /> Ny vare
                    </button>
                }
            />

            <AdminDataTable
                columns={columns}
                data={items}
                keyExtractor={(item) => item._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen shop-varer"
                emptyDescription="Opprett den første varen i shoppen."
                pagination={pagination}
                onPageChange={setPage}
            />

            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="shop-form-title">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 overflow-y-auto max-h-[90vh]">
                        <h2 id="shop-form-title" className="text-lg font-bold text-gray-900">
                            {editTarget ? `Rediger: ${editTarget.title}` : 'Ny vare'}
                        </h2>

                        {formError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{formError}</p>}

                        <div>
                            <label htmlFor="shop-title" className="block text-sm font-medium text-gray-700 mb-1">Tittel *</label>
                            <input id="shop-title" type="text" value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                        </div>

                        <div>
                            <label htmlFor="shop-desc" className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse</label>
                            <textarea id="shop-desc" rows={2} value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="shop-coins" className="block text-sm font-medium text-gray-700 mb-1">Mynter *</label>
                                <input id="shop-coins" type="number" min="0" value={form.coins}
                                    onChange={(e) => setForm((f) => ({ ...f, coins: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                            </div>
                            <div>
                                <label htmlFor="shop-category" className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
                                <select id="shop-category" value={form.category}
                                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as 'coins' | 'premium' | 'feature' }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                    <option value="coins">Mynter</option>
                                    <option value="premium">Premium</option>
                                    <option value="feature">Funksjon</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => { setCreateOpen(false); setEditTarget(null); }}
                                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                                Avbryt
                            </button>
                            <button onClick={handleSave} disabled={saveMutation.isPending}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors disabled:opacity-60">
                                {saveMutation.isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                <Save size={14} />
                                {editTarget ? 'Oppdater' : 'Opprett'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AdminConfirmDialog
                title="Slett vare?"
                description={`"${deleteTarget?.title}" vil bli permanent slettet.`}
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
