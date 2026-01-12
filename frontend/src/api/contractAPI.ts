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
  orderId: string | ContractOrder;
  content: string;
  version: number;
  signedByCustomer: boolean;
  signedByProvider: boolean;
  signedByCustomerAt?: string;
  signedByProviderAt?: string;
  status: 'draft' | 'pending_signatures' | 'signed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export type CreateContractPayload = {
  orderId: string;
  content: string;
}

/**
 * Get contract by ID
 */
export const getContractById = async (serviceId: string): Promise<Contract> => {
  const response = await mainLink.get(`/api/contracts/${serviceId}`);
    const contractsArray = response.data.contracts;
    if (Array.isArray(contractsArray) && contractsArray.length > 0) {
      return contractsArray[0];
    }
    return null;
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
