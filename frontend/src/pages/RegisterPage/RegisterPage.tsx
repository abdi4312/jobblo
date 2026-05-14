import Auth from "../../components/Auth/Auth.tsx";
import { RegisterForm } from "../../components/Auth/RegisterForm.tsx";

export default function RegisterPage() {
  return (
    <div className="min-h-screen">
      <div className="flex mx-auto">
        <div className="w-[50%] relative 2xl:mix-h-236 min-h-screen overflow-hidden hidden lg:block">
          <Auth />
        </div>

        <RegisterForm />
      </div>
    </div>
  );
}
