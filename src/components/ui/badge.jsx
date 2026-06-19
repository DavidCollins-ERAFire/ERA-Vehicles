import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-burgundy-700 text-white",
        gold: "border-transparent bg-gold-300 text-burgundy-900",
        outline: "border-burgundy-200 text-burgundy-800",
        pending: "border-transparent bg-amber-100 text-amber-800",
        scheduled: "border-transparent bg-blue-100 text-blue-800",
        complete: "border-transparent bg-green-100 text-green-800",
        cancelled: "border-transparent bg-gray-200 text-gray-700",
        danger: "border-transparent bg-red-100 text-red-800",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
