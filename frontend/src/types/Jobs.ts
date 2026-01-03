export type Jobs = {
  _id: string;
  userId: string | null;
  title: string;
  description: string;
  price: number;
  location: {
    type: string;
    coordinates: number[];
    address: string;
    city?: string;
  };
  duration: {
    value?: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  categories: string[];
  images: string[];
  urgent: boolean;
  status: 'open' | 'closed';
  tags: string[];
  equipment: 'utstyrfri' | 'delvis utstyr' | 'trengs utstyr';
  createdAt: string;
  updatedAt: string;
  timeEntries?: {
    userId: string;
    hours: number;
    date: string;
    note: string;
    _id: string;
    createdAt: string;
    updatedAt: string;
  }[];
};