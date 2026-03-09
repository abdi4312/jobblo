import mainLink from "../../api/mainURLs";
// Yahan 'type' keyword add karein
import type { Contract, CreateContractPayload } from "./types/contract.types";

export const getContractByServiceId = async (serviceId: string): Promise<Contract | null> => {
  const response = await mainLink.get(`/api/contracts/${serviceId}`);
  const contractsArray = response.data.contracts;
  return Array.isArray(contractsArray) && contractsArray.length > 0 ? contractsArray[0] : null;
};

export const createContract = async (payload: CreateContractPayload): Promise<Contract> => {
  const response = await mainLink.post("/api/contracts", payload);
  return response.data.contract;
};

export const signContract = async (contractId: string): Promise<Contract> => {
  const response = await mainLink.patch(`/api/contracts/${contractId}/sign`);
  console.log("response.data.contract:", response.data.contract);
  return response.data.contract;
};

export const deleteContract = async (contractId: string): Promise<void> => {
  await mainLink.delete(`/api/contracts/${contractId}`);
};