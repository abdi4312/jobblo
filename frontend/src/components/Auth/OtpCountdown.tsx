import { useState, useEffect } from 'react';

interface OtpCountdownProps {
    seconds: number;
    onResend: () => void;
    isSending: boolean;
}

export default function OtpCountdown({ seconds, onResend, isSending }: OtpCountdownProps) {
    const [remaining, setRemaining] = useState(seconds);

    useEffect(() => {
        setRemaining(seconds);
    }, [seconds]);

    useEffect(() => {
        if (remaining <= 0) return;
        const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
        return () => clearTimeout(t);
    }, [remaining]);

    if (remaining > 0) {
        return (
            <p className="text-sm text-[#6B7280] text-center">
                Send kode på nytt om{' '}
                <span className="font-semibold text-black">
                    {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                </span>
            </p>
        );
    }

    return (
        <p className="text-sm text-[#6B7280] text-center">
            Fikk du ikke koden?{' '}
            <button
                type="button"
                disabled={isSending}
                onClick={onResend}
                className="font-bold text-black hover:underline disabled:opacity-50"
            >
                {isSending ? 'Sender...' : 'Send på nytt'}
            </button>
        </p>
    );
}
