import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium", {
  variants: {
    variant: {
      primary: "border-primary bg-primary-soft text-primary",
      success: "border-success bg-success-soft text-success",
      warning: "border-warning bg-white text-warning",
      danger: "border-danger bg-white text-danger",
      muted: "border-border bg-secondary text-muted-foreground"
    }
  },
  defaultVariants: {
    variant: "muted"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
));

Badge.displayName = "Badge";
