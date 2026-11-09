'use client'

import Image from 'next/image'
import { useId, useState, type ReactNode } from 'react'

import { CalendarBulkIcon, ChevronUpIcon, DocumentTextIcon, LocationBulkIcon, TickCircleIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

export interface RequestEventFact {
  icon: 'calendar' | 'location' | 'document'
  text: string
}

export interface RequestWorkflowStep {
  title: string
  roleName?: string
  order: number
  /** The server's state of this step (#288); without it the step is placed by `currentStep`. */
  state?: 'done' | 'current' | 'upcoming' | 'rejected'
}

type BadgeVariant = 'gray' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'

const FACT_ICONS = {
  calendar: CalendarBulkIcon,
  location: LocationBulkIcon,
  document: DocumentTextIcon,
} as const

type StepState = 'done' | 'current' | 'next' | 'rejected'

const fa = (value: number) => value.toLocaleString('fa-IR')

/**
 * The application card of the company and admin pages (Figma 49:7968 and 30849:13269):
 * the event's picture on the reading side, the status tag, the application's title and its
 * facts (held dates, place, tracking code) with the page's main action opposite, then the
 * collapsible «وضعیت درخواست» stepper that walks the service's workflow. Without an event
 * picture the facts still stand; the picture is never replaced by a placeholder.
 */
export function RequestEventCard({
  title,
  titleAsHeading = true,
  statusLabel,
  statusVariant,
  facts,
  image,
  action,
  workflow,
  currentStep,
}: {
  title: string
  /** False when the page's own heading already says the title, so the page has one heading for it. */
  titleAsHeading?: boolean
  statusLabel: string
  statusVariant: BadgeVariant
  facts: RequestEventFact[]
  /** The event's poster; null when the CMS has none or did not answer. */
  image?: { url: string; alt: string | null } | null
  action?: ReactNode
  workflow: RequestWorkflowStep[]
  currentStep: string | null | undefined
}) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()

  return (
    <section
      aria-label="درخواست"
      data-testid="request-event-card"
      className="flex min-w-0 flex-col gap-5 rounded-2xl border border-neutral-200 bg-background p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row">
          {image ? (
            <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:size-[200px]">
              <Image
                src={image.url}
                alt={image.alt || title}
                fill
                // The poster is a CMS file on a host the image optimizer is not configured for.
                unoptimized
                sizes="200px"
                className="object-cover"
              />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <Badge variant={statusVariant} size="md">
                <Typography as="span" variant="14/regular" className="text-inherit">
                  {statusLabel}
                </Typography>
              </Badge>
              <Typography as={titleAsHeading ? 'h2' : 'p'} variant="20/bold" sm="24/bold" color="neutral-800" className="break-words">
                {title}
              </Typography>
            </div>
            {facts.length ? (
              <ul className="flex min-w-0 flex-col gap-2">
                {facts.map((fact) => {
                  const Icon = FACT_ICONS[fact.icon]
                  return (
                    <li key={`${fact.icon}-${fact.text}`} className="flex min-w-0 items-center gap-2">
                      <Icon className="size-6 shrink-0 text-neutral-400" aria-hidden="true" />
                      <Typography as="span" variant="14/regular" sm="16/regular" color="neutral-700" className="break-words">
                        {fact.text}
                      </Typography>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>

      <div className="h-px bg-neutral-100" aria-hidden="true" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Typography as="h3" variant="16/bold" sm="20/bold" color="neutral-800">
            وضعیت درخواست
          </Typography>
          <Button
            type="button"
            variant="text-gray"
            size="icon-32"
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={open ? 'بستن وضعیت درخواست' : 'باز کردن وضعیت درخواست'}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronUpIcon className={cn('size-6', !open && 'rotate-180')} aria-hidden="true" />
          </Button>
        </div>
        <div id={bodyId} hidden={!open}>
          <RequestWorkflowStepper workflow={workflow} currentStep={currentStep} />
        </div>
      </div>
    </section>
  )
}

/**
 * The service's workflow as the design's vertical stepper: a green tick for the steps
 * behind the case, the numbered brand dot for the current one, grey dots after it and a red
 * dot for the step that rejected it. The server's `state` of each step decides; only a workflow
 * without states (a CMS-defined one) is placed by the case's current step title.
 */
export function RequestWorkflowStepper({
  workflow,
  currentStep,
}: {
  workflow: RequestWorkflowStep[]
  currentStep: string | null | undefined
}) {
  const currentIndex = workflow.findIndex((step) => step.title === currentStep)
  const stateOf = (step: RequestWorkflowStep, index: number): StepState => {
    if (step.state) return step.state === 'upcoming' ? 'next' : step.state
    return index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'next'
  }
  if (!workflow.length) {
    return (
      <Typography variant="14/regular" color="neutral-500">
        روندی برای این خدمت ثبت نشده است.
      </Typography>
    )
  }
  return (
    <ol className="flex flex-col">
      {workflow.map((step, index) => {
        const state = stateOf(step, index)
        const last = index === workflow.length - 1
        return (
          <li
            key={`${step.order}-${step.title}`}
            className="flex gap-4"
            aria-current={state === 'current' || state === 'rejected' ? 'step' : undefined}
            data-step-state={state}
          >
            <div className="flex flex-col items-center">
              {state === 'done' ? (
                <TickCircleIcon className="size-6 shrink-0 text-success-500" aria-hidden="true" />
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full',
                    state === 'current' && 'bg-brand-500 text-white',
                    state === 'rejected' && 'bg-error-500 text-white',
                    state === 'next' && 'bg-neutral-100 text-neutral-500',
                  )}
                >
                  <Typography as="span" variant="12/semibold" className="text-inherit">
                    {fa(step.order)}
                  </Typography>
                </span>
              )}
              {last ? null : (
                <span
                  aria-hidden="true"
                  className={cn(
                    'min-h-8 w-px flex-1',
                    state === 'done' ? 'bg-success-500' : state === 'current' ? 'bg-brand-500' : state === 'rejected' ? 'bg-error-500' : 'bg-neutral-200',
                  )}
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pb-6">
              <Typography
                as="span"
                variant="14/semibold"
                sm="16/semibold"
                color={state === 'next' ? 'neutral-500' : 'neutral-800'}
                className="break-words"
              >
                {step.title}
              </Typography>
              {state === 'rejected' ? (
                <Typography as="span" variant="12/regular" sm="14/regular" color="error">
                  درخواست در این مرحله رد شد
                </Typography>
              ) : null}
              {step.roleName ? (
                <Typography as="span" variant="12/regular" sm="14/regular" color="neutral-500" className="break-words">
                  {step.roleName}
                </Typography>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
