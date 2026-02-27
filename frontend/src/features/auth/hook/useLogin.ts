import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { userLogin } from "../Api"; // Aapka api file path
import { toast } from "react-toastify";
import axios from "axios";

export const useLogin = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => 
      userLogin(email, password),
    
    onSuccess: (response) => {
      // Yahan aap token save karne ka logic bhi daal sakte hain
      // localStorage.setItem("token", response.data.token);
      
      toast.success("Innlogging vellykket!");
      navigate("/");
    },
    
    onError: (error) => {
      console.error("Error logging in:", error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          toast.error("Feil e-post eller passord");
        } else {
          toast.error("Kunne ikke logge inn");
        }
      } else {
        toast.error("Kunne ikke koble til server");
      }
    },
  });
};