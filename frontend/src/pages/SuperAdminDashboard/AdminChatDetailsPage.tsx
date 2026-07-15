import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Flag, ExternalLink } from 'lucide-react';
import { useAdminChatById } from '../../hooks/admin/chats';
import { AdminChatViewer } from '../../components/admin/chat/AdminChatViewer';
import {
    AdminStatusBadge, AdminLoadingSkeleton, AdminErrorState, AdminPageHeader,
} from '../../components/admin';

function Row({ label, value, badge }: { label: string; value?: React.ReactNode; badge?: string }) {
    return (
        <div className="flex items-start justify-between py-1.5 gap-4">
            <span className="text-xs text-gray-400 shrink-0 w-32">{label}</span>
            <span className="text-sm text-gray-800 text-right flex items-center gap-1 min-w-0">
                {badge ? <AdminStatusBadge status={badge} /> : (value ?? <span className="text-gray-300">–</span>)}
            </span>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 border-b border-gray-50 pb-2">{title}</h3>
            {children}
        </div>
    );
}

function ParticipantCard({ user, role }: {
    user?: { _id: string; name: string; email: string; avatarUrl?: string; accountStatus: string; verified: boolean; role: string };
    role: string;
}) {
    if (!user) return <p className="text-sm text-gray-400">–</p>;
    return (
        <div className="flex items-start gap-3">
            <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2d4a3e&color=fff&size=40`}
                alt={user.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
            <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
                <p className="text-xs text-gray-400 capitalize">{role}</p>
                <div className="flex items-center gap-1.5 mt-1">
                    {user.verified && <span className="text-xs text-green-600">✓ Verifisert</span>}
                    <AdminStatusBadge status={user.accountStatus} />
                </div>
            </div>
        </div>
    );
}

export default function AdminChatDetailsPage() {
    const { chatId } = useParams<{ chatId: string }>();
    const { data, isLoading, isError, refetch } = useAdminChatById(chatId ?? '');

    if (isLoading) return <div className="space-y-4"><AdminLoadingSkeleton rows={4} /><AdminLoadingSkeleton rows={6} /></div>;
    if (isError || !data) return <AdminErrorState onRetry={refetch} title="Chat ikke funnet" />;

    const d = data as {
        chat: {
            _id: string; status: string; agreedPrice?: number; lastMessage?: string;
            reportCount: number; attachmentCount: number; createdAt: string; updatedAt: string;
            messages?: unknown[];
            clientId?: { _id: string; name: string; email: string; avatarUrl?: string; accountStatus: string; verified: boolean; role: string };
            providerId?: { _id: string; name: string; email: string; avatarUrl?: string; accountStatus: string; verified: boolean; role: string };
            serviceId?: { _id: string; title: string; status: string; price: number };
            orderId?: { _id: string; status: string; paymentStatus: string; agreedPrice?: number };
        };
        payment?: { status: string; amount: number } | null;
        dispute?: { _id: string; status: string; priority: string } | null;
    };

    const { chat, payment, dispute } = d;
    const messageCount = chat.messages?.length ?? 0;

    return (
        <div className="space-y-6">
            <Link to="/dashboard/chats" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                <ArrowLeft size={15} /> Tilbake til chatter
            </Link>

            <AdminPageHeader
                title={`Chat ${chat._id.slice(-8).toUpperCase()}`}
                description={chat.serviceId?.title ?? 'Ukjent tjeneste'}
                actions={chat.reportCount > 0 ? (
                    <Link to={`/dashboard/chat-reports?chatId=${chat._id}`}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
                        <Flag size={13} /> {chat.reportCount} rapport(er)
                    </Link>
                ) : undefined}
            />

            {/* Status bar */}
            <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Chat:</span><AdminStatusBadge status={chat.status} /></div>
                {payment && <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Betaling:</span><AdminStatusBadge status={payment.status} /></div>}
                {dispute && <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Tvist:</span><AdminStatusBadge status={dispute.status} /></div>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    {/* Chat info */}
                    <Section title="Chatinformasjon">
                        <Row label="Chat ID" value={<span className="font-mono text-xs">{chat._id}</span>} />
                        <Row label="Status" badge={chat.status} />
                        <Row label="Meldinger" value={String(messageCount)} />
                        <Row label="Vedlegg" value={String(chat.attachmentCount ?? 0)} />
                        <Row label="Rapporter" value={String(chat.reportCount)} />
                        <Row label="Avtalt pris" value={chat.agreedPrice ? `${chat.agreedPrice.toLocaleString('nb-NO')} NOK` : undefined} />
                        <Row label="Opprettet" value={new Date(chat.createdAt).toLocaleString('nb-NO')} />
                        <Row label="Sist oppdatert" value={new Date(chat.updatedAt).toLocaleString('nb-NO')} />
                    </Section>

                    {/* Related */}
                    <Section title="Relatert informasjon">
                        <Row label="Tjeneste" value={chat.serviceId?.title} />
                        {chat.orderId && (
                            <>
                                <Row label="Ordre-ID"
                                    value={<Link to={`/dashboard/safepay/${(chat.orderId as { _id: string })._id}`}
                                        className="font-mono text-xs text-[#2d4a3e] hover:underline flex items-center gap-1">
                                        {(chat.orderId as { _id: string })._id.slice(-8).toUpperCase()} <ExternalLink size={10} />
                                    </Link>} />
                                <Row label="Ordrestatus" badge={(chat.orderId as { status: string }).status} />
                                <Row label="Betalingsstatus" badge={(chat.orderId as { paymentStatus: string }).paymentStatus} />
                            </>
                        )}
                        {payment && <Row label="Betalingsbeløp" value={`${payment.amount?.toLocaleString('nb-NO')} NOK`} />}
                        {dispute && (
                            <Row label="Tvist"
                                value={<Link to={`/dashboard/disputes/${dispute._id}`}
                                    className="text-xs text-red-600 hover:underline flex items-center gap-1">
                                    Se tvist <ExternalLink size={10} />
                                </Link>} />
                        )}
                    </Section>

                    {/* Read-only chat viewer */}
                    <Section title="Chatmeldinger">
                        <AdminChatViewer chatId={chat._id} />
                    </Section>
                </div>

                <div className="space-y-4">
                    <Section title="Kunde"><ParticipantCard user={chat.clientId} role="Kunde" /></Section>
                    <Section title="Tilbyder"><ParticipantCard user={chat.providerId} role="Tilbyder" /></Section>
                </div>
            </div>
        </div>
    );
}
