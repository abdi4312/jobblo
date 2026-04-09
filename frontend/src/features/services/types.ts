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

export interface ImageMetadata {
  url: string;
  publicId?: string;
}

export interface TimeEntry {
  start?: string;
  end?: string;
}

export interface ServiceUpdateData {
  title?: string;
  description?: string;
  price?: number;
  location?: Location;
  categories?: string[];
  urgent?: boolean;
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
  imageMetadata: ImageMetadata[];
  timeEntries: TimeEntry[];
  duration: Duration;
  fromDate?: string;
  toDate?: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}