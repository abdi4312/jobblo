import React from 'react';
import { useTranslate } from '../../i18n/useTranslate';
import { locales, localeLabels } from '../../i18n/types';
import type { SupportedLocale } from '../../i18n/types';

export function LanguageSwitcher() {
    const { locale, setLocale, t } = useTranslate();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setLocale(e.target.value as SupportedLocale);
    };

    return (
        <select
            value={locale}
            onChange={handleChange}
            aria-label={t('language.bytt_sprak')}
            className="text-xs font-medium bg-transparent border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 cursor-pointer"
        >
            {locales.map((l) => (
                <option key={l} value={l}>
                    {localeLabels[l]}
                </option>
            ))}
        </select>
    );
}
