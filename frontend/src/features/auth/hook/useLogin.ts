import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { userLogin } from "../Api"; // Aapka api file path
import { toast } from "react-hot-toast";

export const useLogin = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => 
      userLogin({ email, password }),
    
    onSuccess: (response) => {
      // Yahan aap token save karne ka logic bhi daal sakte hain
      // localStorage.setItem("token", response.data.token);
      console.log("response",response.user.name);
      
      toast.success(`Velkommen tilbake, ${response.user.name}!`);
      navigate("/home");
    },
    
    onError: (error: any) => {
      console.error("Error logging in:", error);
      console.log("error",error.response?.data.error);
      toast.error(error.response?.data?.error || "Feil e-post eller passord");
    },
  
  });
};