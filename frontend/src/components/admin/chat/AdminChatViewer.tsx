import React, { useState, useRef, useEffect } from 'react';
import { Lock, Loader2, MessageSquare } from 'lucide-react';
import { useAdminChatMessages } from '../../../hooks/admin/chats';
import { AdminMessageBubble } from './AdminMessageBubble';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../Ui/select';
import { Button } from '../../Ui/Button';

const ACCESS_REASONS = [
    'SafePay-gjennomgang',
    'Brukerrapport-undersøkelse',
    'Tvist-undersøkelse',
    'Svindelundersøkelse',
    'Støtteforespørsel',
    'Policybrudd-undersøkelse',
    'Annet',
];

interface AdminChatViewerProps {
    chatId: string;
    highlightMessageId?: string;
    autoOpen?: boolean;
    presetReason?: string;
}

export function AdminChatViewer({ chatId, highlightMessageId, autoOpen, presetReason }: AdminChatViewerProps) {
    const [reason, setReason] = useState(presetReason ?? '');
    const [enabled, setEnabled] = useState(autoOpen ?? false);
    const [showForm, setShowForm] = useState(!autoOpen);
    const highlightRef = useRef<HTMLDivElement>(null);

    const { data, isLoading, isError, error } = useAdminChatMessages(chatId, reason, enabled);

    useEffect(() => {
        if (data && highlightRef.current) {
            setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
        }
    }, [data]);

    if (!showForm && !enabled) {
        return (
            <Button variant="outline" onClick={() => setShowForm(true)}
                className="flex items-center gap-2 w-full rounded-xl text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100">
                <Lock size={14} /> Åpne chat (tilgang krever grunn)
            </Button>
        );
    }

    if (showForm && !enabled) {
        return (
            <div className="space-y-3 border border-amber-200 rounded-xl p-4 bg-amber-50">
                <p className="text-xs font-medium text-amber-700">Velg tilgangsgrunn. All tilgang logges automatisk.</p>
                <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="w-full bg-white border-gray-200 rounded-xl">
                        <SelectValue placeholder="Velg grunn..." />
                    </SelectTrigger>
                    <SelectContent>
                        {ACCESS_REASONS.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowForm(false)}
                        className="flex-1 rounded-xl text-gray-500 border-gray-200">
                        Avbryt
                    </Button>
                    <Button
                        onClick={() => { if (reason) { setEnabled(true); setShowForm(false); } }}
                        disabled={!reason}
                        className="flex-1 rounded-xl bg-[#2d4a3e] hover:bg-[#233b31] text-white disabled:opacity-40">
                        Hent meldinger
                    </Button>
                </div>
            </div>
        );
    }

    if (isLoading) return (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
            <Loader2 size={16} className="animate-spin" /> Laster meldinger…
        </div>
    );

    if (isError) return (
            <div className="text-xs text-red-600 bg-red-50 rounded-xl p-3">
            {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Tilgang nektet.'}
            <Button variant="link" onClick={() => { setEnabled(false); setShowForm(true); setReason(''); }}
                className="ml-2 underline p-0 h-auto text-xs text-red-600">Prøv igjen</Button>
        </div>
    );

    const messages = data?.messages ?? [];

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <MessageSquare size={13} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">Chat ({messages.length} meldinger)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Kun lesing · Logget</span>
                    <Button variant="ghost" onClick={() => { setEnabled(false); setShowForm(false); }}
                        className="text-xs text-gray-400 hover:text-gray-600 p-0 h-auto">Lukk</Button>
                </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto p-4 space-y-3 bg-white">
                {messages.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-6">Ingen meldinger</p>
                    : messages.map((msg) => (
                        <AdminMessageBubble
                            key={msg._id}
                            msg={msg}
                            isHighlighted={!!highlightMessageId && msg._id === highlightMessageId}
                            highlightRef={msg._id === highlightMessageId ? highlightRef : undefined}
                        />
                    ))
                }
            </div>
        </div>
    );
}
