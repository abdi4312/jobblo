import Auth from "../../components/Auth/Auth.tsx";
import { LoginForm } from "../../components/Auth/LoginForm.tsx";

export default function LoginPage() {
  return (
    <>
      <div className="min-h-screen">
        <div className="flex mx-auto">
          <div className="w-[50%] relative 2xl:mix-h-236 min-h-screen overflow-hidden hidden lg:block">
            <Auth />
          </div>
          <LoginForm />
        </div>
      </div>
    </>
  );
}
