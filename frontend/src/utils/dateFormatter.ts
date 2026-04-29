import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { nb } from "date-fns/locale";

export const dateFormatter = {
  /**
   * Formats a date to "dd.MM.yyyy" (Standard Norwegian format)
   */
  toShortDate: (date: Date | string | number): string => {
    const d = new Date(date);
    return format(d, "dd.MM.yyyy", { locale: nb });
  },

  /**
   * Formats a date to "d. MMMM yyyy"
   */
  toLongDate: (date: Date | string | number): string => {
    const d = new Date(date);
    return format(d, "d. MMMM yyyy", { locale: nb });
  },

  /**
   * Returns a relative time string (e.g., "for 2 dager siden", "i dag")
   */
  toRelative: (date: Date | string | number): string => {
    const d = new Date(date);
    if (isToday(d)) return "I dag";
    if (isYesterday(d)) return "I går";

    return formatDistanceToNow(d, { addSuffix: true, locale: nb });
  },

  /**
   * Custom format wrapper
   */
  format: (date: Date | string | number, formatStr: string): string => {
    return format(new Date(date), formatStr, { locale: nb });
  },
};
