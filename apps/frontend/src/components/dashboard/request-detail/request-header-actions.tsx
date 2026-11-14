'use client'

import { useState } from 'react'

import { RowActions } from '@/components/dashboard/list-row-actions'
import { ReferRequestDialog } from '@/components/dashboard/refer-request-dialog'
import {
  RequestDecisionDialog,
  REVIEW_DECISION,
  TRIAGE,
  type Decision,
} from '@/components/dashboard/request-actions-panel'
import { BackSquareIcon, DashboardCloseCircle } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import type { RequestAction } from '@/utilities/dashboard-api'

type Command = { kind: 'refer' } | { kind: 'decision'; decision: Decision }

/**
 * The chief's commands at the top of a case (Figma 31885:6783): «ارجاع» as the primary button and the other two
 * decisions in the ⋮ menu. In triage «ارجاع» opens the reviewer dialog; once the review is complete it moves the
 * case on to the financial stage. Nothing here decides who may act: each set exists only for an entry of
 * `allowedActions`, and the command re-checks it.
 */
export function RequestHeaderActions({
  id,
  actions,
  revision,
}: {
  id: string
  actions: RequestAction[]
  revision?: number
}) {
  const [command, setCommand] = useState<Command | null>(null)
  const triage = actions.includes('triage')
  const decideReview = actions.includes('decideReview')
  if (!triage && !decideReview) return null
  const decisions = triage ? TRIAGE : REVIEW_DECISION

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="40"
          className="min-w-[120px]"
          onClick={() => setCommand(triage ? { kind: 'refer' } : { kind: 'decision', decision: decisions[0]! })}
        >
          <Typography as="span" variant="16/semibold" className="text-inherit">
            ارجاع
          </Typography>
        </Button>
        <RowActions
          menuLabel="اقدام‌های بیشتر"
          actions={[
            {
              id: 'return',
              label: 'درخواست اصلاحیه',
              icon: <BackSquareIcon aria-hidden="true" className="size-5" />,
              onSelect: () => setCommand({ kind: 'decision', decision: decisions[1]! }),
            },
            {
              id: 'reject',
              label: 'رد درخواست',
              icon: <DashboardCloseCircle aria-hidden="true" className="size-5" />,
              destructive: true,
              onSelect: () => setCommand({ kind: 'decision', decision: decisions[2]! }),
            },
          ]}
        />
      </div>
      {command?.kind === 'refer' ? (
        <ReferRequestDialog id={id} revision={revision} onClose={() => setCommand(null)} />
      ) : command?.kind === 'decision' ? (
        <RequestDecisionDialog
          id={id}
          revision={revision}
          decision={command.decision}
          available={actions.includes(command.decision.gate)}
          onClose={() => setCommand(null)}
        />
      ) : null}
    </>
  )
}
