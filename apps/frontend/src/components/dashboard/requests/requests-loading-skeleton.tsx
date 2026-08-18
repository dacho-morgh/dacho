import React from 'react'

/**
 * Loading Skeleton for Requests (Figma Screen 13 - node 50:9222)
 */
export function RequestsLoadingSkeleton() {
  return (
    <div className="flex min-w-175 gap-4" role="status" aria-label="در حال بارگذاری درخواست‌ها">
      {/* 4 skeleton columns (Figma: Frame 8, Frame 7, Frame 3, Frame 9) */}
      {[1, 2, 3, 4].map((col) => (
        <div key={col} className="flex flex-1 flex-col gap-4">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-10 w-full rounded-lg bg-neutral-100" />
          ))}
        </div>
      ))}
    </div>
  )
}
