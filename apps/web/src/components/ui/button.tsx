import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Bizmo düğmesi (DESIGN.md §10): 38px (sm 32 · lg 44), köşe 10, 14/600 Inter.
 * default = birincil (yeşil zemin, lacivert yazı, yeşil gölge — ekranda tek), outline = ikincil,
 * soft = yumuşak yeşil, secondary = sakin, ghost = zeminsiz, destructive = kalıcı silme (yalnız onay penceresinde).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-lg text-sm font-semibold transition-[background-color,box-shadow,transform,opacity,color] duration-100 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-green hover:bg-brand-strong",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        danger: "bg-danger-soft text-danger-ink hover:bg-danger/20",
        outline: "border border-input bg-card text-foreground hover:bg-accent",
        soft: "bg-brand-soft text-brand-ink hover:bg-brand/20",
        secondary: "bg-secondary text-secondary-foreground hover:bg-press",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "h-auto px-0 text-brand-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[38px] px-4",
        sm: "h-8 rounded-[9px] px-3 text-[13px]",
        lg: "h-11 rounded-xl px-5 text-[15px]",
        icon: "h-[38px] w-[38px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
