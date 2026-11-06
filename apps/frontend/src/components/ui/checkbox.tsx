'use client'

import { cn } from '@/utilities/ui'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import * as React from 'react'

const Checkbox: React.FC<React.ComponentProps<typeof CheckboxPrimitive.Root>> = ({
  className,
  ...props
}) => (
  <CheckboxPrimitive.Root
    data-slot="checkbox"
    className={cn(
      'peer flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md border border-neutral-300 bg-background text-white outline-none transition-colors hover:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 aria-invalid:border-error-500 data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      data-slot="checkbox-indicator"
      className="flex items-center justify-center text-current"
    >
      <Check className="size-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
)

export { Checkbox }
