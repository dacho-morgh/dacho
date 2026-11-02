'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Typography } from '@/components/ui/typography'
import type { MonthlyTrendPoint } from '@/utilities/dashboard-trend'

const fa = (value: number) => value.toLocaleString('fa-IR')

/** Bars rise from the baseline once; a dashboard visit is occasional, so it stays short. */
const GROW_SECONDS = 0.35
const GROW_STAGGER = 0.03

export function TrendChart({ points }: { points: readonly MonthlyTrendPoint[] }) {
  const scope = useRef<HTMLDivElement>(null)
  const max = Math.max(...points.flatMap((point) => [point.submitted, point.approved]), 1)
  const empty = points.every((point) => point.submitted === 0)
  const summary = points
    .map((point) => `${point.label}: ${fa(point.submitted)} ثبت‌شده، ${fa(point.approved)} تأییدشده`)
    .join('؛ ')

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-trend-bar]', {
          scaleY: 0,
          transformOrigin: 'bottom',
          duration: GROW_SECONDS,
          stagger: GROW_STAGGER,
          ease: 'power3.out',
          clearProps: 'transform',
        })
      })
      return () => media.revert()
    },
    { scope },
  )

  return (
    <Card className="rounded-[10px] border-neutral-200 bg-white px-6 py-5 shadow-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography as="h2" variant="title" color="neutral-800">
            درخواست‌های ثبت‌شده و تأییدشده
          </Typography>
          <Typography as="p" variant="12/regular" color="neutral-500">
            شش ماه اخیر، همه رویدادها
          </Typography>
        </div>
        <ul className="flex flex-wrap gap-4" aria-hidden="true">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-brand-600" />
            <Typography variant="12/regular" color="neutral-600">
              ثبت‌شده
            </Typography>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-secondary-600" />
            <Typography variant="12/regular" color="neutral-600">
              تأییدشده
            </Typography>
          </li>
        </ul>
      </div>

      <div ref={scope} role="img" aria-label={`نمودار ستونی درخواست‌ها. ${summary}`}>
        {empty ? (
          <Typography as="p" variant="14/regular" color="neutral-500" className="py-16 text-center">
            در شش ماه اخیر درخواستی ثبت نشده است.
          </Typography>
        ) : (
          <div className="grid grid-cols-6 gap-2 sm:gap-4" dir="rtl">
            {points.map((point) => (
              <div key={point.key} className="flex flex-col items-center gap-2">
                <div className="flex h-48 w-full items-end justify-center gap-1 border-b border-neutral-300 sm:gap-1.5">
                  {[
                    { value: point.submitted, kind: 'ثبت‌شده', color: 'bg-brand-600' },
                    { value: point.approved, kind: 'تأییدشده', color: 'bg-secondary-600' },
                  ].map((bar) => (
                    <div
                      key={bar.kind}
                      className="flex h-full w-full max-w-[18px] flex-col items-center justify-end gap-1"
                    >
                      <Typography
                        variant="12/semibold"
                        color="neutral-800"
                        className={bar.value ? '' : 'invisible'}
                      >
                        {fa(bar.value)}
                      </Typography>
                      <div
                        data-trend-bar
                        title={`${point.label}، ${bar.kind}: ${fa(bar.value)}`}
                        className={`w-full rounded-t-[4px] ${bar.color}`}
                        style={{
                          height: `${Math.max(bar.value > 0 ? 4 : 0, (bar.value / max) * 85)}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <Typography variant="12/regular" color="neutral-500">
                  {point.label}
                </Typography>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
