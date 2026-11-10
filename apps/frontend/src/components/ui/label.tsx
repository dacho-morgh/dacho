'use client'

import { RequiredMark } from '@/components/ui/field'
import { cn } from '@/utilities/ui'
import * as LabelPrimitive from '@radix-ui/react-label'
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
)

const Label: React.FC<
  { ref?: React.Ref<HTMLLabelElement> } & React.ComponentProps<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants> & { required?: boolean }
> = ({ className, ref, required, children, ...props }) => (
  <LabelPrimitive.Root className={cn(labelVariants(), className)} ref={ref} {...props}>
    {children}
    {required ? <RequiredMark className="ms-0.5" /> : null}
  </LabelPrimitive.Root>
)

export { Label }
