import type { OperationalRole } from '../access/roles.js'

/** Case access must already have been checked separately for both parties. */
export function canSendLetter(sender: OperationalRole, recipient: OperationalRole, caseLinked: boolean): boolean {
  // T31 has no persisted financial handoff yet. Generic assignment must not
  // substitute for investment participation, for either side of a case letter.
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
