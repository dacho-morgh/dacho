import type { OperationalRole } from '../access/roles.js'

/**
 * Those the investment person writes with about a case. A case letter from them shows
 * that a package was handed off, so it stays within the staff of the financial audience.
 */
function isInvestmentCorrespondent(role: OperationalRole): boolean {
  return role === 'central-secretariat' || role === 'system-owner'
}

/** Case access, and the handoff for the investment person, must be checked separately for both parties. */
export function canSendLetter(sender: OperationalRole, recipient: OperationalRole, caseLinked: boolean): boolean {
  if (sender === 'investment-reviewer') return caseLinked && isInvestmentCorrespondent(recipient)
  if (caseLinked && recipient === 'investment-reviewer') return isInvestmentCorrespondent(sender)
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
