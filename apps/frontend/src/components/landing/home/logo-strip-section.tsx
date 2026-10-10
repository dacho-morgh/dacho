import { buildSafe } from '@/utilities/buildSafe'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { defaultLogos, type LogoAsset } from './logo-strip-data'
import LogoStripSectionClient from './logo-strip-section.client'

const LogoStripSection = async () => {
  const settings = await buildSafe('home logo strip', () => getCachedGlobal('logo-strip', 2)())
  if (settings?.enabled === false) return null

  const logos: LogoAsset[] = settings?.logos?.length
    ? settings.logos.flatMap((item) => {
        const media = item.logo
        if (
          !media ||
          typeof media !== 'object' ||
          media.mimeType !== 'image/svg+xml' ||
          !media.url
        ) {
          return []
        }

        const reference = item.link?.reference
        const document = reference?.value
        const pageSlug =
          typeof document === 'object' && document?.slug
            ? document.slug === 'home' && reference?.relationTo === 'pages'
              ? ''
              : document.slug
            : undefined
        const href =
          item.link?.type === 'reference'
            ? pageSlug !== undefined
              ? `${reference?.relationTo === 'posts' ? '/posts' : ''}/${pageSlug}`
              : undefined
            : item.link?.url || undefined

        return [
          {
            id: item.id || String(media.id),
            name: item.name,
            href,
            newTab: item.link?.newTab === true,
            width: 'w-[120px] sm:w-[160px]',
            src: getMediaUrl(media.url, media.updatedAt),
          },
        ]
      })
    : defaultLogos.map((logo) => ({ ...logo, newTab: true }))

  if (!logos.length) return null

  return <LogoStripSectionClient logos={logos} />
}

export default LogoStripSection
