import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/utilities/ui"

/**
 * Sandoq Design System Tag / Badge Variants (Figma node 32:9836)
 *
 * Sizes: Small (20px / h-5) | Medium (24px / h-6) | Large (32px / h-8)
 * Colors: Gray | White | Primary (Blue) | Green (Success) | Red (Error) | Yellow (Warning) | Secondary (Amber) | Black
 * Radius: 40px (rounded-full)
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center font-sans font-normal whitespace-nowrap rounded-full transition-colors select-none [&>svg]:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        // Figma Tag Colors
        default: "bg-neutral-100 text-neutral-600 ",
        gray: "bg-neutral-100 text-neutral-600",
        primary: "bg-[#eef2ff] text-[#2563eb] ",
        blue: "bg-[#eef2ff] text-[#2563eb]",
        green: "bg-success-50 text-success-500 ",
        success: "bg-success-50 text-success-500 ",
        red: "bg-error-50 text-[#dc2626]",
        error: "bg-error-50 text-[#dc2626]",
        destructive: "bg-error-50 text-[#dc2626]",
        yellow: "bg-warning-50 text-warning-500 ",
        warning: "bg-warning-50 text-warning-500",
        secondary: "bg-[#fef0cd] text-[#c18404] ",
        amber: "bg-[#fef0cd] text-[#c18404]",
        white: "bg-white text-neutral-600 border-neutral-200 shadow-2xs",
        black: "bg-neutral-800 text-neutral-50",

        // Outlines for compatibility
        outline: " bg-transparent text-neutral-600",
        "outline-primary": " bg-transparent text-brand-500",
        "outline-green": " bg-transparent text-success-500",
        "outline-red": " bg-transparent text-error-500",
        ghost: "bg-transparent text-neutral-600 hover:bg-neutral-100",
        link: "bg-transparent text-brand-500 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        // Figma standard sizes
        sm: "h-5 px-2 py-1 text-xs leading-5 gap-2 [&>svg]:size-3.5",
        small: "h-5 px-2 py-1 text-xs leading-5 gap-2 [&>svg]:size-3.5",
        md: "h-6 px-3 py-1 text-sm leading-6 gap-2 [&>svg]:size-4",
        medium: "h-6 px-3 py-1 text-sm leading-6 gap-2 [&>svg]:size-4",
        default: "h-6 px-3 py-1 text-sm leading-6 gap-2 [&>svg]:size-4",
        lg: "h-8 px-4 py-1 text-base leading-7 gap-2 [&>svg]:size-5",
        large: "h-8 px-4 py-1 text-base leading-7 gap-2 [&>svg]:size-5",
        larg: "h-8 px-4 py-1 text-base leading-7 gap-2 [&>svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "gray",
      size: "default",
    },
  }
)

export type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    icon?: React.ReactNode
    dot?: boolean
  }

function Badge({
  className,
  variant = "gray",
  size = "default",
  asChild = false,
  icon,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            variant === "primary" || variant === "blue"
              ? "bg-[#2563eb]"
              : variant === "green" || variant === "success"
                ? "bg-success-500"
                : variant === "red" || variant === "error" || variant === "destructive"
                  ? "bg-[#dc2626]"
                  : variant === "yellow" || variant === "warning" || variant === "secondary" || variant === "amber"
                    ? "bg-warning-500"
                    : variant === "black"
                      ? "bg-white"
                      : "bg-neutral-500"
          )}
        />
      )}
      {icon}
      {children}
    </Comp>
  )
}

const Tag = Badge

export { Badge, Tag, badgeVariants }
