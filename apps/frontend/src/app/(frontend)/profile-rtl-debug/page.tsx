import { CompanyProfileView } from '@/components/dashboard/profile/company-profile-view'
import type { ProfileDto } from '@/utilities/dashboard-api'

const emptyProfile: ProfileDto = {
  company: {
    name: '',
    establishmentDate: '',
    status: '',
    type: '',
    registrationNumber: '',
    economicCode: '',
    nationalId: '',
  },
  contacts: { phone: '', email: '' },
  executives: [],
  addresses: [],
}

export default function ProfileRtlDebugPage() {
  return <CompanyProfileView initialProfile={emptyProfile} />
}
