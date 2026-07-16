import React, { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';

const ACCESS_REASONS = [
    'SafePay review',
    'Chat report investigation',
    'Dispute investigation',
    'Fraud investigation',
    'Support request',
    'Policy violation investigation',
    'Other',
] as const;

export type AccessReason = (typeof ACCESS_REASONS)[number];

interface ChatAccessReasonDialogProps {
    open: boolean;
    defaultReason?: string;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
}

export function ChatAccessReasonDialog({
    open,
    defaultReason,
    onConfirm,
    onCancel,
}: ChatAccessReasonDialogProps) {
    const [selected, setSelected] = useState<string>(defaultReason ?? '');
    const [otherText, setOtherText] = useState('');

    useEffect(() => {
        if (open) {
            setSelected(defaultReason ?? '');
            setOtherText('');
        }
    }, [open, defaultReason]);

    if (!open) return null;

    const effectiveReason =
        selected === 'Other' ? otherText.trim() : selected;

    const canConfirm =
        selected.length > 0 &&
        (selected !== 'Other' || otherText.trim().length >= 5);

    const handleConfirm = () => {
        if (!canConfirm) return;
        onConfirm(effectiveReason);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-reason-title"
        >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                            <Shield size={18} className="text-amber-600" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 id="access-reason-title" className="text-base font-bold text-gray-900">
                                Tilgangsgrunn kreves
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                All tilgang til chathistorikk logges for personvern og revisjon.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        aria-label="Avbryt"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Reason selector */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Velg tilgangsgrunn <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-1.5" role="radiogroup" aria-label="Tilgangsgrunn">
                        {ACCESS_REASONS.map((reason) => (
                            <label
                                key={reason}
                                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-[#2d4a3e]/40 hover:bg-gray-50 transition-colors"
                            >
                                <input
                                    type="radio"
                                    name="access-reason"
                                    value={reason}
                                    checked={selected === reason}
                                    onChange={() => setSelected(reason)}
                                    className="accent-[#2d4a3e]"
                                />
                                <span className="text-sm text-gray-700">{reason}</span>
                            </label>
                        ))}
                    </div>

                    {/* Free-text for "Other" */}
                    {selected === 'Other' && (
                        <div className="mt-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Beskriv årsaken <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={2}
                                value={otherText}
                                onChange={(e) => setOtherText(e.target.value)}
                                placeholder="Min. 5 tegn…"
                                maxLength={500}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none"
                            />
                        </div>
                    )}
                </div>

                {/* Privacy notice */}
                <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3">
                    ⚠️ Denne handlingen logges med admin-ID, IP-adresse, brukeragent og tidsstempel.
                    Bruk kun for legitime formål.
                </p>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        className="px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Bekreft og åpne chat
                    </button>
                </div>
            </div>
        </div>
    );
}
