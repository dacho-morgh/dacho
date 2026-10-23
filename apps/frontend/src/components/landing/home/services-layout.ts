export const servicesGridClassName =
  'grid w-full grid-cols-1 gap-4 md:grid-cols-4 md:gap-5 xl:grid-cols-6'

/** Stretch incomplete rows to fill the grid at each breakpoint. */
export const serviceCardClassName = (index: number, total: number): string => {
  const last = index === total - 1
  const desktopSpan =
    total % 3 === 1 && last
      ? 'xl:col-span-6'
      : total % 3 === 2 && index >= total - 2
        ? 'xl:col-span-3'
        : 'xl:col-span-2'

  return ['min-w-0', total % 2 === 1 && last ? 'md:col-span-4' : 'md:col-span-2', desktopSpan].join(
    ' ',
  )
}
