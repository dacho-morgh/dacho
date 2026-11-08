import { redirect } from 'next/navigation'

/** The follow-up cases now live in the requests list, tagged and behind its follow-up filter. */
export default function FollowUpsPage(): never {
  redirect('/dashboard/requests?followUp=1')
}
