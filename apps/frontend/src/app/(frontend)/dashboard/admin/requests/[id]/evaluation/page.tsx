import { AdminRequestEvaluation } from '@/components/dashboard/admin-request-evaluation'
export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AdminRequestEvaluation id={id} />
}
