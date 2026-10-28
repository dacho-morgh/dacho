import type { OperationalRole } from '../access/roles.js'

/** Case access must already have been checked separately for both parties. */
export function canSendLetter(sender: OperationalRole, recipient: OperationalRole, caseLinked: boolean): boolean {
  switch (sender) {
    case 'system-owner':
    case 'chief-reviewer':
      return true
    case 'representative':
      return recipient === 'central-secretariat'
    case 'reviewer':
    case 'employer-reviewer':
      return caseLinked && recipient === 'chief-reviewer'
    case 'investment-reviewer':
      return caseLinked
    case 'central-secretariat':
      return recipient === 'representative' || caseLinked
  }
}
