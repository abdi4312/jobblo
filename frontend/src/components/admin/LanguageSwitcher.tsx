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
            className="h-8 cursor-pointer rounded-md border bg-card px-2 text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
            {locales.map((l) => (
                <option key={l} value={l}>
                    {localeLabels[l]}
                </option>
            ))}
        </select>
    );
}
