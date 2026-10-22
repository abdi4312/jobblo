/**
 * Validation for the "Legg ut oppdrag" form, with the same rules and wording as the web
 * form (frontend/src/hooks/useCreateJobForm.ts). Pure: no React, no I/O.
 * Check: node src/utils/createJobValidation.check.mjs
 */
import type { CreateJobFormValues } from '../services/createJob.service';

export type CreateJobErrorKey =
  | 'images'
  | 'title'
  | 'description'
  | 'categories'
  | 'address'
  | 'city'
  | 'countyCode'
  | 'municipalityCode'
  | 'coordinates'
  | 'fromDate'
  | 'toDate'
  | 'durationValue'
  | 'price'
  | 'email'
  | 'phone';
export type CreateJobErrors = Partial<Record<CreateJobErrorKey, string>>;

export interface CreateJobValidationInput {
  values: CreateJobFormValues;
  imageCount: number;
  /** Phone digits only (max 8). */
  phone: string;
  /** Total price shown to applicants (Timepris: rate × duration). */
  displayedPrice: number;
}

const isDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]);
};

/**
 * `target` is the step being moved TO: 2 checks step 1 (Grunnleggende), 3 checks step 2
 * (Tid & sted), 5 checks step 4 (Kontakt). Step 3 (Sjekkliste) is optional.
 */
export function validateCreateJobStep(target: number, input: CreateJobValidationInput): CreateJobErrors {
  const { values, imageCount, phone, displayedPrice } = input;
  const next: CreateJobErrors = {};

  if (target === 2) {
    if (!imageCount) next.images = 'Vennligst last opp minst ett bilde.';
    const title = values.title.trim();
    if (!title) next.title = 'Vennligst skriv inn en tittel.';
    else if (title.length < 5) next.title = 'Tittelen må være minst 5 tegn.';
    else if (title.length > 70) next.title = 'Tittelen kan være maks 70 tegn.';
    if (!values.categories.length) next.categories = 'Vennligst velg en kategori.';
    const description = values.description.trim();
    if (!description) next.description = 'Vennligst skriv inn en beskrivelse.';
    else if (description.length < 20) next.description = 'Beskrivelsen må være minst 20 tegn.';
    else if (description.length > 2000) next.description = 'Beskrivelsen kan være maks 2000 tegn.';
  }

  if (target === 3) {
    if (!values.address.trim()) next.address = 'Vennligst skriv inn en adresse.';
    if (!values.countyCode) next.countyCode = 'Velg fylke.';
    if (!values.municipalityCode) next.municipalityCode = 'Velg kommune.';
    if (!values.city.trim()) next.city = 'Vennligst skriv inn et sted/by.';
    if (values.coordinates[0] === 0 && values.coordinates[1] === 0)
      next.coordinates = 'Bekreft hvor oppdraget er — finn adressen på kartet eller trykk i kartet.';
    if (!values.fromDate) next.fromDate = 'Vennligst velg startdato.';
    else if (!isDate(values.fromDate)) next.fromDate = 'Ugyldig fra-dato.';
    if (!values.toDate) next.toDate = 'Vennligst velg sluttdato.';
    else if (!isDate(values.toDate)) next.toDate = 'Ugyldig sluttdato.';
    else if (values.fromDate && values.toDate < values.fromDate) next.toDate = 'Sluttdato kan ikke være før startdato.';
    const duration = Number(values.durationValue) || 0;
    if (!values.durationValue.trim() || duration <= 0) next.durationValue = 'Vennligst oppgi forventet varighet.';
    else if (duration > 1000) next.durationValue = 'Varigheten kan ikke overstige 1000.';
    const timepris = values.paymentType === 'Timepris';
    const amount = Number(timepris ? values.hourlyRate : values.price) || 0;
    if (amount > 1_000_000)
      next.price = timepris ? 'Timepris kan ikke overstige 1000000 kr.' : 'Beløpet kan ikke overstige 1000000 kr.';
    else if (amount <= 0 || !displayedPrice)
      next.price = timepris
        ? 'Vennligst oppgi en timepris større enn 0 kr.'
        : values.paymentType === 'Anbud'
          ? 'Vennligst oppgi et antatt budsjett større enn 0 kr for anbudet.'
          : 'Vennligst oppgi en fastpris større enn 0 kr.';
  }

  if (target === 5) {
    if (phone && phone.length !== 8) next.phone = 'Et norsk nummer har åtte siffer.';
    const email = values.contactEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Vennligst skriv inn en gyldig e-post.';
  }

  return next;
}
