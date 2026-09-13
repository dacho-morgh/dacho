/**
 * Processes media resource URL to ensure proper formatting
 * @param url The original URL from the resource
 * @param cacheTag Optional cache tag to append to the URL
 * @returns Properly formatted URL with cache tag if provided
 *
 * Local paths (e.g. `/api/media/file/image.webp`) are kept relative so
 * Next.js image optimization treats them as local rather than fetching
 * through `remotePatterns`, which blocks private IPs since Next.js 16.
 */
export const getMediaUrl = (url: string | null | undefined, cacheTag?: string | null): string => {
  if (!url) return ''

  let mediaUrl = url

  try {
    const parsedUrl = new URL(url)

    if (parsedUrl.pathname.startsWith('/api/media/file/')) {
      mediaUrl = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
    }
  } catch {
    // Relative media URLs are already in the form Next Image expects.
  }

  if (cacheTag && cacheTag !== '') {
    cacheTag = encodeURIComponent(cacheTag)
  }

  if (!cacheTag) return mediaUrl

  const separator = mediaUrl.includes('?') ? '&' : '?'
  return `${mediaUrl}${separator}${cacheTag}`
}
