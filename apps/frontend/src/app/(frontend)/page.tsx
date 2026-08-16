import CommentsSection from '@/components/landing/home/comments-section'
import EventsSection from '@/components/landing/home/events-section'
import FaqSection from '@/components/landing/home/faq-section'
import HeroSection from '@/components/landing/home/hero-section'
import LogoStripSection from '@/components/landing/home/logo-strip-section'
import NewsSection from '@/components/landing/home/news-section'
import ServicesSection from '@/components/landing/home/services-section'
import ScrollProvider from '@/components/landing/scroll-provider'

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col gap-10 overflow-x-hidden bg-white">
      <ScrollProvider />
      <HeroSection />
      <LogoStripSection />
      <ServicesSection />
      <EventsSection />
      <NewsSection />
      <CommentsSection />
      <FaqSection />
    </main>
  )
}
