import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive border-destructive/20",
        outline: "text-foreground border-border",
        success: "border-transparent bg-success/10 text-success-700 border-success/20",
        warning: "border-transparent bg-warning/10 text-warning-700 border-warning/20",
        accent: "border-transparent bg-accent text-accent-foreground",
        income: "bg-success/10 text-success-700 border border-success/20",
        expense: "bg-destructive/10 text-destructive border border-destructive/20",
        transfer: "bg-primary/10 text-primary border border-primary/20",
        "credit-charge": "bg-warning/10 text-warning-700 border border-warning/20",
        "credit-payment": "bg-accent text-primary border border-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
