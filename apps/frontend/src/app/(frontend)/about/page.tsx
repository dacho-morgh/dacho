import type { Metadata } from 'next'
import {
  AboutCallToAction,
  IntroductionSection,
  ServicesSection,
  VisionSection,
} from '@/components/landing/about/about-page'
import PathScrollSection from '@/components/landing/about/path-scroll-section'
import FaqSection from '@/components/landing/home/faq-section'
import Reveal from '@/components/landing/reveal'
import ScrollProvider from '@/components/landing/scroll-provider'
import { buildSafe } from '@/utilities/buildSafe'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const metadata: Metadata = createPageMetadata({
  title: 'درباره ما',
  description:
    'درباره کارخانه نوآوری نفت، گاز و پتروشیمی بوشهر، مسیر رشد فناوران و خدمات تخصصی آن.',
  path: '/about',
})

export default async function AboutPage() {
  const aboutUs = await buildSafe('about us global', () => getCachedGlobal('about-us', 1)())

  return (
    <main className="overflow-x-clip bg-neutral-50">
      <ScrollProvider />
      <IntroductionSection content={aboutUs?.introduction} />
      <PathScrollSection />
      {/* <Reveal delay={0.1}>
        <VisionSection />
      </Reveal> */}
      {/* <ServicesSection /> */}
      {/* <Reveal delay={0.1}>
        <AboutCallToAction />
      </Reveal> */}
    </main>
  )
}
