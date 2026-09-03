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
          mobile: '(max-width: 1023px)',
          motionAllowed: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const { desktop, mobile, motionAllowed } = context.conditions as {
            desktop: boolean
            mobile: boolean
            motionAllowed: boolean
          }

          if (!motionAllowed) return

          const items = gsap.utils.toArray<HTMLElement>('[data-path-item]', list)
          const progressFill = list.querySelector<HTMLElement>('[data-path-progress-fill]')
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
              if (mobile) item.setAttribute('aria-hidden', String(!isActive))
              else item.removeAttribute('aria-hidden')
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

          if (desktop) {
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
          } else {
            gsap.set(items, {
              autoAlpha: 0,
              pointerEvents: 'none',
              y: 16,
            })
            gsap.set(items[0], { autoAlpha: 1, pointerEvents: 'auto', y: 0 })
            gsap.set(descriptions, { autoAlpha: 1, height: 'auto' })
            if (progressFill) {
              gsap.set(progressFill, { scaleX: 0, transformOrigin: 'right center' })
            }
          }

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

            if (desktop) {
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
            } else {
              scrollTimeline
                .to(
                  items[previousIndex],
                  { autoAlpha: 0, duration: 0.28, pointerEvents: 'none', y: -12 },
                  transitionStart,
                )
                .fromTo(
                  items[index],
                  { autoAlpha: 0, pointerEvents: 'none', y: 16 },
                  { autoAlpha: 1, duration: 0.48, pointerEvents: 'auto', y: 0 },
                  transitionStart + 0.04,
                )

              if (progressFill) {
                scrollTimeline.to(
                  progressFill,
                  { duration: 0.48, scaleX: index / (PATH_ITEMS.length - 1) },
                  transitionStart + 0.04,
                )
              }
            }
          }

          const scrollTrigger = ScrollTrigger.create({
            animation: scrollTimeline,
            anticipatePin: 1,
            end: () => {
              const stepDistance = desktop ? 640 : Math.max(window.innerHeight * 0.58, 420)

              return `+=${(PATH_ITEMS.length - 1) * stepDistance}`
            },
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const nextIndex = Math.round(self.progress * (PATH_ITEMS.length - 1))
              setAccessibleState(nextIndex)
            },
            pin: pinnedContent,
            scrub: mobile ? 0.45 : 0.65,
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
              className="relative h-[190px] min-w-0 shrink-0 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_8px_30px_rgb(10_10_10/0.06)] motion-reduce:h-auto motion-reduce:overflow-visible motion-reduce:rounded-none motion-reduce:border-0 motion-reduce:bg-transparent motion-reduce:shadow-none lg:flex lg:h-[600px] lg:flex-1 lg:flex-col lg:overflow-hidden lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none"
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
                  className={`absolute inset-x-0 top-10 bottom-0 flex flex-col gap-2 px-4 pt-2 pb-4 motion-reduce:static motion-reduce:border-y motion-reduce:border-neutral-200 motion-reduce:px-0 motion-reduce:py-3 lg:static lg:border-y lg:border-neutral-200 lg:px-0 lg:py-6 ${index === 0 ? 'opacity-100' : 'opacity-0 motion-reduce:opacity-100 lg:opacity-100'}`}
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
