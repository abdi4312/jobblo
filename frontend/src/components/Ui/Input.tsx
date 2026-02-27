import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  rightIcon?: ReactNode; // Naya prop password toggle ke liye
  iconPosition?: "left" | "right";
  error?: string;
  containerClassName?: string;
}

export const Input = ({
  label,
  icon,
  rightIcon, // Destructure naya prop
  iconPosition = "left",
  error,
  className = "",
  containerClassName = "",
  ...props
}: InputProps) => {
  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label className="block mb-1 text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Left Icon logic - logic remains same */}
        {icon && iconPosition === "left" && (
          <span className="absolute left-3 flex items-center text-[#0A0A0A1A]">
            {icon}
          </span>
        )}

        <input
          {...props}
          className={`
            w-full h-full max-h-10.75 rounded-[14px] border px-4 py-3 bg-white outline-none text-base font-light
            focus:outline-none
            ${icon && iconPosition === "left" ? "pl-10" : ""}
            ${(icon && iconPosition === "right") || rightIcon ? "pr-10" : ""}
            ${error ? "border-red-500 focus:ring-red-500" : "border-gray-300"}
            ${className}
          `}
        />

        {/* Original Right Icon logic */}
        {icon && iconPosition === "right" && (
          <span className="absolute right-3 flex items-center text-[#0A0A0A1A]">
            {icon}
          </span>
        )}

        {/* Naya Right Icon (Password Toggle) logic */}
        {rightIcon && (
          <span className="absolute right-3 flex items-center">
            {rightIcon}
          </span>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};