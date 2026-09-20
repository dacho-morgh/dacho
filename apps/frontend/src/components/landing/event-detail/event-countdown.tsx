'use client'

import { useEffect, useState } from 'react'
import { Typography } from '@/components/ui/typography'

function getTimeLeft(startDate: string) {
  const remaining = Math.max(0, new Date(startDate).getTime() - Date.now())
  const days = Math.floor(remaining / 86_400_000)
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000)
  const minutes = Math.floor((remaining % 3_600_000) / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1_000)
  return [days, hours, minutes, seconds]
}

export default function EventCountdown({ startDate }: { startDate: string }) {
  const [timeLeft, setTimeLeft] = useState([0, 0, 0, 0])

  useEffect(() => {
    const update = () => setTimeLeft(getTimeLeft(startDate))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [startDate])

  return (
    <div
      aria-label="زمان باقی‌مانده تا رویداد"
      className="flex flex-row items-start gap-2 sm:gap-3"
      dir="ltr"
    >
      {timeLeft.map((value, index) => (
        <div className="flex items-start gap-2 sm:gap-3" key={index}>
          {index > 0 && (
            <Typography as="span" className="pt-4 text-white/40" variant="24/bold">
              :
            </Typography>
          )}
          <div className="flex flex-col items-center gap-1">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm sm:size-[72px]">
              <Typography
                as="span"
                className="text-[30px] leading-10 text-white sm:text-[36px]"
                variant="32/extrabold"
              >
                {String(value).padStart(2, '0')}
              </Typography>
            </div>
            <Typography as="span" className="text-white/70" variant="12/regular">
              {['روز', 'ساعت', 'دقیقه', 'ثانیه'][index]}
            </Typography>
          </div>
        </div>
      ))}
    </div>
  )
}
