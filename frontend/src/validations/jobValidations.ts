import { required } from './rules';

export type JobFormValues = {
  title: string;
  description: string;
  categories: string | string[];
  address: string;
  city: string;
  phone: string;
  email: string;
  price: string | number;
  durationValue: string | number;
  fromDate: string;
  toDate: string;
};

export const JOB_LIMITS = {
  TITLE_MIN: 5,
  TITLE_MAX: 200,
  DESCRIPTION_MIN: 20,
  DESCRIPTION_MAX: 5000,
  PRICE_MAX: 1000000,
  DURATION_MAX: 1000,
} as const;

const numericValue = (value: string | number) => {
  if (typeof value === 'string' && value.trim() === '') return NaN;
  const number = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(number) ? number : NaN;
};

export const jobValidationSchema = {
  title: [
    required<JobFormValues>('title', 'Vennligst skriv inn en tittel'),
    {
      test: (values: JobFormValues) => values.title.trim().length >= JOB_LIMITS.TITLE_MIN,
      message: 'Tittelen må være minst 5 tegn',
    },
    {
      test: (values: JobFormValues) => values.title.trim().length <= JOB_LIMITS.TITLE_MAX,
      message: 'Tittelen kan være maks 200 tegn',
    },
  ],
  description: [
    required<JobFormValues>('description', 'Vennligst skriv inn en beskrivelse'),
    {
      test: (values: JobFormValues) => values.description.trim().length >= JOB_LIMITS.DESCRIPTION_MIN,
      message: 'Beskrivelsen må være minst 20 tegn',
    },
    {
      test: (values: JobFormValues) => values.description.trim().length <= JOB_LIMITS.DESCRIPTION_MAX,
      message: 'Beskrivelsen kan være maks 5000 tegn',
    },
  ],
  categories: [
    {
      test: (values: JobFormValues) => {
        if (Array.isArray(values.categories)) return values.categories.length > 0;
        return !!values.categories && values.categories.trim() !== '';
      },
      message: 'Vennligst velg en kategori',
    },
  ],
  address: [required<JobFormValues>('address', 'Vennligst skriv inn en adresse')],
  city: [required<JobFormValues>('city', 'Vennligst skriv inn et sted/by')],
  email: [
    {
      test: (values: JobFormValues) => {
        if (!values.email) return true; // Optional
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(values.email.trim());
      },
      message: 'Vennligst skriv inn en gyldig e-post',
    },
  ],
  price: [
    {
      test: (values: JobFormValues) => {
        const val = values.price;
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) return false;
        const num = numericValue(val);
        return num > 0;
      },
      message: 'Vennligst oppgi et beløp/budsjett større enn 0 kr',
    },
    {
      test: (values: JobFormValues) => numericValue(values.price) <= JOB_LIMITS.PRICE_MAX,
      message: 'Beløpet kan ikke overstige 1000000 kr',
    },
  ],
  durationValue: [
    {
      test: (values: JobFormValues) => {
        const val = values.durationValue;
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) return false;
        const num = numericValue(val);
        return num > 0;
      },
      message: 'Vennligst oppgi forventet varighet',
    },
    {
      test: (values: JobFormValues) => numericValue(values.durationValue) <= JOB_LIMITS.DURATION_MAX,
      message: 'Varigheten kan ikke overstige 1000',
    },
  ],
  fromDate: [
    required<JobFormValues>('fromDate', 'Vennligst velg startdato'),
    {
      test: (values: JobFormValues) => !values.fromDate || !Number.isNaN(new Date(values.fromDate).getTime()),
      message: 'Ugyldig fra-dato',
    },
  ],
  toDate: [
    required<JobFormValues>('toDate', 'Vennligst velg sluttdato'),
    {
      test: (values: JobFormValues) => !values.toDate || !Number.isNaN(new Date(values.toDate).getTime()),
      message: 'Ugyldig sluttdato',
    },
    {
      test: (values: JobFormValues) => {
        if (!values.fromDate || !values.toDate) return true;
        const from = new Date(values.fromDate);
        const to = new Date(values.toDate);
        return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from;
      },
      message: 'Sluttdato kan ikke være før startdato',
    },
  ],
};
