import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
    Search, X, Loader2, Shield, AlertTriangle, MessageSquare,
    ExternalLink, Clock, Hash, User, Briefcase, CreditCard, Flag, FileText,
} from 'lucide-react';
import * as chatsApi from '../../api/admin/chats';
import { AdminChatViewer } from '../../components/admin/chat/AdminChatViewer';
import { AdminStatusBadge, AdminLoadingSkeleton, AdminPageHeader } from '../../components/admin';
import { Button } from '../../components/Ui/Button';
import { Input } from '../../components/Ui/Input';
import {
    Card, CardHeader, CardTitle, CardContent,
} from '../../components/Ui/card';
import { toast } from 'sonner';

type ChatDetailData = Awaited<ReturnType<typeof chatsApi.fetchAdminChatById>>;

interface Participant {
    _id: string; name: string; email: string; avatarUrl?: string;
    accountStatus: string; verified: boolean; role: string;
}

interface ChatInfo {
    _id: string; status: string; agreedPrice?: number;
    reportCount: number; attachmentCount: number;
    createdAt: string; updatedAt: string; lastMessage?: string;
    clientId?: Participant; providerId?: Participant;
    serviceId?: { _id: string; title: string; status: string; price: number };
    orderId?: { _id: string; status: string; paymentStatus: string; agreedPrice?: number };
    messages?: unknown[];
}

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

function ParticipantCard({ user, label }: { user?: Participant; label: string }) {
    if (!user) return <p className="text-sm text-gray-400 py-2">–</p>;
    return (
        <div className="flex items-start gap-3">
            <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2d4a3e&color=fff&size=40`}
                alt={user.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
            <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
                <p className="text-xs text-gray-400 capitalize">{label}</p>
                <div className="flex items-center gap-1.5 mt-1">
                    {user.verified && <span className="text-xs text-green-600">✓ Verifisert</span>}
                    <AdminStatusBadge status={user.accountStatus} />
                </div>
            </div>
        </div>
    );
}

export default function ChatReviewPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const qChatId = searchParams.get('chatId') || '';
    const qSource = searchParams.get('source') || '';
    const qReportId = searchParams.get('reportId') || '';

    const [inputValue, setInputValue] = useState(qChatId);
    const [searchedChatId, setSearchedChatId] = useState<string | null>(null);
    const [chatData, setChatData] = useState<ChatDetailData | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        if (qChatId) setInputValue(qChatId);
    }, [qChatId]);

    const handleSearch = useCallback(async () => {
        const val = inputValue.trim();
        if (!val) { setSearchError('Skriv inn et Chat ID.'); return; }

        if (!/^[0-9a-fA-F]{24}$/.test(val)) {
            setSearchError('Ugyldig Chat ID. Vennligst skriv inn et gyldig MongoDB ObjectId.');
            return;
        }

        setIsSearching(true);
        setSearchError(null);
        setChatData(null);
        setSearchedChatId(null);
        setShowResults(false);

        try {
            const result = await chatsApi.fetchAdminChatById(val);
            setChatData(result);
            setSearchedChatId(val);
            setShowResults(true);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Chat ikke funnet.';
            setSearchError(msg);
            setShowResults(false);
            toast.error(msg);
        } finally {
            setIsSearching(false);
        }
    }, [inputValue]);

    const handleClear = useCallback(() => {
        setInputValue('');
        setSearchedChatId(null);
        setChatData(null);
        setSearchError(null);
        setShowResults(false);
        setSearchParams({});
    }, [setSearchParams]);

    const handleSearchAnother = useCallback(() => {
        setSearchedChatId(null);
        setChatData(null);
        setSearchError(null);
        setShowResults(false);
    }, []);

    const getPresetReason = (): string | undefined => {
        if (qSource === 'safepay') return 'SafePay-gjennomgang';
        if (qSource === 'report' || qReportId) return 'Brukerrapport-undersøkelse';
        return undefined;
    };

    const chatInfo = chatData as { chat?: ChatInfo; payment?: { status: string; amount: number } | null; dispute?: { _id: string; status: string; priority: string } | null } | null;
    const chat = chatInfo?.chat;
    const messageCount = (chat as ChatInfo | undefined)?.messages?.length ?? 0;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Chat-gjennomgang"
                description="Sikker gjennomgang av en spesifikk chat. Kun synlig etter verifisert tilgang."
            />

            {/* Search form */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Search size={16} className="text-gray-400" />
                        Søk etter chat
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                        <Input
                            value={inputValue}
                            onChange={(e) => { setInputValue(e.target.value); setSearchError(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                            placeholder="Lim inn et MongoDB Chat ID..."
                            className="font-mono text-sm flex-1"
                            disabled={isSearching}
                        />
                        <Button onClick={handleSearch} disabled={!inputValue.trim() || isSearching}
                            className="rounded-xl bg-[#2d4a3e] hover:bg-[#233b31] text-white whitespace-nowrap">
                            {isSearching ? <Loader2 size={16} className="animate-spin mr-1" /> : <Search size={16} className="mr-1" />}
                            Søk
                        </Button>
                    </div>

                    {qSource === 'safepay' && qChatId && (
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            <ExternalLink size={11} /> Åpnet fra SafePay. Klikk <strong>Søk</strong> for å starte gjennomgang.
                        </p>
                    )}
                    {qSource === 'report' && qChatId && (
                        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                            <Flag size={11} /> Åpnet fra en rapport. Klikk <strong>Søk</strong> for å starte gjennomgang.
                        </p>
                    )}

                    {searchError && (
                        <p className="text-xs text-red-600 bg-red-50 rounded-xl p-3 mt-3 flex items-start gap-2">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {searchError}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Empty state - before any search */}
            {!showResults && !isSearching && !searchError && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Shield size={40} className="mx-auto text-gray-200 mb-4" />
                        <h3 className="text-base font-semibold text-gray-800 mb-2">Ingen chat lastet</h3>
                        <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                            Skriv inn et Chat ID for å sikre gjennomgang av en samtale.
                            Chatter vises ikke automatisk av hensyn til personvern og sikkerhet.
                        </p>
                        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-300">
                            <span className="flex items-center gap-1"><LockIcon /> Kun spesifikke ID</span>
                            <span className="flex items-center gap-1"><Clock size={12} /> Logget tilgang</span>
                            <span className="flex items-center gap-1"><Shield size={12} /> Skrivebeskyttet</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Loading state */}
            {isSearching && (
                <Card>
                    <CardContent className="py-8">
                        <AdminLoadingSkeleton rows={4} />
                    </CardContent>
                </Card>
            )}

            {/* Search results - chat found */}
            {showResults && chat && (
                <>
                    {/* Action bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-mono">
                                {chat._id.slice(0, 8)}...{chat._id.slice(-4)}
                            </span>
                            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(chat._id); toast.success('Chat ID kopiert.'); }}
                                className="text-xs rounded-xl border-gray-200 gap-1">
                                <Hash size={12} /> Kopier
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleSearchAnother}
                                className="text-xs rounded-xl border-gray-200 gap-1">
                                <Search size={12} /> Søk en annen
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleClear}
                                className="text-xs rounded-xl border-gray-200 gap-1 text-red-500 hover:text-red-600">
                                <X size={12} /> Fjern chat
                            </Button>
                        </div>
                    </div>

                    {/* Status bar */}
                    <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-gray-100 p-4">
                        <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Chat:</span><AdminStatusBadge status={chat.status} /></div>
                        {chatInfo?.payment && <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Betaling:</span><AdminStatusBadge status={chatInfo.payment.status} /></div>}
                        {chatInfo?.dispute && <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Tvist:</span><AdminStatusBadge status={chatInfo.dispute.status} /></div>}
                    </div>

                    {/* Main grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 space-y-4">
                            {/* Chat info */}
                            <Card>
                                <CardHeader><CardTitle className="text-sm">Chatinformasjon</CardTitle></CardHeader>
                                <CardContent>
                                    <Row label="Chat ID" value={<span className="font-mono text-xs">{chat._id}</span>} />
                                    <Row label="Status" badge={chat.status} />
                                    <Row label="Meldinger" value={String(messageCount)} />
                                    <Row label="Vedlegg" value={String(chat.attachmentCount ?? 0)} />
                                    <Row label="Rapporter" value={String(chat.reportCount ?? 0)} />
                                    <Row label="Avtalt pris" value={chat.agreedPrice ? `${chat.agreedPrice.toLocaleString('nb-NO')} NOK` : undefined} />
                                    <Row label="Opprettet" value={new Date(chat.createdAt).toLocaleString('nb-NO')} />
                                    <Row label="Sist oppdatert" value={new Date(chat.updatedAt).toLocaleString('nb-NO')} />
                                </CardContent>
                            </Card>

                            {/* Related info */}
                            <Card>
                                <CardHeader><CardTitle className="text-sm">Relatert informasjon</CardTitle></CardHeader>
                                <CardContent>
                                    <Row label="Tjeneste" value={
                                        chat.serviceId ? (
                                            <Link to={`/dashboard/services/${chat.serviceId._id}`}
                                                className="text-xs text-[#2d4a3e] hover:underline flex items-center gap-1">
                                                <Briefcase size={11} /> {chat.serviceId.title}
                                            </Link>
                                        ) : undefined
                                    } />
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
                                    {chatInfo?.payment && <Row label="Beløp" value={`${chatInfo.payment.amount?.toLocaleString('nb-NO')} NOK`} />}
                                    {chatInfo?.dispute && (
                                        <Row label="Tvist"
                                            value={<Link to={`/dashboard/disputes/${chatInfo.dispute._id}`}
                                                className="text-xs text-red-600 hover:underline flex items-center gap-1">
                                                Se tvist <ExternalLink size={10} />
                                            </Link>} />
                                    )}
                                    {qReportId && (
                                        <Row label="Rapport"
                                            value={<Link to={`/dashboard/chat-reports/${qReportId}`}
                                                className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                                                Åpne rapport <ExternalLink size={10} />
                                            </Link>} />
                                    )}
                                </CardContent>
                            </Card>

                            {/* Chat messages with access gate */}
                            <Card>
                                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare size={14} /> Meldinger</CardTitle></CardHeader>
                                <CardContent>
                                    <AdminChatViewer
                                        chatId={chat._id}
                                        highlightMessageId={qReportId ? undefined : undefined}
                                        autoOpen={false}
                                        presetReason={getPresetReason()}
                                    />
                                </CardContent>
                            </Card>
                        </div>

                        {/* Participants sidebar */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User size={14} /> Kunde</CardTitle></CardHeader>
                                <CardContent>
                                    <ParticipantCard user={chat.clientId as Participant | undefined} label="Kunde" />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User size={14} /> Tilbyder</CardTitle></CardHeader>
                                <CardContent>
                                    <ParticipantCard user={chat.providerId as Participant | undefined} label="Tilbyder" />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </>
            )}

            {/* Not found */}
            {showResults && !chat && !isSearching && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertTriangle size={40} className="mx-auto text-amber-300 mb-4" />
                        <h3 className="text-base font-semibold text-gray-800 mb-2">Chat ikke funnet</h3>
                        <p className="text-sm text-gray-400 mb-4">Ingen chat med dette ID-et ble funnet.</p>
                        <Button variant="outline" onClick={handleSearchAnother}
                            className="rounded-xl border-gray-200 gap-2">
                            <Search size={14} /> Prøv et annet ID
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function LockIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}
