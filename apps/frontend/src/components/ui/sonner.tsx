'use client'

import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { DashboardCloseCircle, TickCircleIcon } from '@/components/icons'
import { typographyVariants } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

/**
 * The one toast host (FE43). Mounted once in the dashboard layout; call
 * `toast.success(...)` / `toast.error(...)` from `sonner` after a submit,
 * save or decision. Sonner announces toasts in a polite live region.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      dir="rtl"
      position="bottom-left"
      closeButton
      icons={{
        success: <TickCircleIcon aria-hidden="true" className="size-5 text-success-500" />,
        error: <DashboardCloseCircle aria-hidden="true" className="size-5 text-error-500" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: cn(
            'flex w-full items-start gap-3 rounded-xl border border-neutral-200 bg-background p-4 text-right shadow-lg sm:w-[360px]',
            'data-[type=error]:border-error-100 data-[type=success]:border-success-500/30',
          ),
          title: typographyVariants({ variant: '14/semibold', color: 'neutral-800' }),
          description: typographyVariants({ variant: '12/regular', color: 'neutral-500' }),
          closeButton: 'order-last text-neutral-400 hover:text-neutral-600',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
