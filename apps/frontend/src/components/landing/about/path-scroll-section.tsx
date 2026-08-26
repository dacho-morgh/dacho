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

      media.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const rootStyles = getComputedStyle(document.documentElement)
        const activeTitleColor = rootStyles.getPropertyValue('--neutral-700').trim()
        const inactiveTitleColor = rootStyles.getPropertyValue('--neutral-600').trim()

        gsap.set(images, {
          autoAlpha: 0,
          scale: 0.985,
          transformOrigin: '50% 50%',
        })
        gsap.set(images[0], { autoAlpha: 1, scale: 1 })
        gsap.set(descriptions[0], { autoAlpha: 1, height: descriptions[0].scrollHeight })
        gsap.set(descriptions.slice(1), { autoAlpha: 0, height: 0 })

        const timeline = gsap.timeline({
          defaults: { duration: 1.15, ease: 'power2.inOut' },
          scrollTrigger: {
            anticipatePin: 1,
            end: () => `+=${(PATH_ITEMS.length - 1) * 640}`,
            invalidateOnRefresh: true,
            pin: pinnedContent,
            scrub: 1.1,
            start: 'top top',
            trigger: section,
          },
        })

        timeline.to({}, { duration: 0.22 })

        for (let index = 1; index < PATH_ITEMS.length; index += 1) {
          const previousIndex = index - 1
          const transitionLabel = `path-state-${index}`

          timeline
            .addLabel(transitionLabel)
            .to(descriptions[previousIndex], { autoAlpha: 0, height: 0 }, transitionLabel)
            .to(
              titles[previousIndex],
              {
                color: inactiveTitleColor,
                fontSize: '24px',
                lineHeight: '36px',
              },
              transitionLabel,
            )
            .to(
              images[previousIndex],
              {
                autoAlpha: 0,
                scale: 1.025,
              },
              transitionLabel,
            )
            .to(
              images[index],
              {
                autoAlpha: 1,
                scale: 1,
              },
              transitionLabel,
            )
            .to(
              descriptions[index],
              {
                autoAlpha: 1,
                height: () => descriptions[index].scrollHeight,
              },
              transitionLabel,
            )
            .to(
              titles[index],
              {
                color: activeTitleColor,
                fontSize: '32px',
                lineHeight: '50px',
              },
              transitionLabel,
            )
            .to({}, { duration: 0.22 })
        }

        return () => timeline.kill()
      })

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} className="relative bg-neutral-50">
      <div ref={pinnedContentRef} className="py-16 lg:flex lg:min-h-screen lg:items-center lg:py-20">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-4 md:px-8 2xl:px-0">
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

          <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[40px] bg-neutral-900 lg:h-[600px] lg:w-[600px]">
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
                    sizes="(min-width: 1024px) 600px, 100vw"
                    src={item.image}
                  />
                </div>
              ))}
            </div>

            <div ref={listRef} className="flex min-w-0 flex-1 flex-col overflow-hidden lg:h-[600px]">
              {PATH_ITEMS.map((item, index) => (
                <article className="flex flex-col gap-2 border-y border-neutral-200 py-6" key={item.title}>
                  <Typography
                    as={index === 0 ? 'h3' : 'h4'}
                    color={index === 0 ? 'neutral-700' : 'neutral-600'}
                    data-path-title
                    md={index === 0 ? '32/extrabold' : '24/extrabold'}
                    variant="24/extrabold"
                  >
                    {item.title}
                  </Typography>
                  <div
                    className={index === 0 ? 'overflow-hidden' : 'overflow-hidden lg:h-0 lg:opacity-0'}
                    data-path-description
                  >
                    <Typography as="p" color="neutral-500" variant="16/regular">
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
