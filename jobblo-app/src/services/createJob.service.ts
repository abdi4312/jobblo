import apiClient from '../api/client';

export interface CreateJobImage {
  uri: string;
  name: string;
  type: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
}

export type PaymentType = 'Fastpris' | 'Timepris' | 'Anbud';
export type DurationUnit = 'minutes' | 'hours' | 'days';

export interface CreateJobFormValues {
  title: string;
  description: string;
  categories: string[];
  tags: string[];
  equipment: 'utstyrfri' | 'delvis utstyr' | 'trengs utstyr';
  maxApplicants: string;
  urgent: boolean;
  address: string;
  city: string;
  countyCode: string;
  municipalityCode: string;
  areaCode: string;
  coordinates: [number, number];
  fromDate: string;
  toDate: string;
  durationValue: string;
  durationUnit: DurationUnit;
  paymentType: PaymentType;
  price: string;
  hourlyRate: string;
  contactPhone: string;
  contactEmail: string;
  checklist: ChecklistItem[];
}

export interface CreateServiceResponse {
  _id: string;
  title: string;
  status: string;
}

type NativeFilePart = { uri: string; name: string; type: string };

export async function createJob(values: CreateJobFormValues, images: CreateJobImage[]): Promise<CreateServiceResponse> {
  const formData = new FormData();
  const append = (name: string, value: string) => formData.append(name, value);
  const duration = Number(values.durationValue);
  const hourlyRate = Number(values.hourlyRate);
  const price = values.paymentType === 'Timepris'
    ? hourlyRate * (values.durationUnit === 'days' ? duration * 8 : values.durationUnit === 'minutes' ? duration / 60 : duration)
    : Number(values.price);

  append('title', values.title.trim());
  append('description', values.description.trim());
  append('price', String(price));
  if (values.hourlyRate.trim()) append('hourlyRate', values.hourlyRate.trim());
  append('paymentType', values.paymentType);
  append('urgent', String(values.urgent));
  append('maxApplicants', values.maxApplicants.trim() || '0');
  append('equipment', values.equipment);
  append('fromDate', values.fromDate);
  append('toDate', values.toDate);
  append('duration[value]', values.durationValue.trim());
  append('duration[unit]', values.durationUnit);
  append('location[address]', values.address.trim());
  append('location[city]', values.city.trim());
  append('location[type]', 'Point');
  append('location[coordinates][0]', String(values.coordinates[1]));
  append('location[coordinates][1]', String(values.coordinates[0]));
  append('countyCode', values.countyCode);
  append('municipalityCode', values.municipalityCode);
  if (values.areaCode) append('areaCode', values.areaCode);
  values.categories.forEach((category) => append('categories', category));
  values.tags.filter(Boolean).forEach((tag) => append('tags', tag));
  if (values.contactPhone.trim()) append('contactPhone', values.contactPhone.trim());
  if (values.contactEmail.trim()) append('contactEmail', values.contactEmail.trim());
  append('checklist', JSON.stringify(values.checklist));

  images.forEach((image) => {
    const part: NativeFilePart = { uri: image.uri, name: image.name, type: image.type };
    (formData as FormData & { append(name: string, value: NativeFilePart): void }).append('images', part);
  });

  const response = await apiClient.post<CreateServiceResponse>('/services', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (!response.data?._id) throw new Error('Oppdraget ble opprettet uten gyldig ID');
  return response.data;
}
