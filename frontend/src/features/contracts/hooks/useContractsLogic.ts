import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAllContracts, signContract } from "../../../api/contractAPI";
import type { Contract } from "../../../api/contractAPI";
import { getAllOrders, updateOrderStatus } from "../../../api/orderAPI";
import type { Order } from "../../../api/orderAPI";
import { useUserStore } from "../../../stores/userStore";
import { toast } from "react-hot-toast";
import { initSocket } from "../../../socket/socket";

export const useContractsLogic = () => {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<
    "Alle" | "Sendte" | "Mottatte"
  >("Alle");

  const filteredContracts = contracts.filter((contract) => {
    if (activeFilter === "Alle") return true;
    if (activeFilter === "Sendte")
      return contract.providerId?._id === user?._id;
    if (activeFilter === "Mottatte") return contract.clientId._id === user?._id;
    return true;
  });

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [fetchedContracts, fetchedOrders] = await Promise.all([
        getAllContracts(),
        getAllOrders(),
      ]);
      setContracts(fetchedContracts);
      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Error fetching contracts/orders:", error);
      if (showLoading) toast.error("Kunne ikke laste kontrakter.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = initSocket();
    if (socket) {
      socket.on("contract_updated", (data: any) => {
        fetchData(false);
      });

      socket.on("new_notification", (data: any) => {
        if (data.type === "alert" || data.type === "order") {
          toast.success(data.content, {
            duration: 5000,
            icon: "🔔",
          });
          fetchData(false);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off("contract_updated");
        socket.off("new_notification");
      }
    };
  }, []);

  const handleSignContract = async (contractId: string) => {
    try {
      await signContract(contractId);
      toast.success("Kontrakt signert!");

      const socket = initSocket();
      if (socket) {
        socket.emit("contract_updated", { contractId });
      }

      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Kunne ikke signere kontrakt");
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: string,
  ) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      toast.success("Bestillingsstatus oppdatert!");
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Kunne ikke oppdatere status");
    }
  };

  return {
    user,
    navigate,
    contracts,
    orders,
    loading,
    activeFilter,
    setActiveFilter,
    filteredContracts,
    handleSignContract,
    handleUpdateOrderStatus,
    fetchData,
  };
};
