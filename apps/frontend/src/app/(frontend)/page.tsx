import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import EventsSectionSkeleton from '@/components/landing/home/events-section-skeleton'
import FaqSectionSkeleton from '@/components/landing/home/faq-section-skeleton'
import HeroSectionSkeleton from '@/components/landing/home/hero-section-skeleton'
import LogoStripSectionSkeleton from '@/components/landing/home/logo-strip-section-skeleton'
import NewsSectionSkeleton from '@/components/landing/home/news-section-skeleton'
import RecruitmentSectionSkeleton from '@/components/landing/home/recruitment-section-skeleton'
import ServicesSectionSkeleton from '@/components/landing/home/services-section-skeleton'
import Reveal from '@/components/landing/reveal'
import { createPageMetadata } from '@/utilities/siteMetadata'

const ScrollProvider = dynamic(() => import('@/components/landing/scroll-provider'))
const HeroSection = dynamic(() => import('@/components/landing/home/hero-section'))
const LogoStripSection = dynamic(() => import('@/components/landing/home/logo-strip-section'))
const ServicesSection = dynamic(() => import('@/components/landing/home/services-section'))
const EventsSection = dynamic(() => import('@/components/landing/home/events-section'))
// const ServicesDetailSection = dynamic(
//   () => import('@/components/landing/home/services-detail-section'),
// )
const NewsSection = dynamic(() => import('@/components/landing/home/news-section'))
const RecruitmentSection = dynamic(() => import('@/components/landing/home/recruitment-section'))
const FaqSection = dynamic(() => import('@/components/landing/home/faq-section'))
// const CommentsSection = dynamic(() => import('@/components/landing/home/comments-section'))

export const metadata: Metadata = createPageMetadata({ path: '/' })

export const revalidate = 60

export default function HomePage() {
  return (
    <main className="relative flex w-full flex-col overflow-x-clip bg-white">
      <ScrollProvider />
      <Suspense fallback={<HeroSectionSkeleton />}>
        <HeroSection />
      </Suspense>
      <Suspense fallback={<LogoStripSectionSkeleton />}>
        <LogoStripSection />
      </Suspense>
      <Reveal>
        <Suspense fallback={<ServicesSectionSkeleton />}>
          <ServicesSection />
        </Suspense>
      </Reveal>
      <Reveal>
        <Suspense fallback={<EventsSectionSkeleton />}>
          <EventsSection />
        </Suspense>
      </Reveal>
      {/* <Reveal>
        <ServicesDetailSection />
      </Reveal> */}
      <Reveal>
        <Suspense fallback={<NewsSectionSkeleton />}>
          <NewsSection />
        </Suspense>
      </Reveal>
      <Reveal className="lg:mt-10">
        <Suspense fallback={<RecruitmentSectionSkeleton />}>
          <RecruitmentSection />
        </Suspense>
      </Reveal>
      {/* <Reveal>
        <CommentsSection />
      </Reveal> */}
      <Reveal>
        <Suspense fallback={<FaqSectionSkeleton />}>
          <FaqSection />
        </Suspense>
      </Reveal>
    </main>
  )
}
