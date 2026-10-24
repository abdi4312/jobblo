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
                    <span className="text-sm font-semibold text-foreground">{participant.name}</span>
                    {participant.verified && (
                        <ShieldCheck size={13} className="text-green-500" aria-label="Verifisert" />
                    )}
                </div>
                <p className="text-xs text-muted-foreground">{participant.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                    {participant.accountStatus && (
                        <AdminStatusBadge status={participant.accountStatus} />
                    )}
                </div>
                {participant.averageRating !== undefined && (
                    <p className="text-xs text-muted-foreground">
                        ⭐ {participant.averageRating.toFixed(1)} · {participant.completedJobs ?? 0} jobber
                    </p>
                )}
                {participant.profileLink && (
                    <Link
                        to={participant.profileLink}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
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
        <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 border-b border-border pb-2">
                Deltakere
            </h3>
            <div className="space-y-5">
                <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Kunde
                    </p>
                    {participants.customer ? (
                        <ParticipantRow participant={participants.customer} role="Kunde" />
                    ) : (
                        <p className="text-sm text-muted-foreground">Ikke tilgjengelig</p>
                    )}
                </div>
                <div className="border-t border-border pt-4">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Tilbyder
                    </p>
                    {participants.provider ? (
                        <ParticipantRow participant={participants.provider} role="Tilbyder" />
                    ) : (
                        <p className="text-sm text-muted-foreground">Ikke tilgjengelig</p>
                    )}
                </div>
            </div>
        </div>
    );
}
