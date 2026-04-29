import { format } from "date-fns";
import { nb } from "date-fns/locale";

export const timeFormatter = {
  /**
   * Formats a date to "HH:mm"
   */
  toShortTime: (date: Date | string | number): string => {
    const d = new Date(date);
    return format(d, "HH:mm", { locale: nb });
  },

  /**
   * Formats a date to "HH:mm:ss"
   */
  toLongTime: (date: Date | string | number): string => {
    const d = new Date(date);
    return format(d, "HH:mm:ss", { locale: nb });
  },

  /**
   * Formats a time range
   */
  toRange: (start: Date | string | number, end: Date | string | number): string => {
    return `${timeFormatter.toShortTime(start)} - ${timeFormatter.toShortTime(end)}`;
  },

  /**
   * Formats minutes to "X t Y min"
   */
  formatDuration: (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} t`;
    return `${hours} t ${mins} min`;
  }
};
