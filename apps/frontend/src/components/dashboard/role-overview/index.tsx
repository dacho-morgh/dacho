import type { OperationalRole } from '@cms-core/access/roles'
import { OwnerOverview } from '@/components/dashboard/owner-overview'
import { ChiefOverview } from './chief-overview'
import { CompanyOverview } from './company-overview'
import { InvestmentOverview } from './investment-overview'
import { ReviewerOverview } from './reviewer-overview'
import { SecretariatOverview } from './secretariat-overview'

/** Picks the overview the design gives each of the seven roles. UI routing only: the API authorizes every read. */
export async function RoleOverview({
  role,
  userName,
}: {
  role: OperationalRole
  userName?: string | null
}) {
  switch (role) {
    case 'system-owner':
      return <OwnerOverview userName={userName} />
    case 'central-secretariat':
      return <SecretariatOverview userName={userName} />
    case 'chief-reviewer':
      return <ChiefOverview userName={userName} />
    case 'reviewer':
    case 'employer-reviewer':
      return <ReviewerOverview userName={userName} role={role} />
    case 'investment-reviewer':
      return <InvestmentOverview userName={userName} />
    case 'representative':
      return <CompanyOverview userName={userName} />
  }
}
