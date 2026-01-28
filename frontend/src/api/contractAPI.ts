import mainLink from "./mainURLs";

interface ContractOrder {
  _id: string;
  serviceId?: any;
  customerId?: any;
  providerId?: any;
  agreedPrice?: number;
  scheduledDate?: string;
}

export type Contract = {
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
  // Legacy field for backwards compatibility
  orderId?: string | ContractOrder;
  contract?: string; // Legacy field
}

export type CreateContractPayload = {
  serviceId: string;
  content: string;
  price: number;
  scheduledDate?: string;
  address?: string;
}

/**
 * Get contract by ID
 */
export const getContractById = async (serviceId: string): Promise<Contract[]> => {
  const response = await mainLink.get(`/api/contracts/${serviceId}`);
  const contractsArray = response.data.contracts;
  if (Array.isArray(contractsArray)) {
    return contractsArray;
  }
  return [];
};

/**
 * Create a new contract for an order
 */
export const createContract = async (payload: CreateContractPayload): Promise<Contract> => {
  const response = await mainLink.post("/api/contracts", payload);
  return response.data.contract;
};

/**
 * Sign a contract (customer or provider)
 */
export const signContract = async (contractId: string): Promise<Contract> => {
  const response = await mainLink.patch(`/api/contracts/${contractId}/sign`);
  return response.data.contract;
};

/**
 * Delete a contract
 */
export const deleteContract = async (contractId: string): Promise<void> => {
  await mainLink.delete(`/api/contracts/${contractId}`);
};
