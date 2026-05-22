import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("oe-button", {
  variants: {
    variant: {
      default: "oe-button--default",
      primary: "oe-button--primary",
      blue: "oe-button--blue",
      green: "oe-button--green",
      violet: "oe-button--violet",
      gold: "oe-button--gold",
      danger: "oe-button--danger",
      ghost: "oe-button--ghost"
    },
    size: {
      sm: "oe-button--sm",
      md: "oe-button--md",
      icon: "oe-button--icon"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "md"
  }
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
