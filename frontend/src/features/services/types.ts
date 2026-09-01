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

/**
 * What the owner may do with this listing, decided by the server.
 *
 * The client must not infer this from `status`: `Service.status` and `Order.status` are
 * written by different code paths and have drifted before, which is how a delete button
 * ended up looking available on a listing with money in SafePay escrow and returning an
 * opaque error when pressed. `GET /api/services/my-posted` computes it from the orders
 * actually attached to the listing, and `PUT`/`DELETE` enforce the same rule.
 *
 * `blockedReason` is a finished Norwegian sentence, ready to show.
 */
export interface ListingCapabilities {
  canEdit: boolean;
  canDelete: boolean;
  blockedCode: string | null;
  blockedReason: string | null;
  blockingStatus: string | null;
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
  status:
    | 'open'
    | 'closed'
    | 'awaiting_payment'
    | 'paid'
    | 'in_progress'
    | 'ready_for_review'
    | 'completed'
    | 'pending'
    | 'waiting_for_approval'
    | 'cancelled'
    | 'expired'
    | 'draft';
  tags: string[];
  equipment: string;
  imageMetadata: ImageMetadata[];
  timeEntries: TimeEntry[];
  duration: Duration;
  fromDate?: string;
  toDate?: string;
  paymentType?: string;
  hourlyRate?: number;
  maxApplicants?: number;
  countyCode?: string;
  municipalityCode?: string;
  areaCode?: string;
  /** Owner-only: `select: false` on the model, returned by /api/services/my-posted. */
  contactPhone?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
  __v: number;

  /** Present on `my-posted`; absent on public listing responses. */
  capabilities?: ListingCapabilities;
}
