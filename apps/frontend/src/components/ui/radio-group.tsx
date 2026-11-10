"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { Check } from "lucide-react"

import { cn } from "@/utilities/ui"

function RadioGroup({ className, dir = "rtl", ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      dir={dir}
      className={cn("grid w-full gap-2", className)}
      {...props}
    />
  )
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "relative flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-neutral-200 bg-background text-white outline-none transition-colors hover:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 aria-invalid:border-error-500 data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" className="flex items-center justify-center">
        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
