'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Image from 'next/image'
import { useRef } from 'react'
import { CarouselArrowRightIcon } from '@/components/icons/generated'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
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
    description: 'پل ارتباطی میان تیم‌های فناور، صنایع بزرگ و پیمانکاران جهت تعریف پروژه‌های مشترک.',
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

          // Small screens use the carousel below and must never be pinned.
          if (!desktop || !motionAllowed) return

          const items = gsap.utils.toArray<HTMLElement>('[data-path-item]', list)
          const counter = list.querySelector<HTMLElement>('[data-path-counter]')
          const rootStyles = getComputedStyle(document.documentElement)
          const activeTitleColor = rootStyles.getPropertyValue('--neutral-700').trim()
          const inactiveTitleColor = rootStyles.getPropertyValue('--neutral-600').trim()
          let activeIndex = -1

          const setAccessibleState = (nextIndex: number) => {
            if (nextIndex === activeIndex) return

            activeIndex = nextIndex
            pinnedContent.dataset.pathActiveIndex = String(nextIndex)

            images.forEach((image, index) => {
              image.setAttribute('aria-hidden', String(index !== nextIndex))
            })

            items.forEach((item, index) => {
              const isActive = index === nextIndex

              item.setAttribute('data-active', String(isActive))
              item.removeAttribute('aria-hidden')
            })

            if (counter) {
              counter.textContent = `${(nextIndex + 1).toLocaleString('fa-IR')} از ${PATH_ITEMS.length.toLocaleString('fa-IR')}`
            }
          }

          gsap.set(images, {
            autoAlpha: 0,
            scale: 1.025,
            transformOrigin: '50% 50%',
            yPercent: 2,
            willChange: 'opacity, transform',
          })
          gsap.set(images[0], { autoAlpha: 1, scale: 1, yPercent: 0 })

          gsap.set(descriptions, { autoAlpha: 0, height: 0 })
          gsap.set(descriptions[0], {
            autoAlpha: 1,
            height: () => descriptions[0].scrollHeight,
          })
          gsap.set(titles, {
            color: inactiveTitleColor,
            fontSize: '24px',
            lineHeight: '36px',
          })
          gsap.set(titles[0], {
            color: activeTitleColor,
            fontSize: '32px',
            lineHeight: '50px',
          })

          setAccessibleState(0)

          const scrollTimeline = gsap.timeline({
            defaults: { ease: 'power2.inOut' },
            paused: true,
          })

          for (let index = 1; index < PATH_ITEMS.length; index += 1) {
            const previousIndex = index - 1
            const transitionStart = previousIndex + 0.22

            scrollTimeline
              .to(
                images[previousIndex],
                { autoAlpha: 0, duration: 0.32, scale: 0.985, yPercent: -2 },
                transitionStart,
              )
              .fromTo(
                images[index],
                { autoAlpha: 0, scale: 1.025, yPercent: 2 },
                { autoAlpha: 1, duration: 0.5, scale: 1, yPercent: 0 },
                transitionStart + 0.04,
              )

            scrollTimeline
              .to(
                descriptions[previousIndex],
                { autoAlpha: 0, duration: 0.28, height: 0 },
                transitionStart,
              )
              .fromTo(
                descriptions[index],
                { autoAlpha: 0, height: 0 },
                {
                  autoAlpha: 1,
                  duration: 0.48,
                  height: () => descriptions[index].scrollHeight,
                },
                transitionStart + 0.04,
              )
              .to(
                titles[previousIndex],
                {
                  color: inactiveTitleColor,
                  duration: 0.38,
                  fontSize: '24px',
                  lineHeight: '36px',
                },
                transitionStart,
              )
              .to(
                titles[index],
                {
                  color: activeTitleColor,
                  duration: 0.48,
                  fontSize: '32px',
                  lineHeight: '50px',
                },
                transitionStart + 0.04,
              )
          }

          const scrollTrigger = ScrollTrigger.create({
            animation: scrollTimeline,
            anticipatePin: 1,
            end: () => {
              return `+=${(PATH_ITEMS.length - 1) * 640}`
            },
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const nextIndex = Math.round(self.progress * (PATH_ITEMS.length - 1))
              setAccessibleState(nextIndex)
            },
            pin: pinnedContent,
            scrub: 0.65,
            start: 'top top',
            trigger: section,
          })

          return () => {
            scrollTrigger.kill()
            scrollTimeline.kill()
          }
        },
      )

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} className="relative" data-path-section>
      <div className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-8 lg:hidden">
        <div className="mb-6 flex flex-col items-start gap-2 md:mb-8">
          <div className="flex items-center gap-4">
            <Typography as="h2" color="neutral-600" lg="32/extrabold" variant="24/extrabold">
              اهدافی که دنبال میکنیم
            </Typography>
          </div>
          <Typography as="p" color="neutral-500" lg="20/regular" variant="16/regular">
            ما در این کارخانه، نه فقط فضای کار، که «مسیر موفقیت» را برای فناوران ترسیم می‌کنیم.
          </Typography>
        </div>

        <Carousel
          aria-label="مسیر ایده تا بازار"
          className="min-w-0"
          opts={{ align: 'start', direction: 'rtl' }}
        >
          <CarouselContent className="ml-0 touch-pan-y">
            {PATH_ITEMS.map((item, index) => (
              <CarouselItem
                aria-label={`${index + 1} از ${PATH_ITEMS.length}`}
                className="pl-2"
                key={item.title}
              >
                <article className="flex h-full flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-4">
                  <div className="relative aspect-[4/3] max-h-[45svh] w-full overflow-hidden rounded-2xl bg-neutral-900">
                    <Image
                      fill
                      alt=""
                      className="object-cover"
                      sizes="(min-width: 1024px) 1px, (min-width: 768px) calc(100vw - 96px), calc(100vw - 64px)"
                      src={item.image}
                    />
                  </div>
                  <Typography as="p" color="neutral-500" variant="14/regular">
                    {(index + 1).toLocaleString('fa-IR')} از{' '}
                    {PATH_ITEMS.length.toLocaleString('fa-IR')}
                  </Typography>
                  <Typography as="h3" color="neutral-700" variant="20/extrabold">
                    {item.title}
                  </Typography>
                  <Typography as="p" color="neutral-500" variant="16/regular">
                    {item.description}
                  </Typography>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-4 flex justify-center gap-4">
            <CarouselPrevious aria-label="خدمت قبلی" className="static inset-auto m-0 size-12">
              <CarouselArrowRightIcon aria-hidden="true" />
            </CarouselPrevious>
            <CarouselNext aria-label="خدمت بعدی" className="static inset-auto m-0 size-12">
              <CarouselArrowRightIcon aria-hidden="true" className="rotate-180" />
            </CarouselNext>
          </div>
        </Carousel>
      </div>

      <div ref={pinnedContentRef} className="hidden items-center lg:flex lg:min-h-screen">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-8 pt-40 pb-10 xl:gap-8 2xl:px-0">
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="h-12 w-2 shrink-0 rounded-lg bg-secondary-500" />
              <Typography as="h2" color="neutral-600" md="40/extrabold" variant="32/extrabold">
                اهدافی که ما دنبال میکنیم
              </Typography>
            </div>
            <Typography as="p" color="neutral-500" variant="20/regular">
              ما در این کارخانه، نه فقط فضای کار، که «مسیر موفقیت» را برای فناوران ترسیم می‌کنیم.
            </Typography>
          </div>

          <div className="flex flex-row items-center gap-5 xl:gap-8">
            <div className="relative h-[clamp(360px,calc(100svh-21rem),580px)] w-[600px] overflow-hidden rounded-[40px] bg-neutral-900">
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
              className="relative flex h-[clamp(360px,calc(100svh-21rem),580px)] min-w-0 flex-1 flex-col overflow-hidden motion-reduce:h-auto motion-reduce:overflow-visible"
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-4 top-4 flex items-center gap-3 motion-reduce:hidden lg:hidden"
              >
                <span className="shrink-0 text-xs font-semibold text-neutral-500" data-path-counter>
                  ۱ از ۶
                </span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <span
                    className="block h-full w-full rounded-full bg-secondary-500"
                    data-path-progress-fill
                  />
                </span>
              </div>

              {PATH_ITEMS.map((item, index) => (
                <article
                  className={`static flex flex-col gap-2 border-y border-neutral-200 px-0 py-2 motion-reduce:py-3 xl:py-4 ${index === 0 ? 'opacity-100' : 'opacity-0 motion-reduce:opacity-100 lg:opacity-100'}`}
                  data-path-item
                  key={item.title}
                >
                  <Typography
                    as={index === 0 ? 'h3' : 'h4'}
                    color={index === 0 ? 'neutral-700' : 'neutral-600'}
                    data-path-title
                    lg={index === 0 ? '32/extrabold' : '24/extrabold'}
                    variant="20/extrabold"
                  >
                    {item.title}
                  </Typography>
                  <div
                    className="overflow-hidden motion-reduce:h-auto motion-reduce:opacity-100 lg:h-0 lg:opacity-0"
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
