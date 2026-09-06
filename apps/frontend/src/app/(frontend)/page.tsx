import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import HeroSection from '@/components/landing/home/hero-section'
import LogoStripSection from '@/components/landing/home/logo-strip-section'
import ServicesSection from '@/components/landing/home/services-section'
import Reveal from '@/components/landing/reveal'
import { createPageMetadata } from '@/utilities/siteMetadata'

const ScrollProvider = dynamic(() => import('@/components/landing/scroll-provider'))
const EventsSection = dynamic(() => import('@/components/landing/home/events-section'))
const ServicesDetailSection = dynamic(
  () => import('@/components/landing/home/services-detail-section'),
)
const NewsSection = dynamic(() => import('@/components/landing/home/news-section'))
const RecruitmentSection = dynamic(() => import('@/components/landing/home/recruitment-section'))
const CommentsSection = dynamic(() => import('@/components/landing/home/comments-section'))
const FaqSection = dynamic(() => import('@/components/landing/home/faq-section'))

export const metadata: Metadata = createPageMetadata({ path: '/' })

export const revalidate = 60

export default function HomePage() {
  return (
    <main className="relative flex w-full flex-col overflow-x-clip bg-white">
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
        <ServicesDetailSection />
      </Reveal>
      <Reveal>
        <NewsSection />
      </Reveal>
      <Reveal>
        <RecruitmentSection variant="gold" />
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
