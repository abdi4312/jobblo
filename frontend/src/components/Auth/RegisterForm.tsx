import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import SocialAuthButtons from "../SocialAuthButtons/AuthButton.tsx";
import { Input } from "../Ui/Input.tsx";
import { Button } from "../Ui/button/Button";
import { useAuth } from "../../features/auth/hook/useAuth.ts";
import { useForm } from "../../hooks/useForm.ts";
import {
  registerValidationSchema,
  type RegisterFormValues,
} from "../../validations/authValidations";

export const RegisterForm = () => {
  const navigate = useNavigate();
  const { register, isRegistering } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { values, errors, handleChange, validate } =
    useForm<RegisterFormValues>(
      {
        name: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "user",
        companyName: "",
        orgNumber: "",
      },
      registerValidationSchema,
    );

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Vennligst rett opp feilene i skjemaet");
      return;
    }

    register({
      name: values.name,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
      role: values.role,
      ...(values.role === "company" && {
        companyName: values.companyName,
        orgNumber: values.orgNumber,
      }),
    });
  };

  return (
    <div className="w-full lg:w-[50%] flex items-center justify-center box-card-custom rounded-none p-4">
      <div className="w-full max-w-120 p-8">
        <div className="mb-6">
          <h1 className="text-[28px] font-bold text-black leading-tight mb-2">
            Bli med i markedsplassen
          </h1>
          <p className="text-base text-[#6B7280]">
            Opprett en konto for å leie eksperter eller tilby tjenester.
          </p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-5">
          {/* User Type Selection (Moved to top) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
              Jeg er en
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                label="Privatperson"
                className={`flex-1 rounded-[8px] h-11 font-semibold border border-zinc-700
                ${values.role === "user" ? "bg-custom-green" : "bg-transparent text-custom-black hover:bg-custom-green-light"}`}
                onClick={() => handleChange("role", "user")}
              />
              <Button
                type="button"
                label="Firma"
                className={`flex-1 rounded-[8px] h-11 font-semibold border border-zinc-700
                ${values.role === "company" ? "bg-custom-green" : "bg-transparent text-custom-black hover:bg-custom-green-light"}`}
                onClick={() => handleChange("role", "company")}
              />
            </div>
            {errors.role && (
              <p className="text-xs text-red-500 mt-1">{errors.role}</p>
            )}
          </div>

          {/* Conditional Name Fields */}
          {values.role === "user" ? (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* First Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
                  Fornavn
                </label>
                <Input
                  type="text"
                  value={values.name}
                  placeholder="Ola"
                  onChange={(e) => handleChange("name", e.target.value)}
                  error={errors.name}
                  className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-11"
                />
              </div>

              {/* Last Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
                  Etternavn
                </label>
                <Input
                  type="text"
                  value={values.lastName}
                  placeholder="Nordmann"
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  error={errors.lastName}
                  className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-11"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
                  Bedriftsnavn
                </label>
                <Input
                  type="text"
                  value={values.companyName}
                  placeholder="f.eks. Acme Corp"
                  onChange={(e) => handleChange("companyName", e.target.value)}
                  error={errors.companyName}
                  className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
                  Organisasjonsnummer
                </label>
                <Input
                  type="text"
                  value={values.orgNumber}
                  placeholder="9 siffer (f.eks. 123456789)"
                  onChange={(e) => handleChange("orgNumber", e.target.value)}
                  error={errors.orgNumber}
                  className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-11"
                />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
              E-postadresse
            </label>
            <Input
              type="email"
              value={values.email}
              placeholder="deg@eksempel.no"
              onChange={(e) => handleChange("email", e.target.value)}
              error={errors.email}
              className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-11"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-custom-text uppercase tracking-wider">
              Passord
            </label>
            <Input
              type={showPassword ? "text" : "password"}
              value={values.password}
              placeholder="••••••••"
              onChange={(e) => handleChange("password", e.target.value)}
              error={errors.password}
              className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-11"
              rightIcon={
                <button
                  type="button"
                  className="text-gray-400 hover:text-black transition-colors"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-custom-text uppercase tracking-wider">
              Bekreft passord
            </label>
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={values.confirmPassword}
              placeholder="••••••••"
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              error={errors.confirmPassword}
              className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-11"
              rightIcon={
                <button
                  type="button"
                  className="text-custom-text hover:text-black transition-colors"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              }
            />
          </div>

          {/* Register Button */}
          <Button
            type="submit"
            loading={isRegistering}
            className="py-3 font-bold rounded-lg"
            label="Opprett konto"
          />

          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-gray-200"></div>
            <span className="shrink mx-4 text-gray-400 text-sm font-normal">
              eller
            </span>
            <div className="grow border-t border-gray-200"></div>
          </div>

          <div>
            <SocialAuthButtons />
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-custom-text">
            Har du allerede en konto?{" "}
            <button
              onClick={() => navigate("/login")}
              className="font-bold text-black hover:underline"
            >
              Logg inn
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
