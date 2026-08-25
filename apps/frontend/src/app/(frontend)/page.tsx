import type { Metadata } from 'next'
import CommentsSection from '@/components/landing/home/comments-section'
import EventsSection from '@/components/landing/home/events-section'
import FaqSection from '@/components/landing/home/faq-section'
import HeroSection from '@/components/landing/home/hero-section'
import LogoStripSection from '@/components/landing/home/logo-strip-section'
import NewsSection from '@/components/landing/home/news-section'
import ServicesSection from '@/components/landing/home/services-section'
import Reveal from '@/components/landing/reveal'
import ScrollProvider from '@/components/landing/scroll-provider'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const metadata: Metadata = createPageMetadata({ path: '/' })


export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <main className="relative flex w-full flex-col gap-10 overflow-x-clip bg-white">
      <ScrollProvider />
      <HeroSection />
      <LogoStripSection />
      <Reveal>
        <ServicesSection />
      </Reveal>
      <Reveal>
        <EventsSection />
      </Reveal>
      <Reveal>
        <NewsSection />
      </Reveal>
      <Reveal>
        <CommentsSection />
      </Reveal>
      <Reveal>
        <FaqSection />
      </Reveal>
    </main>
  )
}
