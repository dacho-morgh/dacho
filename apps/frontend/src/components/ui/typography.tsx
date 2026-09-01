import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/utilities/ui"

/**
 * Sandoq Design System Typography Variants (Figma node 8:348)
 * Font: Yekan Bakh FaNum
 *
 * Scales:
 * - 48: 48px / 74px (Black, Bold, Regular)
 * - 40: 40px / 60px (ExtraBold, Bold, Regular)
 * - 32: 32px / 48px (ExtraBold, Bold, Regular)
 * - 24: 24px / 36px (ExtraBold, Bold, Regular)
 * - 20: 20px / 32px (ExtraBold, Bold, Regular)
 * - 16: 16px / 28px (SemiBold, Regular, Light)
 * - 14: 14px / 24px (SemiBold, Regular, Light)
 * - 12: 12px / 20px (SemiBold, Regular, Light)
 * - 10: 10px / 14px (Light)
 */
const typographyVariants = cva("font-sans antialiased text-foreground", {
  variants: {
    variant: {
      // 48px scale
      "48/black": "text-[48px] leading-[74px] font-[875]",
      "48/bold": "text-[48px] leading-[74px] font-[600]",
      "48/regular": "text-[48px] leading-[74px] font-[325]",
      "display-48": "text-[48px] leading-[74px] font-[600]",

      // 40px scale (H1)
      "40/extrabold": "text-[40px] leading-[64px] font-[725]",
      "40/bold": "text-[40px] leading-[64px] font-[600]",
      "40/regular": "text-[40px] leading-[64px] font-[325]",
      h1: "text-[40px] leading-[64px] font-[600]",

      // 32px scale (H2)
      "32/extrabold": "text-[32px] leading-[50px] font-[725]",
      "32/bold": "text-[32px] leading-[50px] font-[600]",
      "32/regular": "text-[32px] leading-[50px] font-[325]",
      h2: "text-[32px] leading-[50px] font-[600]",

      // 24px scale (H3)
      "24/extrabold": "text-[24px] leading-[36px] font-[725]",
      "24/bold": "text-[24px] leading-[36px] font-[600]",
      "24/regular": "text-[24px] leading-[36px] font-[325]",
      h3: "text-[24px] leading-[36px] font-[600]",

      // 20px scale (H4 / Title)
      "20/extrabold": "text-[20px] leading-[32px] font-[725]",
      "20/bold": "text-[20px] leading-[32px] font-[600]",
      "20/regular": "text-[20px] leading-[32px] font-[325]",
      h4: "text-[20px] leading-[32px] font-[600]",
      title: "text-[20px] leading-[32px] font-[450]",

      // 16px scale (Body Large)
      "16/semibold": "text-[16px] leading-[28px] font-[450]",
      "16/regular": "text-[16px] leading-[28px] font-[325]",
      "16/light": "text-[16px] leading-[28px] font-[150]",
      "body-lg": "text-[16px] leading-[28px] font-[325]",
      "body-16": "text-[16px] leading-[28px] font-[325]",

      // 14px scale (Body Medium / Default Body)
      "14/semibold": "text-[14px] leading-[24px] font-[450]",
      "14/regular": "text-[14px] leading-[24px] font-[325]",
      "14/light": "text-[14px] leading-[24px] font-[150]",
      body: "text-[14px] leading-[24px] font-[325]",
      "body-md": "text-[14px] leading-[24px] font-[325]",
      "body-14": "text-[14px] leading-[24px] font-[325]",

      // 12px scale (Body Small / Caption)
      "12/semibold": "text-[12px] leading-[20px] font-semibold",
      "12/regular": "text-[12px] leading-[20px] font-normal",
      "12/light": "text-[12px] leading-[20px] font-light",
      caption: "text-[12px] leading-[20px] font-normal",
      "body-sm": "text-[12px] leading-[20px] font-normal",
      "body-12": "text-[12px] leading-[20px] font-normal",

      // 10px scale (Micro / Caption XS)
      "10/light": "text-[10px] leading-[14px] font-light",
      "caption-xs": "text-[10px] leading-[14px] font-light",
    },
    weight: {
      light: "font-[150]",
      normal: "font-[325]",
      regular: "font-[325]",
      medium: "font-medium",
      semibold: "font-[450]",
      bold: "font-[600]",
      extrabold: "font-[725]",
      black: "font-[875]",
    },
    color: {
      default: "text-foreground",
      primary: "text-brand-500",
      brand: "text-brand-500",
      "brand-600": "text-brand-600",
      "brand-700": "text-brand-700",
      "brand-900": "text-brand-900",
      white: "text-white",
      muted: "text-neutral-500",
      secondary: "text-neutral-600",
      "neutral-900": "text-neutral-900",
      "neutral-800": "text-neutral-800",
      "neutral-700": "text-neutral-700",
      "neutral-600": "text-neutral-600",
      "neutral-500": "text-neutral-500",
      "neutral-400": "text-neutral-400",
      "neutral-300": "text-neutral-300",
      success: "text-success-700",
      error: "text-error-500",
      warning: "text-warning-500",
    },
  },
  defaultVariants: {
    variant: "body",
    color: "default",
  },
})

type TypographyVariant = NonNullable<VariantProps<typeof typographyVariants>["variant"]>

const variantAliases: Partial<Record<TypographyVariant, `${number}/${string}`>> = {
  "display-48": "48/bold",
  h1: "40/bold",
  h2: "32/bold",
  h3: "24/bold",
  h4: "20/bold",
  title: "20/semibold",
  "body-lg": "16/regular",
  "body-16": "16/regular",
  body: "14/regular",
  "body-md": "14/regular",
  "body-14": "14/regular",
  caption: "12/regular",
  "body-sm": "12/regular",
  "body-12": "12/regular",
  "caption-xs": "10/light",
}

const lineHeights: Record<string, string> = {
  "48": "74px",
  "40": "64px",
  "32": "50px",
  "24": "36px",
  "20": "32px",
  "16": "28px",
  "14": "24px",
  "12": "20px",
  "10": "14px",
}

const fontWeights: Record<string, number> = {
  light: 150,
  regular: 325,
  semibold: 450,
  bold: 600,
  extrabold: 725,
  black: 875,
}

function responsiveVariantVariables(breakpoint: "sm" | "md" | "lg", variant?: TypographyVariant) {
  if (!variant) return {}

  const [size, weight] = (variantAliases[variant] || variant).split("/")

  return {
    [`--typography-${breakpoint}-size`]: `${size}px`,
    [`--typography-${breakpoint}-leading`]: lineHeights[size],
    [`--typography-${breakpoint}-weight`]: fontWeights[weight],
  }
}

type VariantElementMap = Record<string, React.ElementType>

const defaultElementMap: VariantElementMap = {
  "48/black": "h1",
  "48/bold": "h1",
  "48/regular": "h1",
  "display-48": "h1",
  "40/extrabold": "h1",
  "40/bold": "h1",
  "40/regular": "h1",
  h1: "h1",
  "32/extrabold": "h2",
  "32/bold": "h2",
  "32/regular": "h2",
  h2: "h2",
  "24/extrabold": "h3",
  "24/bold": "h3",
  "24/regular": "h3",
  h3: "h3",
  "20/extrabold": "h4",
  "20/bold": "h4",
  "20/regular": "h4",
  h4: "h4",
  title: "h4",
  "16/semibold": "p",
  "16/regular": "p",
  "16/light": "p",
  "body-lg": "p",
  "body-16": "p",
  "14/semibold": "p",
  "14/regular": "p",
  "14/light": "p",
  body: "p",
  "body-md": "p",
  "body-14": "p",
  "12/semibold": "span",
  "12/regular": "span",
  "12/light": "span",
  caption: "span",
  "body-sm": "span",
  "body-12": "span",
  "10/light": "span",
  "caption-xs": "span",
}

export type TypographyProps<T extends React.ElementType = "p"> = {
  as?: T
  asChild?: boolean
  sm?: TypographyVariant
  md?: TypographyVariant
  lg?: TypographyVariant
  className?: string
  children?: React.ReactNode
} & VariantProps<typeof typographyVariants> &
  Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children" | "color">

function Typography<T extends React.ElementType = "p">({
  as,
  asChild = false,
  variant = "body",
  sm,
  md,
  lg,
  weight,
  color,
  className,
  children,
  style,
  ...props
}: TypographyProps<T>) {
  const Component = asChild ? Slot.Root : as || (variant ? defaultElementMap[variant] : "p") || "p"

  return (
    <Component
      data-slot="typography"
      data-variant={variant}
      className={cn(
        typographyVariants({ variant, weight, color }),
        sm &&
          "sm:text-[length:var(--typography-sm-size)] sm:leading-[var(--typography-sm-leading)] sm:font-[var(--typography-sm-weight)]",
        md &&
          "md:text-[length:var(--typography-md-size)] md:leading-[var(--typography-md-leading)] md:font-[var(--typography-md-weight)]",
        lg &&
          "lg:text-[length:var(--typography-lg-size)] lg:leading-[var(--typography-lg-leading)] lg:font-[var(--typography-lg-weight)]",
        className,
      )}
      style={{
        ...responsiveVariantVariables("sm", sm),
        ...responsiveVariantVariables("md", md),
        ...responsiveVariantVariables("lg", lg),
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  )
}

// Subcomponents for ergonomic JSX
Typography.Display = function TypographyDisplay(props: Omit<TypographyProps<"h1">, "variant">) {
  return <Typography as="h1" variant="display-48" {...props} />
}

Typography.H1 = function TypographyH1(props: Omit<TypographyProps<"h1">, "variant">) {
  return <Typography as="h1" variant="h1" {...props} />
}

Typography.H2 = function TypographyH2(props: Omit<TypographyProps<"h2">, "variant">) {
  return <Typography as="h2" variant="h2" {...props} />
}

Typography.H3 = function TypographyH3(props: Omit<TypographyProps<"h3">, "variant">) {
  return <Typography as="h3" variant="h3" {...props} />
}

Typography.H4 = function TypographyH4(props: Omit<TypographyProps<"h4">, "variant">) {
  return <Typography as="h4" variant="h4" {...props} />
}

Typography.Body = function TypographyBody(props: Omit<TypographyProps<"p">, "variant">) {
  return <Typography as="p" variant="body" {...props} />
}

Typography.Caption = function TypographyCaption(props: Omit<TypographyProps<"span">, "variant">) {
  return <Typography as="span" variant="caption" {...props} />
}

export { Typography, typographyVariants }
