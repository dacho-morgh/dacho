import { redirect } from 'next/navigation'

/**
 * The fixed evaluation form belongs to FE17 and does not exist yet. This old address
 * must not present a form without a command behind it, so it returns to the dossier.
 */
export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/requests/${encodeURIComponent(id)}`)
}
