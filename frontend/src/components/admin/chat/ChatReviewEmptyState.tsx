import { Lock, ShieldCheck } from 'lucide-react';

export function ChatReviewEmptyState() {
    return (
        <div
            className="flex flex-col items-center justify-center py-20 px-6 text-center"
            role="status"
            aria-live="polite"
        >
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-5">
                <Lock size={28} className="text-muted-foreground" aria-hidden="true" />
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-2">
                Ingen chat lastet
            </h3>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
                Skriv inn et Chat ID for å gjennomgå en samtale på en sikker måte.
                Chatter vises ikke automatisk av hensyn til personvern og sikkerhet.
            </p>

            <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-100 rounded-md text-xs text-green-700">
                <ShieldCheck size={14} className="shrink-0" aria-hidden="true" />
                <span>Alle chattilganger krever en tilgangsgrunn og logges automatisk.</span>
            </div>
        </div>
    );
}
