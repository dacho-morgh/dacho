import { redirect } from 'next/navigation'

export default async function InboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/letters/${encodeURIComponent(id)}`)
}
