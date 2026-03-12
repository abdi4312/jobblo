export interface Location {
  coordinates: [number, number];
  address: string;
  city: string;
  type: string;
}

export interface Duration {
  value: number;
  unit: string;
}

export interface UserId {
  _id: string;
  name: string;
  email: string;
}

export interface Service {
  _id: string;
  userId: UserId;
  title: string;
  description: string;
  price: number;
  location: Location;
  categories: string[];
  images: string[];
  urgent: boolean;
  status: string;
  tags: string[];
  equipment: string;
  imageMetadata: any[];
  timeEntries: any[];
  duration: Duration;
  fromDate?: string;
  toDate?: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}