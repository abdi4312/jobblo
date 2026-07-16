/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useCallback, useEffect } from 'react';
import type { SupportedLocale, TranslationKeys } from './types';
import { defaultLocale, TRANSLATIONS } from './types';

export interface LanguageContextValue {
    locale: SupportedLocale;
    setLocale: (locale: SupportedLocale) => void;
    t: (path: string, fallback?: string) => string;
}

export const LanguageContext = createContext<LanguageContextValue>({
    locale: defaultLocale,
    setLocale: () => {},
    t: (path: string, fallback?: string) => fallback ?? path,
});

const STORAGE_KEY = 'jobblo-admin-locale';

function resolve(obj: TranslationKeys | Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
        if (acc && typeof acc === 'object') {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<SupportedLocale>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'no' || stored === 'en') return stored;
        } catch { /* localStorage unavailable */ }
        return defaultLocale;
    });

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* localStorage unavailable */ }
    }, [locale]);

    const setLocale = useCallback((l: SupportedLocale) => {
        setLocaleState(l);
    }, []);

    const t = useCallback(
        (path: string, fallback?: string): string => {
            const translation = resolve(
                TRANSLATIONS[locale] as unknown as Record<string, unknown>,
                path,
            );
            if (typeof translation === 'string') return translation;
            return fallback ?? path;
        },
        [locale],
    );

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LanguageContext.Provider>
    );
}
