import no from './no.json';
import en from './en.json';

export type TranslationKeys = typeof no;
export type SupportedLocale = 'no' | 'en';

export const locales: SupportedLocale[] = ['no', 'en'];
export const defaultLocale: SupportedLocale = 'no';

export const TRANSLATIONS: Record<SupportedLocale, TranslationKeys> = {
    no: no as TranslationKeys,
    en: en as TranslationKeys,
};

export const localeLabels: Record<SupportedLocale, string> = {
    no: 'Norsk',
    en: 'English',
};
