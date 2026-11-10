import { legalEntityCheckDigit } from '@dacho/cms-core/auth/self-signup'

/**
 * A synthetic company national ID that passes the signup check (#278): the
 * seed's digits fill the first ten positions (left-padded, last ten kept), a
 * zero six-digit serial is avoided, and the legal-entity check digit is
 * appended. Distinct seeds of up to ten digits give distinct IDs.
 */
export function validNationalId(seed: string | number): string {
  let prefix = String(seed).replace(/\D/g, '').padStart(10, '0').slice(-10)
  if (/^0{6}$/.test(prefix.slice(3, 9))) prefix = `${prefix.slice(0, 3)}1${prefix.slice(4)}`
  return `${prefix}${legalEntityCheckDigit(prefix)}`
}
