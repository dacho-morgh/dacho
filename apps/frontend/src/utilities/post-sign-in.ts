/**
 * Where a person goes once the browser holds a session cookie: the login form
 * and the registration form (which signs the new representative in) share this
 * so both apply the same capability and access handling.
 *
 * It only reads; the caller navigates with `window.location.replace(destination)`
 * so the protected route is requested with the freshly stored cookie instead of
 * an unauthenticated router cache.
 */
export type PostSignInResult = { destination: string } | { error: string }

export async function resolvePostSignInDestination({
  user,
  explicitReturnUrl,
}: {
  user?: { contentEditor?: boolean | null } | null
  explicitReturnUrl: string | null
}): Promise<PostSignInResult> {
  const capabilityResponse = await fetch('/api/dashboard/capabilities', { cache: 'no-store' })
  if (capabilityResponse.status === 401) {
    return { error: 'نشست ورود تأیید نشد. دوباره وارد شوید.' }
  }
  if (capabilityResponse.status === 403) {
    if (user?.contentEditor === true) return { destination: '/admin' }
    return {
      error:
        'ورود انجام شد، اما دسترسی فعالی برای ورود به پیشخوان پیدا نشد. با پشتیبانی سامانه تماس بگیرید.',
    }
  }
  if (!capabilityResponse.ok) {
    return { error: 'ورود انجام شد، اما سرویس دسترسی پاسخ نداد. کمی بعد دوباره تلاش کنید.' }
  }

  const capabilities = (await capabilityResponse.json()) as { destinations?: string[] }
  const landing = capabilities.destinations?.[0] ?? '/dashboard'
  if (!explicitReturnUrl) return { destination: landing }

  const requestedPath = explicitReturnUrl.split(/[?#]/, 1)[0]
  const accessResponse = await fetch(
    `/api/dashboard/access?path=${encodeURIComponent(requestedPath ?? '')}`,
    { cache: 'no-store' },
  )
  if (accessResponse.status === 401) {
    return { error: 'نشست ورود تأیید نشد. دوباره وارد شوید.' }
  }
  if (accessResponse.status === 403) return { destination: '/dashboard?access=denied' }
  if (!accessResponse.ok) {
    return { error: 'ورود انجام شد، اما بررسی نشانی درخواستی در دسترس نیست.' }
  }
  const access = (await accessResponse.json().catch(() => null)) as { allowed?: boolean } | null
  return { destination: access?.allowed ? explicitReturnUrl : '/dashboard?access=denied' }
}
