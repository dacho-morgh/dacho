import type { Metadata } from 'next'
import {
  AboutCallToAction,
  IntroductionSection,
  ServicesSection,
  VisionSection,
} from '@/components/landing/about/about-page'
import PathScrollSection from '@/components/landing/about/path-scroll-section'
import Reveal from '@/components/landing/reveal'
import ScrollProvider from '@/components/landing/scroll-provider'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const metadata: Metadata = createPageMetadata({
  title: 'درباره ما',
  description:
    'درباره کارخانه نوآوری نفت، گاز و پتروشیمی بوشهر، مسیر رشد فناوران و خدمات تخصصی آن.',
  path: '/about',
})

export default function AboutPage() {
  return (
    <main className="overflow-x-clip bg-white">
      <ScrollProvider />
      <IntroductionSection />
      <PathScrollSection />
      <Reveal delay={0.1}>
        <VisionSection />
      </Reveal>
      <ServicesSection />
      <Reveal delay={0.1}>
        <AboutCallToAction />
      </Reveal>
    </main>
  )
}
