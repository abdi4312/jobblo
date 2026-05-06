import React from "react";
import { Button as ShadcnButton, buttonVariants } from "../Button";
import { cn } from "@/lib/utils";
import { type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  label?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      label,
      loading = false,
      icon,
      iconPosition = "left",
      children,
      disabled,
      asChild,
      ...props
    },
    ref,
  ) => {
    return (
      <ShadcnButton
        className={cn(className)}
        variant={variant}
        size={size}
        disabled={disabled || loading}
        ref={ref}
        asChild={asChild}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}

        {!loading && icon && iconPosition === "left" && (
          <span className="mr-2">{icon}</span>
        )}

        {label ?? children}

        {!loading && icon && iconPosition === "right" && (
          <span className="ml-2">{icon}</span>
        )}
      </ShadcnButton>
    );
  },
);

Button.displayName = "Button";

export { Button };