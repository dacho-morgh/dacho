import type { OperationalRole } from '../access/roles.js'

/** Case access must already have been checked separately for both parties. */
export function canSendLetter(sender: OperationalRole, recipient: OperationalRole, caseLinked: boolean): boolean {
  // Investment correspondence is T34. The T31 handoff opens the case and its files,
  // not letters, and a generic assignment must not stand in for either side.
  if (sender === 'investment-reviewer' || (caseLinked && recipient === 'investment-reviewer')) return false
  switch (sender) {
    case 'system-owner':
    case 'chief-reviewer':
      return true
    case 'representative':
      return recipient === 'central-secretariat'
    case 'reviewer':
    case 'employer-reviewer':
      return caseLinked && recipient === 'chief-reviewer'
    case 'central-secretariat':
      return recipient === 'representative' || caseLinked
  }
}
