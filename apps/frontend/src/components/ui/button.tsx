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

type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

const buttonSizeAliases: Partial<Record<ButtonSize, ButtonSize>> = {
  default: "40",
  xs: "32",
  sm: "32",
  md: "36",
  lg: "40",
  xl: "48",
  icon: "icon-40",
  "icon-xs": "icon-32",
  "icon-sm": "icon-32",
  "icon-md": "icon-36",
  "icon-lg": "icon-40",
  "icon-xl": "icon-48",
}

const buttonSizeValues = {
  "32": ["32px", "6px", "8px", "14px", "24px", 400, "10px", "8px", "20px"],
  "36": ["36px", "8px", "8px", "16px", "28px", 400, "10px", "8px", "24px"],
  "40": ["40px", "8px", "8px", "16px", "28px", 600, "10px", "8px", "24px"],
  "48": ["48px", "12px", "8px", "20px", "32px", 400, "12px", "8px", "26px"],
  "icon-32": ["32px", "0px", "0px", "14px", "24px", 400, "10px", "0px", "20px"],
  "icon-36": ["36px", "0px", "0px", "16px", "28px", 400, "10px", "0px", "24px"],
  "icon-40": ["40px", "0px", "0px", "16px", "28px", 600, "10px", "0px", "24px"],
  "icon-48": ["48px", "0px", "0px", "20px", "32px", 400, "12px", "0px", "26px"],
} as const

function responsiveSizeVariables(breakpoint: "sm" | "md" | "lg", size?: ButtonSize) {
  if (!size || size === "clear") return {}

  const resolvedSize = buttonSizeAliases[size] || size
  const [height, paddingX, paddingY, fontSize, lineHeight, fontWeight, radius, gap, iconSize] =
    buttonSizeValues[resolvedSize as keyof typeof buttonSizeValues]

  return {
    [`--button-${breakpoint}-height`]: height,
    [`--button-${breakpoint}-px`]: paddingX,
    [`--button-${breakpoint}-py`]: paddingY,
    [`--button-${breakpoint}-font-size`]: fontSize,
    [`--button-${breakpoint}-line-height`]: lineHeight,
    [`--button-${breakpoint}-font-weight`]: fontWeight,
    [`--button-${breakpoint}-radius`]: radius,
    [`--button-${breakpoint}-gap`]: gap,
    [`--button-${breakpoint}-icon-size`]: iconSize,
  }
}

function isIconSize(size?: ButtonSize) {
  return size ? (buttonSizeAliases[size] || size).startsWith("icon-") : false
}

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    icon?: React.ReactNode
    sm?: ButtonSize
    md?: ButtonSize
    lg?: ButtonSize
  }

function Button({
  className,
  variant = "default",
  size = "default",
  sm,
  md,
  lg,
  asChild = false,
  loading = false,
  disabled,
  children,
  icon,
  style,
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
      className={cn(
        buttonVariants({ variant, size }),
        sm &&
          "sm:h-[var(--button-sm-height)] sm:px-[var(--button-sm-px)] sm:py-[var(--button-sm-py)] sm:text-[length:var(--button-sm-font-size)] sm:leading-[var(--button-sm-line-height)] sm:font-[var(--button-sm-font-weight)] sm:rounded-[var(--button-sm-radius)] sm:gap-[var(--button-sm-gap)] sm:[&_svg:not([class*='size-'])]:size-[var(--button-sm-icon-size)]",
        md &&
          "md:h-[var(--button-md-height)] md:px-[var(--button-md-px)] md:py-[var(--button-md-py)] md:text-[length:var(--button-md-font-size)] md:leading-[var(--button-md-line-height)] md:font-[var(--button-md-font-weight)] md:rounded-[var(--button-md-radius)] md:gap-[var(--button-md-gap)] md:[&_svg:not([class*='size-'])]:size-[var(--button-md-icon-size)]",
        lg &&
          "lg:h-[var(--button-lg-height)] lg:px-[var(--button-lg-px)] lg:py-[var(--button-lg-py)] lg:text-[length:var(--button-lg-font-size)] lg:leading-[var(--button-lg-line-height)] lg:font-[var(--button-lg-font-weight)] lg:rounded-[var(--button-lg-radius)] lg:gap-[var(--button-lg-gap)] lg:[&_svg:not([class*='size-'])]:size-[var(--button-lg-icon-size)]",
        isIconSize(sm) && "sm:w-[var(--button-sm-height)]",
        sm && !isIconSize(sm) && "sm:w-auto",
        isIconSize(md) && "md:w-[var(--button-md-height)]",
        md && !isIconSize(md) && "md:w-auto",
        isIconSize(lg) && "lg:w-[var(--button-lg-height)]",
        lg && !isIconSize(lg) && "lg:w-auto",
        sm === "clear" && "sm:h-auto sm:p-0 sm:rounded-none sm:border-0",
        md === "clear" && "md:h-auto md:p-0 md:rounded-none md:border-0",
        lg === "clear" && "lg:h-auto lg:p-0 lg:rounded-none lg:border-0",
        className,
      )}
      style={{
        ...responsiveSizeVariables("sm", sm),
        ...responsiveSizeVariables("md", md),
        ...responsiveSizeVariables("lg", lg),
        ...style,
      }}
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
