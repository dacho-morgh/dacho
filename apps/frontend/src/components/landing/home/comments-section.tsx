import configPromise from '@payload-config'
import { getPayload } from 'payload'
import CommentCard from './comment-card'
import CommentsSlideshow from './comments-slideshow'

const CommentsSection = async () => {
  const payload = await getPayload({ config: configPromise })
  const { docs: reviews } = await payload.find({
    collection: 'reviews',
    depth: 1,
    pagination: false,
    sort: 'priority',
  })

  if (reviews.length === 0) return null

  const shouldLoop = reviews.length > 3
  const cards = reviews.map((review) => <CommentCard key={review.id} comment={review} />)

  return (
    <section
      dir="rtl"
      className="flex w-full flex-col items-center gap-10 overflow-x-hidden px-4 py-24 sm:px-6 sm:py-32 lg:items-start lg:px-0 lg:py-40"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 text-right">
        <h2 className="text-[32px] leading-12 font-semibold text-[#525252] sm:text-[40px] sm:leading-16">
          نظرات
        </h2>
        <p className="text-base leading-7 text-[#737373] sm:text-xl sm:leading-8">
          از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه
          مدیریت می‌شود.
        </p>
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
