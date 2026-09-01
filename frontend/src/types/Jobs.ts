export type Jobs = {
  _id: string;
  userId: string | null;
  title: string;
  description: string;
  price: number;
  hourlyRate?: number;
  location: {
    type: string;
    coordinates: number[];
    address: string;
    city: string;
  };
  duration: {
    value?: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  categories: string[];
  images: string[];
  urgent: boolean;
  promoted?: boolean;
  favCount?: number;
  /**
   * Mirrors the `status` enum on `backend/models/Service.js`. It was typed as
   * `'open' | 'closed'` — two of the eleven values the server can actually send — so any
   * code that checked for a completed or cancelled job was reported as an impossible
   * comparison and had to be cast away.
   */
  status:
    | 'open'
    | 'closed'
    | 'awaiting_payment'
    | 'paid'
    | 'in_progress'
    | 'completed'
    | 'pending'
    | 'waiting_for_approval'
    | 'cancelled'
    | 'expired'
    | 'draft';
  tags: string[];
  maxApplicants?: number;
  currentApplicants?: number;
  isLimitReached?: boolean;
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
