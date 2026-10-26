import type { OperationalRole } from './roles.js'

/** Actions that currently have an implemented event endpoint. */
export const EVENT_ACTIONS = ['read', 'manage'] as const

export type EventAction = (typeof EVENT_ACTIONS)[number]

/**
 * The responsibility data an event must expose for authorization. It is kept
 * deliberately small so later subtopic, booth and review-round resources can
 * reuse the same check without depending on the full event record.
 */
export interface EventForPolicy {
  id: string
  responsibleChiefId: string | null
  responsibleInvestmentId: string | null
}

export interface EventWindow {
  registrationOpenAt: string
  registrationCloseAt: string
}

/**
 * Event responsibility is per event, not per role. An assigned chief has no
 * authority over another event even though both events use the same role.
 */
export function allowedEventActions(
  role: OperationalRole,
  actorId: string,
  event: EventForPolicy,
): EventAction[] {
  switch (role) {
    case 'system-owner':
      return ['read', 'manage']
    case 'central-secretariat':
      return ['read']
    case 'chief-reviewer':
      return event.responsibleChiefId === actorId ? ['read'] : []
    case 'investment-reviewer':
      return event.responsibleInvestmentId === actorId ? ['read'] : []
    case 'reviewer':
    case 'employer-reviewer':
    case 'representative':
      return []
  }
}

export function canActOnEvent(
  role: OperationalRole,
  actorId: string,
  event: EventForPolicy,
  action: EventAction,
): boolean {
  return allowedEventActions(role, actorId, event).includes(action)
}

/** Event configuration writes are owner-only, never inferred from a role's event assignment. */
export function canManageEvents(role: OperationalRole): boolean {
  return role === 'system-owner'
}

/** Registration is open from the opening instant through the closing instant. */
export function isRegistrationOpen(event: EventWindow, now: Date = new Date()): boolean {
  const open = Date.parse(event.registrationOpenAt)
  const close = Date.parse(event.registrationCloseAt)
  const current = now.getTime()
  return Number.isFinite(open) && Number.isFinite(close) && current >= open && current <= close
}
