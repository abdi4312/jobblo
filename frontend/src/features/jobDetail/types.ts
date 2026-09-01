export interface Service {
  _id: string;
  title: string;
  description: string;
  price: number;
  location: {
    address: string;
    city: string;
    coordinates: [number, number];
  };
  categories: string[];
  images: string[];
  urgent: boolean;
  status: string;
  equipment: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  // Read back by the edit form (/Publish-job/:id). Missing here meant the edit
  // screen reopened a job without its dates, duration, rate or location codes
  // and then saved those blanks over the original.
  fromDate?: string;
  toDate?: string;
  duration?: { value?: number; unit?: string };
  paymentType?: string;
  hourlyRate?: number;
  maxApplicants?: number;
  countyCode?: string;
  municipalityCode?: string;
  areaCode?: string;
}
