import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { AdminStatusBadge } from '../AdminStatusBadge';
import type { AdminChatParticipants } from '../../../api/admin/chats';

interface ChatParticipantsCardProps {
    participants: AdminChatParticipants;
}

function ParticipantRow({
    participant,
    role,
}: {
    participant: NonNullable<AdminChatParticipants['customer']>;
    role: string;
}) {
    const avatarSrc =
        participant.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(participant.name ?? 'U')}&background=2d4a3e&color=fff&size=64`;

    return (
        <div className="flex items-start gap-3">
            <img
                src={avatarSrc}
                alt={participant.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{participant.name}</span>
                    {participant.verified && (
                        <ShieldCheck size={13} className="text-green-500" aria-label="Verifisert" />
                    )}
                </div>
                <p className="text-xs text-gray-400">{participant.email}</p>
                <p className="text-xs text-gray-400 capitalize">{role}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                    {participant.accountStatus && (
                        <AdminStatusBadge status={participant.accountStatus} />
                    )}
                </div>
                {participant.averageRating !== undefined && (
                    <p className="text-xs text-gray-500">
                        ⭐ {participant.averageRating.toFixed(1)} · {participant.completedJobs ?? 0} jobber
                    </p>
                )}
                {participant.profileLink && (
                    <Link
                        to={participant.profileLink}
                        className="inline-flex items-center gap-1 text-xs text-[#2d4a3e] hover:underline mt-1"
                    >
                        Se profil <ExternalLink size={10} aria-hidden="true" />
                    </Link>
                )}
            </div>
        </div>
    );
}

export function ChatParticipantsCard({ participants }: ChatParticipantsCardProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 border-b border-gray-50 pb-2">
                Deltakere
            </h3>
            <div className="space-y-5">
                <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Kunde
                    </p>
                    {participants.customer ? (
                        <ParticipantRow participant={participants.customer} role="Kunde" />
                    ) : (
                        <p className="text-sm text-gray-400">Ikke tilgjengelig</p>
                    )}
                </div>
                <div className="border-t border-gray-50 pt-4">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Tilbyder
                    </p>
                    {participants.provider ? (
                        <ParticipantRow participant={participants.provider} role="Tilbyder" />
                    ) : (
                        <p className="text-sm text-gray-400">Ikke tilgjengelig</p>
                    )}
                </div>
            </div>
        </div>
    );
}
