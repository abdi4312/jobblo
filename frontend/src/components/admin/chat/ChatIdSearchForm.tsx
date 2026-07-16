import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface ChatIdSearchFormProps {
    onSearch: (chatId: string) => void;
    defaultValue?: string;
    loading?: boolean;
}

export function ChatIdSearchForm({ onSearch, defaultValue = '', loading = false }: ChatIdSearchFormProps) {
    const [value, setValue] = useState(defaultValue);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed.length > 0) onSearch(trimmed);
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-center gap-3" role="search">
            <div className="relative flex-1">
                <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    aria-hidden="true"
                />
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Skriv inn Chat ID (24-tegns MongoDB ObjectId)…"
                    aria-label="Chat ID"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 bg-white"
                    autoComplete="off"
                    spellCheck={false}
                />
            </div>
            <button
                type="submit"
                disabled={value.trim().length === 0 || loading}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
                {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                ) : (
                    <Search size={15} aria-hidden="true" />
                )}
                Søk
            </button>
        </form>
    );
}
