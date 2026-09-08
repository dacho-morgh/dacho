import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { Typography } from '@/components/ui/typography'
import { buildSafe } from '@/utilities/buildSafe'
import CommentCard from './comment-card'
import CommentsSlideshow from './comments-slideshow'

const CommentsSection = async () => {
  const reviews = await buildSafe('home reviews', async () => {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'reviews',
      depth: 1,
      pagination: false,
      sort: 'priority',
    })
    return docs
  })

  if (!reviews || reviews.length === 0) return null

  const shouldLoop = reviews.length > 3
  const cards = reviews.map((review) => <CommentCard key={review.id} comment={review} />)

  return (
    <section
      dir="rtl"
      className="flex w-full flex-col items-center gap-10 overflow-x-hidden py-8 pb-30 sm:px-6 lg:items-start lg:px-0 lg:py-20 lg:pb-30"
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 text-right">
        <div className="flex items-stretch gap-2 lg:ms-30 xl:ms-40 8xl:ms-0">
          <div className="my-2 w-1 rounded-full bg-[#FAB622] lg:my-3 lg:w-2" />
         <Typography as="h2" variant="32/extrabold" sm="40/extrabold" color="neutral-600">
            نظرات
          </Typography>
        </div>
        <Typography
          variant="16/light"
          sm="20/regular"
          color="neutral-500"
          className="max-w-5xl lg:ms-30 xl:ms-40 8xl:ms-0"
        >
          از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه
          مدیریت می‌شود.
        </Typography>
      </div>
      {shouldLoop ? (
        <CommentsSlideshow reviews={reviews} />
      ) : (
        <div className="w-full overflow-x-auto">
          <div className="mx-auto flex w-max max-w-7xl gap-4 px-4 py-2">
            {cards.map((card, index) => (
              <div
                key={reviews[index].id}
                className="w-[calc((100vw-48px)/1.15)] shrink-0 sm:w-[calc((100vw-64px)/2)] lg:w-[calc((100vw-48px)/3.2)] xl:w-100"
              >
                {card}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default CommentsSection
