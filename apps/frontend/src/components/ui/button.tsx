import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { Loader2 } from "lucide-react"

import { cn } from "@/utilities/ui"

/**
 * Button variants matching Sandoq Design System (Figma node 5:2085)
 *
 * Styles: Fill | Outline | Text
 * Colors: Primary (#3B82F6) | Gray (#F5F5F5 / #525252) | White (#FFFFFF)
 * Sizes:  32 (h-8) | 36 (h-9) | 40 (h-10) | 48 (h-12)
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border font-sans whitespace-nowrap transition-colors outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:pointer-events-none disabled:cursor-not-allowed aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // --- FILL STYLES ---
        default:
          "border-transparent bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-neutral-200 disabled:text-neutral-300",
        primary:
          "border-transparent bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-neutral-200 disabled:text-neutral-300",
        gray:
          "border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-300 hover:text-neutral-700 active:bg-neutral-400 active:text-neutral-700 disabled:bg-neutral-100 disabled:text-neutral-300",
        secondary:
          "border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-300 hover:text-neutral-700 active:bg-neutral-400 active:text-neutral-700 disabled:bg-neutral-100 disabled:text-neutral-300",
        white:
          "border-transparent bg-white text-neutral-700 hover:bg-neutral-100 hover:border-white active:bg-neutral-200 disabled:bg-white disabled:text-neutral-300",

        // --- OUTLINE STYLES ---
        outline:
          "border-brand-500 bg-transparent text-brand-500 hover:bg-white hover:border-brand-600 hover:text-brand-600 active:border-brand-700 active:text-brand-700 disabled:border-neutral-200 disabled:text-neutral-300 disabled:bg-transparent",
        "outline-primary":
          "border-brand-500 bg-transparent text-brand-500 hover:bg-white hover:border-brand-600 hover:text-brand-600 active:border-brand-700 active:text-brand-700 disabled:border-neutral-200 disabled:text-neutral-300 disabled:bg-transparent",
        "outline-gray":
          "border-neutral-200 bg-transparent text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300 hover:text-neutral-600 active:bg-neutral-200 active:border-neutral-400 active:text-neutral-600 disabled:border-neutral-200 disabled:text-neutral-300 disabled:bg-transparent",
        "outline-white":
          "border-white bg-transparent text-white hover:bg-white/10 active:bg-white/20 disabled:border-white/40 disabled:text-white/40 disabled:bg-transparent",

        // --- TEXT / GHOST STYLES ---
        ghost:
          "border-transparent bg-transparent text-brand-500 hover:bg-white hover:text-brand-600 active:text-brand-700 disabled:text-neutral-300 disabled:bg-transparent",
        text:
          "border-transparent bg-transparent text-brand-500 hover:bg-white hover:text-brand-600 active:text-brand-700 disabled:text-neutral-300 disabled:bg-transparent",
        "text-primary":
          "border-transparent bg-transparent text-brand-500 hover:bg-white hover:text-brand-600 active:text-brand-700 disabled:text-neutral-300 disabled:bg-transparent",
        "text-gray":
          "border-transparent bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-600 active:bg-neutral-200 active:text-neutral-600 disabled:text-neutral-300 disabled:bg-transparent",
        "text-white":
          "border-transparent bg-transparent text-white hover:bg-white/10 hover:text-white active:bg-white/20 active:text-white disabled:text-neutral-300 disabled:bg-transparent",

        // --- UTILITY STYLES ---
        destructive:
          "border-transparent bg-error-500 text-white hover:bg-error-700 active:bg-red-800 disabled:bg-neutral-200 disabled:text-neutral-300",
        link:
          "border-transparent bg-transparent text-brand-500 underline-offset-4 hover:underline disabled:text-neutral-300 p-0 h-auto",
      },
      size: {
        // Figma standard sizes
        "32": "h-8 px-1.5 py-2 text-sm leading-6 font-normal rounded-[10px] gap-2 [&_svg:not([class*='size-'])]:size-5",
        "36": "h-9 px-2 py-2 text-base leading-7 font-normal rounded-[10px] gap-2 [&_svg:not([class*='size-'])]:size-6",
        "40": "h-10 px-2 py-2 text-base leading-7 font-semibold rounded-[10px] gap-2 [&_svg:not([class*='size-'])]:size-6",
        "48": "h-12 px-3 py-2 text-xl leading-8 font-normal rounded-[12px] gap-2 [&_svg:not([class*='size-'])]:size-[26px]",

        // Aliases for compatibility
        default:
          "h-10 px-2 py-2 text-base leading-7 font-semibold rounded-[10px] gap-2 [&_svg:not([class*='size-'])]:size-6",
        xs: "h-7 px-1.5 py-1 text-xs leading-5 rounded-[8px] gap-1.5 [&_svg:not([class*='size-'])]:size-4",
        sm: "h-8 px-1.5 py-2 text-sm leading-6 font-normal rounded-[10px] gap-2 [&_svg:not([class*='size-'])]:size-5",
        md: "h-9 px-2 py-2 text-base leading-7 font-normal rounded-[10px] gap-2 [&_svg:not([class*='size-'])]:size-6",
        lg: "h-10 px-2 py-2 text-base leading-7 font-semibold rounded-[10px] gap-2 [&_svg:not([class*='size-'])]:size-6",
        xl: "h-12 px-3 py-2 text-xl leading-8 font-normal rounded-[12px] gap-2 [&_svg:not([class*='size-'])]:size-[26px]",

        // Icon button sizes
        icon: "size-10 p-0 rounded-[10px] [&_svg:not([class*='size-'])]:size-6",
        "icon-32": "size-8 p-0 rounded-[10px] [&_svg:not([class*='size-'])]:size-5",
        "icon-36": "size-9 p-0 rounded-[10px] [&_svg:not([class*='size-'])]:size-6",
        "icon-40": "size-10 p-0 rounded-[10px] [&_svg:not([class*='size-'])]:size-6",
        "icon-48": "size-12 p-0 rounded-[12px] [&_svg:not([class*='size-'])]:size-[26px]",
        "icon-xs": "size-7 p-0 rounded-[8px] [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-8 p-0 rounded-[10px] [&_svg:not([class*='size-'])]:size-5",
        "icon-md": "size-9 p-0 rounded-[10px] [&_svg:not([class*='size-'])]:size-6",
        "icon-lg": "size-10 p-0 rounded-[10px] [&_svg:not([class*='size-'])]:size-6",
        "icon-xl": "size-12 p-0 rounded-[12px] [&_svg:not([class*='size-'])]:size-[26px]",
        clear: "p-0 h-auto rounded-none border-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    icon?: React.ReactNode
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  icon,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  const isDisabled = disabled || loading

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "true" : undefined}
      disabled={isDisabled}
      aria-disabled={isDisabled ? true : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          {children}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
