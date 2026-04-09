interface ServiceId {
  _id: string;
  title?: string;
}

interface UserId {
  _id: string;
  name?: string;
}

export interface ContractOrder {
  _id: string;
  serviceId?: ServiceId;
  customerId?: UserId;
  providerId?: UserId;
  agreedPrice?: number;
  scheduledDate?: string;
}

export interface Contract {
  _id: string;
  serviceId: {
    _id: string;
    title?: string;
    description?: string;
    category?: string;
  };
  content: string;
  price: number;
  scheduledDate?: string;
  address?: string;
  version: number;
  clientId: {
    _id: string;
    name?: string;
  };
  providerId: {
    _id: string;
    name?: string;
  };
  previousVersions?: Array<{
    content: string;
    timestamp: string;
  }>;
  serviceSnapshot?: {
    title?: string;
    description?: string;
    category?: string;
  };
  customerSnapshot?: {
    userId: string;
    name?: string;
  };
  providerSnapshot?: {
    userId: string;
    name?: string;
  };
  signedByCustomer: boolean;
  signedByProvider: boolean;
  signedByCustomerAt?: string;
  signedByProviderAt?: string;
  customerSignature?: string;
  providerSignature?: string;
  customerIp?: string;
  providerIp?: string;
  status: 'draft' | 'pending_signatures' | 'signed' | 'cancelled';
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
  orderId?: string | ContractOrder;
  contract?: string; 
}

export type CreateContractPayload = {
  serviceId: string;
  content: string;
  price: number;
  scheduledDate?: string;
  address?: string;
};