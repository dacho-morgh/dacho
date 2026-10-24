import { redirect } from 'next/navigation'

/**
 * The review-evaluation workflow (rounds, four assignments and the fixed
 * rubric) is not implemented yet. The shared authorization response does not
 * advertise an evaluation action, so this stale route must not present a form
 * whose backend command does not exist. It returns to the authorized dossier;
 * T24/T25 will replace it when the review workflow is delivered.
 */
export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/requests/${encodeURIComponent(id)}`)
}
