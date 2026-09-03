import React, { useState } from 'react';
import { Plus, Ban, Ticket, Percent, InfinityIcon, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import mainLink from '../../api/mainURLs';
import {
    AdminDataTable,
    AdminStatusBadge,
    AdminConfirmDialog,
    AdminPageHeader,
    AdminStatCard,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Voucher {
    _id: string;
    name: string;
    code: string;
    amount: number;
    type: 'percentage' | 'fixed';
    usageLimit: number;
    targetPlanType: 'all' | 'private' | 'business';
    active: boolean;
    activeDate: string;
    expiresDate: string;
    usedBy: string[];
    source?: 'legacy' | 'stripe';
    stripeMode?: 'test' | 'live' | null;
    duration?: 'once' | 'forever' | 'repeating' | null;
    durationInMonths?: number | null;
    redemptions?: number;
    maxRedemptions?: number;
}

interface VoucherForm {
    name: string;
    code: string;
    amount: string;
    type: 'percentage' | 'fixed';
    usageLimit: string;
    targetPlanType: 'all' | 'private' | 'business';
    active: boolean;
    activeDate: string;
    expiresDate: string;
    duration: 'once' | 'forever' | 'repeating';
    durationInMonths: string;
}

const emptyForm: VoucherForm = {
    name: '', code: '', amount: '', type: 'percentage',
    usageLimit: '0', targetPlanType: 'all', active: true,
    activeDate: '', expiresDate: '', duration: 'once', durationInMonths: '',
};

export default function VoucherPage() {
    const qc = useQueryClient();
    const [page] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Voucher | null>(null);
    const [form, setForm] = useState<VoucherForm>(emptyForm);
    const [formError, setFormError] = useState('');

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['admin-coupons', page],
        queryFn: async () => {
            const resp = await mainLink.get('/api/admin/promotion-codes');
            return { vouchers: resp.data.promotions as Voucher[], mode: resp.data.mode as string };
        },
        staleTime: 30_000,
    });

    const deactivateMutation = useMutation({
        mutationFn: (id: string) => mainLink.post(`/api/admin/promotion-codes/${id}/deactivate`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-coupons'] }); toast.success('Rabattkode deaktivert.'); },
        onError: (err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Kunne ikke deaktivere rabattkoden.'),
    });

    const saveMutation = useMutation({
        mutationFn: async (values: VoucherForm) => {
            const payload = {
                ...values,
                code: values.code.toUpperCase(),
                amount: parseFloat(values.amount),
                usageLimit: parseInt(values.usageLimit, 10) || 0,
            };
            if (editTarget) throw new Error('Stripe-rabattkoder kan ikke redigeres. Deaktiver og opprett en ny kode.');
            await mainLink.post('/api/admin/promotion-codes', payload);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin-coupons'] });
            toast.success('Stripe-rabattkode opprettet.');
            setCreateOpen(false);
            setEditTarget(null);
        },
        onError: (err: { response?: { data?: { error?: string } } }) =>
            toast.error(err?.response?.data?.error || 'Operasjon feilet.'),
    });

    const getStatus = (v: Voucher): 'active' | 'inactive' | 'expired' => {
        if (!v.active) return 'inactive';
        return new Date(v.expiresDate) < new Date() ? 'expired' : 'active';
    };

    const openCreate = () => {
        setForm(emptyForm);
        setEditTarget(null);
        setFormError('');
        setCreateOpen(true);
    };

    const openEdit = (v: Voucher) => {
        setEditTarget(v);
        setForm({
            name: v.name, code: v.code, amount: String(v.amount),
            type: v.type, usageLimit: String(v.usageLimit),
            targetPlanType: v.targetPlanType, active: v.active,
            activeDate: v.activeDate ? new Date(v.activeDate).toISOString().split('T')[0] : '',
            expiresDate: v.expiresDate ? new Date(v.expiresDate).toISOString().split('T')[0] : '',
            duration: v.duration || 'once',
            durationInMonths: v.durationInMonths ? String(v.durationInMonths) : '',
        });
        setFormError('');
        setCreateOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.code.trim() || !form.amount) {
            setFormError('Navn, kode og beløp er påkrevd.');
            return;
        }
        await saveMutation.mutateAsync(form);
        setForm(emptyForm);
    };

    const vouchers = data?.vouchers ?? [];

    const columns: ColumnDef<Voucher>[] = [
        {
            key: 'name',
            header: 'Navn',
            render: (v) => <span className="text-sm font-semibold text-gray-800">{v.name}</span>,
        },
        {
            key: 'code',
            header: 'Kode',
            render: (v) => <span className="font-mono text-xs text-gray-500">{v.code}</span>,
        },
        {
            key: 'usage',
            header: 'Bruk',
            render: (v) => (
                <span className="text-sm font-medium text-gray-700">
                    {(v.redemptions ?? v.usedBy?.length ?? 0)} / {(v.maxRedemptions ?? v.usageLimit) || <InfinityIcon size={14} className="inline text-gray-400" />}
                </span>
            ),
        },
        {
            key: 'discount',
            header: 'Rabatt',
            render: (v) => (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    <Percent size={11} />
                    {v.amount}{v.type === 'percentage' ? '%' : ' NOK'}
                </span>
            ),
        },
        {
            key: 'target',
            header: 'Kilde / modus',
            render: (v) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    {v.source === 'stripe' ? `Stripe · ${v.stripeMode === 'test' ? 'SANDBOX' : 'LIVE'}` : 'Legacy'}
                </span>
            ),
        },
        {
            key: 'duration',
            header: 'Varighet',
            render: (v) => <span className="text-xs text-gray-600">{v.duration === 'repeating' ? `${v.durationInMonths} måneder` : v.duration || '–'}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            render: (v) => <AdminStatusBadge status={getStatus(v)} />,
        },
        {
            key: 'dates',
            header: 'Periode',
            render: (v) => (
                <div className="text-xs text-gray-500">
                    <span>{v.activeDate ? new Date(v.activeDate).toLocaleDateString('nb-NO') : '–'}</span>
                    <span className="mx-1">→</span>
                    <span>{v.expiresDate ? new Date(v.expiresDate).toLocaleDateString('nb-NO') : '–'}</span>
                </div>
            ),
        },
        {
            key: 'actions',
            header: 'Handlinger',
            className: 'whitespace-nowrap',
            render: (v) => (
                <div className="flex items-center gap-1.5">
                            {v.source === 'stripe' && v.active ? <button onClick={() => setDeleteTarget(v)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                                <Ban size={12} /> Deaktiver
                            </button> : null}
                </div>
            ),
        },
    ];

    const isFormOpen = createOpen || !!editTarget;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Kuponger"
                description={`Stripe-rabattkoder for medlemskap · ${data?.mode === 'test' ? 'SANDBOX' : data?.mode === 'live' ? 'LIVE' : 'Stripe-modus ukjent'}`}
                actions={
                    <button onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors">
                        <Plus size={16} /> Ny kupong
                    </button>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { title: 'Totale kuponger', value: vouchers.length, icon: <Ticket size={18} /> },
                    { title: 'Aktive', value: vouchers.filter((v) => getStatus(v) === 'active').length, icon: <Ticket size={18} /> },
                    { title: 'Utløpt', value: vouchers.filter((v) => getStatus(v) === 'expired' || getStatus(v) === 'inactive').length, icon: <Calendar size={18} /> },
                ].map((s) => (
                    <AdminStatCard key={s.title} title={s.title} value={s.value} icon={s.icon} />
                ))}
            </div>

            <AdminDataTable
                columns={columns}
                data={vouchers}
                keyExtractor={(v) => v._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen kuponger"
                emptyDescription="Opprett den første rabattkupongen."
            />

            {/* Create / Edit dialog */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="voucher-form-title">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 overflow-y-auto max-h-[90vh]">
                        <h2 id="voucher-form-title" className="text-lg font-bold text-gray-900">
                            {editTarget ? `Rediger: ${editTarget.name}` : 'Ny kupong'}
                        </h2>

                        {formError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{formError}</p>}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="v-name" className="block text-sm font-medium text-gray-700 mb-1">Navn *</label>
                                <input id="v-name" type="text" value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                            </div>
                            <div>
                                <label htmlFor="v-code" className="block text-sm font-medium text-gray-700 mb-1">Kode *</label>
                                <input id="v-code" type="text" value={form.code}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 uppercase tracking-wider font-bold" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="v-type" className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                                <select id="v-type" value={form.type}
                                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'percentage' | 'fixed' }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                    <option value="percentage">Prosent (%)</option>
                                    <option value="fixed">Fast beløp (NOK)</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="v-amount" className="block text-sm font-medium text-gray-700 mb-1">Beløp *</label>
                                <input id="v-amount" type="number" min="0" step="0.01" value={form.amount}
                                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Målgruppe</label>
                                <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">Alle medlemsplaner</p>
                            </div>
                            <div>
                                <label htmlFor="v-usage" className="block text-sm font-medium text-gray-700 mb-1">Bruksgrense (0 = ubegrenset)</label>
                                <input id="v-usage" type="number" min="0" value={form.usageLimit}
                                    onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="v-duration" className="block text-sm font-medium text-gray-700 mb-1">Varighet *</label>
                                <select id="v-duration" value={form.duration}
                                    onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value as VoucherForm['duration'] }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                    <option value="once">Én gang</option>
                                    <option value="forever">For alltid</option>
                                    <option value="repeating">Gjentakende</option>
                                </select>
                            </div>
                            {form.duration === 'repeating' ? <div>
                                <label htmlFor="v-months" className="block text-sm font-medium text-gray-700 mb-1">Antall måneder *</label>
                                <input id="v-months" type="number" min="1" step="1" value={form.durationInMonths}
                                    onChange={(e) => setForm((f) => ({ ...f, durationInMonths: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                            </div> : <div />}
                        </div>

                        <div>
                            <div>
                                <label htmlFor="v-expires" className="block text-sm font-medium text-gray-700 mb-1">Utløper *</label>
                                <input id="v-expires" type="date" value={form.expiresDate}
                                    onChange={(e) => setForm((f) => ({ ...f, expiresDate: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={form.active}
                                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                                className="w-4 h-4 rounded border-gray-300 text-[#2d4a3e] focus:ring-[#2d4a3e]" />
                            Aktiv
                        </label>

                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => { setCreateOpen(false); setEditTarget(null); }}
                                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                                Avbryt
                            </button>
                            <button onClick={handleSave} disabled={saveMutation.isPending}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors disabled:opacity-60">
                                {saveMutation.isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {editTarget ? 'Oppdater' : 'Opprett'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AdminConfirmDialog
                title="Deaktiver rabattkode?"
                description={`"${deleteTarget?.name}" kan ikke brukes i nye Stripe Checkout-sesjoner.`}
                confirmText="Deaktiver"
                cancelText="Avbryt"
                variant="destructive"
                isOpen={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    if (deleteTarget.source === 'stripe') await deactivateMutation.mutateAsync(deleteTarget._id);
                    setDeleteTarget(null);
                }}
            />
        </div>
    );
}
