import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  isSubmitting?: boolean;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ children, isSubmitting = false, fullWidth = true, className = "", ...props }) => {
  return (
    <button
      {...props}
      disabled={isSubmitting || props.disabled}
      className={`
        ${fullWidth ? "w-full" : "w-auto"} 
        bg-[#2d4a3e] text-white py-4 items-center justify-center rounded-2xl font-bold text-sm 
        shadow-lg hover:shadow-xl transition-all active:scale-95 
        disabled:opacity-50 mt-4 
        ${className}
      `}
    >
      {isSubmitting ? "Creating..." : children}
    </button>
  );
};

export default Button;
