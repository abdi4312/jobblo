import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

export const timeFormatter = {
  /**
   * Formats a date to "HH:mm"
   */
  toShortTime: (date: Date | string | number): string => {
    const d = new Date(date);
    return format(d, 'HH:mm', { locale: nb });
  },

  /**
   * Formats a date to "HH:mm:ss"
   */
  toLongTime: (date: Date | string | number): string => {
    const d = new Date(date);
    return format(d, 'HH:mm:ss', { locale: nb });
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
  },

  /**
   * Formats a job's `duration: { value, unit }` (see backend models/Service.js, whose
   * unit enum accepts both English and Norwegian spellings) into Norwegian text.
   * Returns null when the job has no duration, so callers can omit the field entirely
   * rather than inventing one. (F-38)
   */
  toJobDuration: (duration?: { value?: number; unit?: string } | null): string | null => {
    if (!duration?.value || duration.value <= 0) return null;
    const labels: Record<string, string> = {
      minutes: 'minutter',
      minutter: 'minutter',
      hours: 'timer',
      timer: 'timer',
      days: 'dager',
      dager: 'dager',
    };
    const unit = duration.unit ? (labels[duration.unit] ?? duration.unit) : '';
    return `${duration.value} ${unit}`.trim();
  },
};
