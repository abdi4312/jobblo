import Auth from "../../components/Auth/Auth.tsx";
import { LoginForm } from "../../components/Auth/LoginForm.tsx";

export default function LoginPage() {
  return (
    <>
      <div className="min-h-screen max-w-[1200px] box-card-custom md:my-3.5 mx-auto">
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
