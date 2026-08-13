/**
 * ContractViewModal
 *
 * Full contract viewer — shows all parties, agreed price, checklist,
 * service details, and order timeline. Works for both customer and provider.
 *
 * Usage:
 *   <ContractViewModal orderId={order._id} trigger={<button>Se kontrakt</button>} />
 *
 * Fetches data lazily when the modal opens, so it's cheap to mount anywhere.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    X, ShieldCheck, CheckCircle2, Circle, Clock, FileText, User, Calendar, Tag,
} from 'lucide-react';
import mainLink from '../../api/mainURLs';

interface ContractViewModalProps {
    orderId: string;
    trigger: React.ReactNode;
}

function statusLabel(status: string): { label: string; color: string } {
    const map: Record<string, { label: string; color: string }> = {
        awaiting_payment: { label: 'Venter på betaling', color: 'bg-amber-50 text-amber-700' },
        paid: { label: 'Betalt', color: 'bg-blue-50 text-blue-700' },
        in_progress: { label: 'Pågår', color: 'bg-indigo-50 text-indigo-700' },
        ready_for_review: { label: 'Klar for gjennomgang', color: 'bg-purple-50 text-purple-700' },
        completed: { label: 'Fullført', color: 'bg-green-50 text-green-700' },
        cancelled: { label: 'Kansellert', color: 'bg-red-50 text-red-700' },
        disputed: { label: 'Tvist', color: 'bg-orange-50 text-orange-700' },
    };
    return map[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
}

function Avatar({ user }: { user: { name: string; lastName?: string; avatarUrl?: string } }) {
    return (
        <div className="w-10 h-10 rounded-full bg-[#c8d8c8] flex items-center justify-center overflow-hidden shrink-0">
            {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
                <span className="text-sm font-bold text-[#1a3a1a]">{user.name?.[0] || '?'}</span>
            )}
        </div>
    );
}

export function ContractViewModal({ orderId, trigger }: ContractViewModalProps) {
    const [open, setOpen] = useState(false);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['contract-view', orderId],
        queryFn: async () => {
            const res = await mainLink.get(`/api/safepay-checkout/details/${orderId}`);
            return res.data;
        },
        enabled: open && !!orderId,
        staleTime: 1000 * 60,
    });

    const order = data?.order;
    const calculation = data?.calculation;

    const { label: statusText, color: statusColor } = order
        ? statusLabel(order.status)
        : { label: '', color: '' };

    return (
        <>
            <span onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
                {trigger}
            </span>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2.5">
                                <FileText size={18} className="text-[#1a3a1a]" />
                                <h2 className="font-bold text-gray-900">Kontrakt</h2>
                                {order && (
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                                        {statusText}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                            {isLoading && (
                                <div className="text-center py-12 text-gray-400 text-sm">Laster kontrakt…</div>
                            )}
                            {isError && (
                                <div className="text-center py-12 text-red-400 text-sm">
                                    Kunne ikke hente kontrakt.
                                </div>
                            )}

                            {order && (
                                <>
                                    {/* Contract ID */}
                                    <p className="text-[11px] text-gray-400 font-mono">
                                        Kontrakt-ID: {String(order._id).toUpperCase()}
                                    </p>

                                    {/* Parties */}
                                    <section>
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                                            Parter
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3.5">
                                                <Avatar user={order.customerId} />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Oppdragsgiver</p>
                                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                                        {order.customerId.name} {order.customerId.lastName || ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3.5">
                                                <Avatar user={order.providerId} />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Oppdragstaker</p>
                                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                                        {order.providerId.name} {order.providerId.lastName || ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Service */}
                                    <section>
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                                            Oppdrag
                                        </p>
                                        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                                            <div className="flex items-start gap-2">
                                                <Tag size={14} className="text-gray-400 mt-0.5 shrink-0" />
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {order.serviceId?.title || '—'}
                                                </p>
                                            </div>
                                            {order.serviceId?.location?.city && (
                                                <p className="text-xs text-gray-500 ml-5">
                                                    📍 {order.serviceId.location.city}
                                                </p>
                                            )}
                                            {order.createdAt && (
                                                <div className="flex items-center gap-2 ml-5">
                                                    <Calendar size={12} className="text-gray-400" />
                                                    <p className="text-xs text-gray-500">
                                                        Kontrakt opprettet {new Date(order.createdAt).toLocaleDateString('nb-NO', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    {/* Financial */}
                                    {calculation && (
                                        <section>
                                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                                                Betalingsdetaljer
                                            </p>
                                            <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-50">
                                                    <span className="text-sm text-gray-600">Avtalt beløp</span>
                                                    <span className="text-sm font-semibold text-gray-900">{calculation.basePrice?.toLocaleString('nb-NO')} kr</span>
                                                </div>
                                                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-50">
                                                    <span className="text-sm text-gray-500">SafePay-gebyr (3%)</span>
                                                    <span className="text-sm text-gray-500">{calculation.fee?.toLocaleString('nb-NO')} kr</span>
                                                </div>
                                                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-50">
                                                    <span className="text-sm text-gray-600">Oppdragsgiver betaler</span>
                                                    <span className="text-sm font-bold text-gray-900">{calculation.total?.toLocaleString('nb-NO')} kr</span>
                                                </div>
                                                <div className="flex justify-between items-center px-4 py-3 bg-green-50">
                                                    <span className="text-sm text-green-800 font-medium">Oppdragstaker mottar</span>
                                                    <span className="text-sm font-bold text-green-800">{calculation.providerNet?.toLocaleString('nb-NO')} kr</span>
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    {/* Checklist */}
                                    {order.checklist && order.checklist.length > 0 && (
                                        <section>
                                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                                                Sjekkliste ({order.checklist.filter((i: any) => i.checked).length}/{order.checklist.length} fullført)
                                            </p>
                                            <ul className="space-y-2">
                                                {order.checklist.map((item: any) => (
                                                    <li key={item.id} className="flex items-center gap-2.5 text-sm">
                                                        {item.checked
                                                            ? <CheckCircle2 size={16} className="text-[#1a3a1a] shrink-0" />
                                                            : <Circle size={16} className="text-gray-300 shrink-0" />}
                                                        <span className={item.checked ? 'text-gray-600 line-through' : 'text-gray-800'}>
                                                            {item.text}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )}

                                    {/* SafePay protection notice */}
                                    <div className="flex items-start gap-3 bg-[#f0faf5] border border-[#c6e8d6] rounded-xl p-4">
                                        <ShieldCheck size={18} className="text-[#1a3a1a] shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-[#1a3a1a] mb-0.5">SafePay-beskyttelse aktiv</p>
                                            <p className="text-xs text-[#2d6a4f]">
                                                Beløpet holdes sikkert av Jobblo SafePay inntil oppdragsgiver godkjenner arbeidet.
                                                Pengene frigis kun ved godkjenning.
                                            </p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition-colors"
                            >
                                Lukk
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
