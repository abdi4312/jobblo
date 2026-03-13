import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signContract, createContract } from "../api"; // Dono functions import kar lein
import toast from "react-hot-toast";
import { initSocket } from "../../../socket/socket";

export const useContractActions = (serviceId: string) => {
  const queryClient = useQueryClient();
  const socket = initSocket();

  // 1. Sign Contract Mutation
  const signMutation = useMutation({
    mutationFn: (contractId: string) => signContract(contractId),
    onSuccess: (updatedContract) => {
      // TanStack Query ka cache update
      queryClient.setQueryData(["contract", serviceId], updatedContract);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      toast.success("Kontrakten er signert!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Kunne ikke signere kontrakten");
    },
  });

  // 2. Create Contract Mutation
  const createMutation = useMutation({
    mutationFn: (data: { 
      serviceId: string; 
      content: string; 
      price: number; 
      scheduledDate?: string; 
      address?: string 
    }) => createContract(data),
    onSuccess: (newContract) => {
      // Cache update karein taake UI foran badal jaye
      queryClient.setQueryData(["contract", serviceId], newContract);
      queryClient.invalidateQueries({ queryKey: ["chats"] });

      // Socket emit karein real-time update ke liye
      socket.emit("join_service", serviceId);
      socket.emit("contract_created", { contract: newContract });

      toast.success("Contract sent successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to create contract");
    },
  });

  return { 
    signMutation, 
    createMutation 
  };
};