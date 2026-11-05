import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { OfflineNotice } from '@/components/dashboard/offline-notice'
import { loadCompanyRequestPage } from '@/components/dashboard/company-detail/company-request-data'
import { CompanyRequestView } from '@/components/dashboard/company-detail/company-request-views'
import { canReadCompanyDossiers } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export default async function CompanyRequestPage({
  params,
}: {
  params: Promise<{ id: string; requestId: string }>
}) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!canReadCompanyDossiers(user)) redirect('/dashboard?access=denied')

  const { id, requestId } = await params
  const data = await loadCompanyRequestPage(id, requestId)
  if (data.kind === 'missing') notFound()
  if (data.kind === 'unavailable') {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 pt-20 md:p-10" dir="rtl">
        <OfflineNotice
          reason={data.reason}
          retryHref={`/dashboard/companies/${encodeURIComponent(id)}/requests/${encodeURIComponent(requestId)}`}
        />
      </div>
    )
  }

  return <CompanyRequestView companyId={id} company={data.company} detail={data.detail} fields={data.fields} />
}
