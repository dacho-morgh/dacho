'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Image from 'next/image'
import { useRef } from 'react'
import { Typography } from '@/components/ui/typography'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const PATH_ITEMS = [
  {
    title: 'فضای استقرار تخصصی',
    description: 'محیطی خلاق برای هم‌افزایی تیم‌های فناور',
    image: '/figma/about/idea-to-market.png',
  },
  {
    title: 'عارضه‌یابی، مشاوره و منتورینگ',
    description:
      'تحلیل چالش‌های فنی و کسب‌وکاری با همراهی منتورهای خبره، از طراحی مفهومی تا نمونه‌سازی و آزمون‌های عملیاتی',
    image: '/figma/about/path/mentoring.png',
  },
  {
    title: 'خدمات مالی',
    description: 'تسهیل دسترسی به منابع مالی از طریق ظرفیت‌های داخلی کارخانه و نهادهای همکار.',
    image: '/figma/about/path/financial-services.png',
  },
  {
    title: 'خدمات تجاری‌سازی و ورود به بازار',
    description: 'هموارسازی مسیر عرضه فناوری به صنایع بزرگ و تسهیل فرآیند انعقاد قراردادهای تجاری.',
    image: '/figma/about/path/commercialization.png',
  },
  {
    title: 'خدمات دانش بنیان',
    description: 'پشتیبانی تخصصی برای اخذ مجوزها و بهره‌مندی از مشوق‌های قانونی',
    image: '/figma/about/path/knowledge-based.png',
  },
  {
    title: 'شبکه‌سازی صنعتی',
    description:
      'پل ارتباطی میان تیم‌های فناور، صنایع بزرگ و پیمانکاران جهت تعریف پروژه‌های مشترک.',
    image: '/figma/about/path/industrial-networking.png',
  },
]

export default function PathScrollSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const pinnedContentRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const section = sectionRef.current
      const pinnedContent = pinnedContentRef.current
      const list = listRef.current

      if (!section || !pinnedContent || !list) return

      const titles = gsap.utils.toArray<HTMLElement>('[data-path-title]', list)
      const descriptions = gsap.utils.toArray<HTMLElement>('[data-path-description]', list)
      const images = gsap.utils.toArray<HTMLElement>('[data-path-image]', pinnedContent)

      if (
        titles.length !== PATH_ITEMS.length ||
        descriptions.length !== PATH_ITEMS.length ||
        images.length !== PATH_ITEMS.length
      )
        return

      const media = gsap.matchMedia()

      media.add(
        {
          desktop: '(min-width: 1024px)',
          motionAllowed: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const { desktop, motionAllowed } = context.conditions as {
            desktop: boolean
            motionAllowed: boolean
          }

          if (!motionAllowed) return

          const rootStyles = getComputedStyle(document.documentElement)
          const activeTitleColor = rootStyles.getPropertyValue('--neutral-700').trim()
          const inactiveTitleColor = rootStyles.getPropertyValue('--neutral-600').trim()
          const activeTitleSize = desktop ? '32px' : '24px'
          const activeTitleLeading = desktop ? '50px' : '36px'
          const inactiveTitleSize = desktop ? '24px' : '20px'
          const inactiveTitleLeading = desktop ? '36px' : '32px'
          let activeIndex = 0
          let stateTimeline: gsap.core.Timeline | undefined

          const setState = (nextIndex: number, immediate = false) => {
            const clampedIndex = gsap.utils.clamp(0, PATH_ITEMS.length - 1, nextIndex)

            if (!immediate && clampedIndex === activeIndex) return

            const direction = clampedIndex >= activeIndex ? 1 : -1
            activeIndex = clampedIndex
            pinnedContent.dataset.pathActiveIndex = String(clampedIndex)
            stateTimeline?.kill()

            stateTimeline = gsap.timeline({
              defaults: {
                duration: immediate ? 0 : 0.52,
                ease: 'power3.inOut',
                overwrite: 'auto',
              },
            })

            images.forEach((image, index) => {
              const isActive = index === clampedIndex

              stateTimeline?.to(
                image,
                {
                  autoAlpha: isActive ? 1 : 0,
                  scale: isActive ? 1 : 0.985,
                  yPercent: isActive ? 0 : index < clampedIndex ? -4 : 4,
                },
                0,
              )

              image.setAttribute('aria-hidden', String(!isActive))
            })

            descriptions.forEach((description, index) => {
              const isActive = index === clampedIndex

              stateTimeline?.to(
                description,
                {
                  autoAlpha: isActive ? 1 : 0,
                  height: isActive ? () => description.scrollHeight : 0,
                },
                0,
              )

              description.setAttribute('aria-hidden', String(!isActive))
            })

            titles.forEach((title, index) => {
              const isActive = index === clampedIndex

              stateTimeline?.to(
                title,
                {
                  color: isActive ? activeTitleColor : inactiveTitleColor,
                  fontSize: isActive ? activeTitleSize : inactiveTitleSize,
                  lineHeight: isActive ? activeTitleLeading : inactiveTitleLeading,
                },
                0,
              )

              title.closest('[data-path-item]')?.setAttribute('data-active', String(isActive))
            })

            if (!immediate) {
              stateTimeline.fromTo(
                images[clampedIndex],
                { yPercent: direction * 4 },
                { yPercent: 0 },
                0,
              )
            }
          }

          gsap.set(images, {
            autoAlpha: 0,
            scale: 0.985,
            transformOrigin: '50% 50%',
            yPercent: 4,
          })
          gsap.set(descriptions, { autoAlpha: 0, height: 0 })
          setState(0, true)

          const scrollTrigger = ScrollTrigger.create({
            anticipatePin: 1,
            end: () => {
              const stepDistance = desktop ? 640 : Math.max(window.innerHeight * 0.72, 460)

              return `+=${(PATH_ITEMS.length - 1) * stepDistance}`
            },
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const nextIndex = Math.round(self.progress * (PATH_ITEMS.length - 1))
              setState(nextIndex)
            },
            pin: pinnedContent,
            start: 'top top',
            trigger: section,
          })

          return () => {
            stateTimeline?.kill()
            scrollTrigger.kill()
          }
        },
      )

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} className="relative bg-neutral-50">
      <div
        ref={pinnedContentRef}
        className="flex min-h-[100svh] items-start pt-20 md:items-center md:py-10 lg:min-h-screen lg:py-20"
      >
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 md:gap-8 md:px-8 lg:gap-10 2xl:px-0">
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="h-12 w-2 shrink-0 rounded-lg bg-secondary-500" />
              <Typography as="h2" color="neutral-600" md="40/extrabold" variant="32/extrabold">
                از ایده تا بازار
              </Typography>
            </div>
            <Typography as="p" color="neutral-500" variant="20/regular">
              ما در این کارخانه، نه فقط فضای کار، که «مسیر موفقیت» را برای فناوران ترسیم می‌کنیم.
            </Typography>
          </div>

          <div className="flex flex-col gap-4 md:gap-6 lg:flex-row lg:items-center lg:gap-10">
            <div className="relative h-[180px] w-full overflow-hidden rounded-3xl bg-neutral-900 md:h-[300px] lg:h-[600px] lg:w-[600px] lg:rounded-[40px]">
              {PATH_ITEMS.map((item, index) => (
                <div
                  className={`absolute inset-0 will-change-[opacity,transform] ${index === 0 ? 'opacity-100' : 'opacity-0'}`}
                  data-path-image
                  key={item.image}
                >
                  <Image
                    fill
                    alt=""
                    className="object-cover"
                    priority={index === 0}
                    sizes="(min-width: 1024px) 600px, (min-width: 768px) calc(100vw - 64px), calc(100vw - 32px)"
                    src={item.image}
                  />
                </div>
              ))}
            </div>

            <div
              ref={listRef}
              className="flex h-[384px] min-w-0 flex-1 flex-col overflow-hidden motion-reduce:h-auto motion-reduce:overflow-visible md:h-[390px] lg:h-[600px]"
            >
              {PATH_ITEMS.map((item, index) => (
                <article
                  className="flex flex-col gap-2 border-y border-neutral-200 py-2 md:py-2.5 lg:py-6"
                  data-path-item
                  key={item.title}
                >
                  <Typography
                    as={index === 0 ? 'h3' : 'h4'}
                    color={index === 0 ? 'neutral-700' : 'neutral-600'}
                    data-path-title
                    lg={index === 0 ? '32/extrabold' : '24/extrabold'}
                    variant={index === 0 ? '24/extrabold' : '20/extrabold'}
                  >
                    {item.title}
                  </Typography>
                  <div
                    className={
                      index === 0
                        ? 'overflow-hidden'
                        : 'h-0 overflow-hidden opacity-0 motion-reduce:h-auto motion-reduce:opacity-100'
                    }
                    data-path-description
                  >
                    <Typography as="p" color="neutral-500" lg="16/regular" variant="14/regular">
                      {item.description}
                    </Typography>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
