import { AdminRequestDetail } from '@/components/dashboard/admin-request-detail'

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AdminRequestDetail id={id} />
}
