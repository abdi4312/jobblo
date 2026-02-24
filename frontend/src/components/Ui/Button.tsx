import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface ButtonProps {
  label?: string;
  onClick?: () => void;
  to?: string; // internal route
  href?: string; // external link
  icon?: ReactNode; // react icon / svg
  iconImage?: string; // image path
  iconPosition?: "left" | "right";
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

export const Button = ({
  label,
  onClick,
  to,
  href,
  icon,
  iconImage,
  iconPosition = "left",
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
}: ButtonProps) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 transition-all font-medium cursor-pointer";

  const variants = {
    primary:
      "bg-[#E08835] text-white hover:bg-[#E08835] text-[16px] font-semibold ",
    secondary: "bg-gray-200 text-black hover:bg-gray-300",
    outline: "border border-black text-black hover:bg-black hover:text-white",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-[15px]",
    lg: "px-6 py-3 text-base rounded-[10px]",
  };

  const content = (
    <>
      {iconPosition === "left" && icon}
      {iconImage && (
        <img src={iconImage} alt="icon" className="w-4 h-4 object-contain" />
      )}
      {label && <span>{label}</span>}
      {iconPosition === "right" && icon}
    </>
  );

  const classes = `
    ${baseStyles}
    ${variants[variant]}
    ${sizes[size]}
    ${disabled ? "opacity-50 pointer-events-none" : ""}
    ${className}
  `;

  // 👉 Internal link
  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  // 👉 External link
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {content}
      </a>
    );
  }

  // 👉 Normal button
  return (
    <button onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  );
};
