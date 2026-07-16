import React, { useState, useEffect, useCallback } from 'react';
import { Edit, ShieldCheck, Settings, Info, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    getPlans,
    updatePlan,
    getConfigs,
    updateConfig,
    initializeConfigs,
} from '../../features/plans/api';
import {
    AdminDataTable,
    AdminPageHeader,
    AdminStatusBadge,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

interface PlanEntitlements {
    freeContact: number;
    radius: number;
    visibilityLevel: number;
    locationPrecision: string;
    hasBadge: boolean;
    hasAnalytics: boolean;
}

interface Plan {
    _id: string;
    name: string;
    price: number;
    type: 'private' | 'business';
    isActive: boolean;
    featuresText: string[];
    entitlements: PlanEntitlements;
}

interface GlobalConfig {
    _id: string;
    key: string;
    value: boolean;
    description?: string;
}

interface PlanForm {
    name: string;
    price: string;
    type: 'private' | 'business';
    isActive: boolean;
    freeContact: string;
    radius: string;
    visibilityLevel: string;
    locationPrecision: string;
    hasBadge: boolean;
    hasAnalytics: boolean;
    featuresText: string[];
}

function ConfigToggle({ config, onToggle }: { config: GlobalConfig; onToggle: (key: string, value: boolean) => void }) {
    return (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800">{config.key.replace(/_/g, ' ')}</p>
                {config.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{config.description}</p>
                )}
            </div>
            <button
                onClick={() => onToggle(config.key, !config.value)}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-3 ${config.value ? 'bg-[#2d4a3e]' : 'bg-gray-300'}`}
                aria-label={`${config.key.replace(/_/g, ' ')}: ${config.value ? 'På' : 'Av'}`}
                role="switch"
                aria-checked={config.value}
            >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${config.value ? 'translate-x-5' : ''}`} />
            </button>
        </div>
    );
}

export default function PlansAdminPage() {
    const qc = useQueryClient();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [configs, setConfigs] = useState<GlobalConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [editTarget, setEditTarget] = useState<Plan | null>(null);
    const [showEdit, setShowEdit] = useState(false);
    const [form, setForm] = useState<PlanForm>({
        name: '', price: '', type: 'private', isActive: true,
        freeContact: '', radius: '', visibilityLevel: '', locationPrecision: 'approximate',
        hasBadge: false, hasAnalytics: false, featuresText: [],
    });
    const [newFeature, setNewFeature] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [plansData, configsData] = await Promise.all([getPlans(), getConfigs()]);
            setPlans(Array.isArray(plansData) ? plansData : plansData?.plans ?? []);
            const configArr = Array.isArray(configsData) ? configsData : configsData?.configs ?? [];
            if (configArr.length === 0) {
                await initializeConfigs();
                const newConfigs = await getConfigs();
                setConfigs(Array.isArray(newConfigs) ? newConfigs : newConfigs?.configs ?? []);
            } else {
                setConfigs(configArr);
            }
        } catch {
            toast.error('Kunne ikke hente data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openEdit = (plan: Plan) => {
        setEditTarget(plan);
        setForm({
            name: plan.name,
            price: String(plan.price),
            type: plan.type,
            isActive: plan.isActive,
            freeContact: String(plan.entitlements?.freeContact ?? 0),
            radius: String(plan.entitlements?.radius ?? 0),
            visibilityLevel: String(plan.entitlements?.visibilityLevel ?? 0),
            locationPrecision: plan.entitlements?.locationPrecision ?? 'approximate',
            hasBadge: plan.entitlements?.hasBadge ?? false,
            hasAnalytics: plan.entitlements?.hasAnalytics ?? false,
            featuresText: plan.featuresText ?? [],
        });
        setShowEdit(true);
    };

    const handleSavePlan = async () => {
        if (!editTarget || !form.name.trim()) { toast.error('Navn er påkrevd.'); return; }
        try {
            const updatedPlan = {
                name: form.name.trim(),
                price: parseFloat(form.price) || 0,
                type: form.type,
                isActive: form.isActive,
                featuresText: form.featuresText.filter((f) => f.trim()),
                entitlements: {
                    ...editTarget.entitlements,
                    freeContact: parseInt(form.freeContact, 10) || 0,
                    radius: parseInt(form.radius, 10) || 0,
                    visibilityLevel: parseInt(form.visibilityLevel, 10) || 0,
                    locationPrecision: form.locationPrecision,
                    hasBadge: form.hasBadge,
                    hasAnalytics: form.hasAnalytics,
                },
            };
            await updatePlan(editTarget._id, updatedPlan);
            qc.invalidateQueries({ queryKey: ['plans'] });
            toast.success('Plan oppdatert.');
            setShowEdit(false);
            fetchData();
        } catch {
            toast.error('Kunne ikke oppdatere plan.');
        }
    };

    const handleToggleConfig = async (key: string, value: boolean) => {
        try {
            await updateConfig(key, value);
            toast.success('Innstilling oppdatert.');
            fetchData();
        } catch {
            toast.error('Kunne ikke oppdatere innstilling.');
        }
    };

    const addFeature = () => {
        if (newFeature.trim()) {
            setForm((f) => ({ ...f, featuresText: [...f.featuresText, newFeature.trim()] }));
            setNewFeature('');
        }
    };

    const removeFeature = (idx: number) => {
        setForm((f) => ({ ...f, featuresText: f.featuresText.filter((_, i) => i !== idx) }));
    };

    const columns: ColumnDef<Plan>[] = [
        {
            key: 'name',
            header: 'Plan',
            render: (p) => (
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-xl">
                        <ShieldCheck size={18} className="text-gray-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        <AdminStatusBadge status={p.type} />
                    </div>
                </div>
            ),
        },
        {
            key: 'price',
            header: 'Pris',
            render: (p) => <span className="font-semibold text-gray-800">{p.price} NOK</span>,
        },
        {
            key: 'contacts',
            header: 'Kontakter/mnd',
            render: (p) => <span className="text-sm text-gray-600">{p.entitlements?.freeContact ?? 0}</span>,
        },
        {
            key: 'visibility',
            header: 'Synlighet',
            render: (p) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                    Nivå {p.entitlements?.visibilityLevel ?? 0}
                </span>
            ),
        },
        {
            key: 'badge',
            header: 'Merke',
            render: (p) => (
                <span className={`text-xs font-medium ${p.entitlements?.hasBadge ? 'text-green-600' : 'text-gray-400'}`}>
                    {p.entitlements?.hasBadge ? 'Ja' : 'Nei'}
                </span>
            ),
        },
        {
            key: 'analytics',
            header: 'Analyse',
            render: (p) => (
                <span className={`text-xs font-medium ${p.entitlements?.hasAnalytics ? 'text-green-600' : 'text-gray-400'}`}>
                    {p.entitlements?.hasAnalytics ? 'Ja' : 'Nei'}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (p) => <AdminStatusBadge status={p.isActive ? 'active' : 'inactive'} />,
        },
        {
            key: 'actions',
            header: 'Handlinger',
            className: 'whitespace-nowrap',
            render: (p) => (
                <button onClick={() => openEdit(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    <Edit size={13} /> Rediger
                </button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Abonnementer"
                description="Administrer prisplaner og globale funksjonsbrytere"
            />

            {/* Global Feature Toggles */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Settings size={16} /> Globale funksjonsbrytere
                </h3>
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : configs.length === 0 ? (
                    <p className="text-sm text-gray-400">Ingen konfigurasjoner funnet.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {configs.map((config) => (
                            <ConfigToggle key={config.key} config={config} onToggle={handleToggleConfig} />
                        ))}
                    </div>
                )}
            </div>

            {/* Plans table */}
            <AdminDataTable
                columns={columns}
                data={plans}
                keyExtractor={(p) => p._id}
                loading={loading}
                emptyTitle="Ingen planer"
                emptyDescription="Det finnes ingen abonnementsplaner ennå."
            />

            {/* Edit plan modal */}
            {showEdit && editTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-plan-title">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 overflow-y-auto max-h-[90vh]">
                        <h2 id="edit-plan-title" className="text-lg font-bold text-gray-900">Rediger: {editTarget.name}</h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="ep-name" className="block text-sm font-medium text-gray-700 mb-1">Navn *</label>
                                <input id="ep-name" type="text" value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                            </div>
                            <div>
                                <label htmlFor="ep-price" className="block text-sm font-medium text-gray-700 mb-1">Pris (NOK) *</label>
                                <input id="ep-price" type="number" min="0" value={form.price}
                                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                            </div>
                            <div>
                                <label htmlFor="ep-type" className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                                <select id="ep-type" value={form.type}
                                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'private' | 'business' }))}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                    <option value="private">Privat</option>
                                    <option value="business">Bedrift</option>
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1 pt-5">
                                    <input type="checkbox" checked={form.isActive}
                                        onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                                        className="w-4 h-4 rounded border-gray-300 text-[#2d4a3e] focus:ring-[#2d4a3e]" />
                                    Aktiv
                                </label>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Rettigheter og funksjoner</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="ep-contacts" className="block text-sm font-medium text-gray-700 mb-1">Gratis kontakter/mnd</label>
                                    <input id="ep-contacts" type="number" min="0" value={form.freeContact}
                                        onChange={(e) => setForm((f) => ({ ...f, freeContact: e.target.value }))}
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                                </div>
                                <div>
                                    <label htmlFor="ep-radius" className="block text-sm font-medium text-gray-700 mb-1">Søkeradius (km)</label>
                                    <input id="ep-radius" type="number" min="0" value={form.radius}
                                        onChange={(e) => setForm((f) => ({ ...f, radius: e.target.value }))}
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                                </div>
                                <div>
                                    <label htmlFor="ep-visibility" className="block text-sm font-medium text-gray-700 mb-1">Synlighet (0-5)</label>
                                    <input id="ep-visibility" type="number" min="0" max="5" value={form.visibilityLevel}
                                        onChange={(e) => setForm((f) => ({ ...f, visibilityLevel: e.target.value }))}
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                                </div>
                                <div>
                                    <label htmlFor="ep-location" className="block text-sm font-medium text-gray-700 mb-1">Plasseringspresisjon</label>
                                    <select id="ep-location" value={form.locationPrecision}
                                        onChange={(e) => setForm((f) => ({ ...f, locationPrecision: e.target.value }))}
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                        <option value="approximate">Omtrentlig</option>
                                        <option value="exact">Nøyaktig</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 mt-3">
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input type="checkbox" checked={form.hasBadge}
                                        onChange={(e) => setForm((f) => ({ ...f, hasBadge: e.target.checked }))}
                                        className="w-4 h-4 rounded border-gray-300 text-[#2d4a3e] focus:ring-[#2d4a3e]" />
                                    Verifisert merke
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input type="checkbox" checked={form.hasAnalytics}
                                        onChange={(e) => setForm((f) => ({ ...f, hasAnalytics: e.target.checked }))}
                                        className="w-4 h-4 rounded border-gray-300 text-[#2d4a3e] focus:ring-[#2d4a3e]" />
                                    Analyse
                                </label>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                <Info size={14} /> Funksjoner (vises for brukere)
                            </h4>
                            <div className="space-y-2 mb-2">
                                {form.featuresText.map((feat, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input type="text" value={feat}
                                            onChange={(e) => {
                                                const updated = [...form.featuresText];
                                                updated[idx] = e.target.value;
                                                setForm((f) => ({ ...f, featuresText: updated }));
                                            }}
                                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                                        <button onClick={() => removeFeature(idx)}
                                            className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="text" value={newFeature}
                                    onChange={(e) => setNewFeature(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                                    placeholder="Legg til funksjon…"
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                                <button onClick={addFeature}
                                    className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#2d4a3e] bg-green-50 hover:bg-green-100 rounded-xl transition-colors">
                                    <Plus size={14} /> Legg til
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                            <button onClick={() => setShowEdit(false)}
                                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                                Avbryt
                            </button>
                            <button onClick={handleSavePlan}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors">
                                <Settings size={14} /> Lagre endringer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
