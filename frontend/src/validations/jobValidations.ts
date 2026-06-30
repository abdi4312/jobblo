import { required, email } from './rules';

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

export const jobValidationSchema = {
  // ... title and description remain same ...
  title: [
    required<JobFormValues>('title', 'Vennligst skriv inn en tittel'),
    {
      test: (values: JobFormValues) => values.title.length >= 5,
      message: 'Tittelen må være minst 5 tegn',
    },
  ],
  description: [
    required<JobFormValues>('description', 'Vennligst skriv inn en beskrivelse'),
    {
      test: (values: JobFormValues) => values.description.length >= 20,
      message: 'Beskrivelsen må være minst 20 tegn',
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
        if (!val || val === '0') return false; // Budsjett is mandatory based on user request
        const num = typeof val === 'string' ? Number(val) : val;
        return !Number.isNaN(num) && num > 0;
      },
      message: 'Vennligst oppgi et anslått budsjett',
    },
  ],
  durationValue: [
    {
      test: (values: JobFormValues) => {
        const val = values.durationValue;
        if (!val || val === '0') return false;
        const num = typeof val === 'string' ? Number(val) : val;
        return !Number.isNaN(num) && num > 0;
      },
      message: 'Vennligst oppgi forventet varighet',
    },
  ],
  fromDate: [required<JobFormValues>('fromDate', 'Vennligst velg startdato')],
  toDate: [
    required<JobFormValues>('toDate', 'Vennligst velg sluttdato'),
    {
      test: (values: JobFormValues) => {
        if (!values.fromDate || !values.toDate) return true;
        return new Date(values.toDate) >= new Date(values.fromDate);
      },
      message: 'Sluttdato kan ikke være før startdato',
    },
  ],
};
