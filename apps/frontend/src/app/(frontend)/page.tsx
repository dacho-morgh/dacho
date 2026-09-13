import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import HeroSliderSection from '@/components/landing/home/hero-slider-section'
import HeroSliderSectionSkeleton from '@/components/landing/home/hero-slider-section-skeleton'
import LogoStripSection from '@/components/landing/home/logo-strip-section'
// import ServicesSection from '@/components/landing/home/services-section'
import Reveal from '@/components/landing/reveal'
import { createPageMetadata } from '@/utilities/siteMetadata'

const ScrollProvider = dynamic(() => import('@/components/landing/scroll-provider'))
const EventsSection = dynamic(() => import('@/components/landing/home/events-section'))
// const ServicesDetailSection = dynamic(
//   () => import('@/components/landing/home/services-detail-section'),
// )
const NewsSection = dynamic(() => import('@/components/landing/home/news-section'))
const RecruitmentSection = dynamic(() => import('@/components/landing/home/recruitment-section'))
// const CommentsSection = dynamic(() => import('@/components/landing/home/comments-section'))

export const metadata: Metadata = createPageMetadata({ path: '/' })

export const revalidate = 60

export default function HomePage() {
  return (
    <main className="relative flex w-full flex-col overflow-x-clip bg-white">
      <ScrollProvider />
      <Suspense fallback={<HeroSliderSectionSkeleton />}>
        <HeroSliderSection />
      </Suspense>
      {/* <Reveal>
        <ServicesSection />
      </Reveal> */}
      <Reveal>
        <EventsSection />
      </Reveal>
      {/* <Reveal>
        <ServicesDetailSection />
      </Reveal> */}
      <Reveal>
        <NewsSection />
      </Reveal>
      <Reveal>
        <LogoStripSection />
      </Reveal>
      <Reveal>
        <RecruitmentSection />
      </Reveal>
      {/* <Reveal>
        <CommentsSection />
      </Reveal> */}
    </main>
  )
}
