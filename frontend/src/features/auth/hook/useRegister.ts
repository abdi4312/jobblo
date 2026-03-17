import { useMutation } from "@tanstack/react-query";
import { registerUser } from "../Api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";

export const useRegister = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: registerUser,
    onSuccess: (response) => {
      toast.success(`Velkommen ${response.user.name}!`);
      navigate("/home");
    },
    onError: (error: any) => {
      console.error("Error registering:", error);
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data?.error || "Kunne ikke registrere bruker";
        if (error.response?.status === 400 && errorMsg.includes("already exists")) {
          toast.error("En bruker med denne e-posten eksisterer allerede");
        } else {
          toast.error(errorMsg);
        }
      } else {
        toast.error("Kunne ikke registrere bruker");
      }
    },
  });
};