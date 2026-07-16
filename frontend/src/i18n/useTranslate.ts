import { useContext } from 'react';
import { LanguageContext } from './LanguageContext';

export function useTranslate() {
    return useContext(LanguageContext);
}
