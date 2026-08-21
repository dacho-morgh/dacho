import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import { Typography } from '@/components/ui/typography'
import type { Review } from '@dacho/cms-core'

export type CommentCardData = Pick<Review, 'avatar' | 'displayName' | 'review'>

const CommentCard = ({ comment }: { comment: CommentCardData }) => {
  return (
    <article
      dir="rtl"
      className="flex h-full w-full flex-col gap-3 rounded-4xl bg-white p-4 drop-shadow-lg lg:gap-4 lg:p-5"
    >
      <div className="flex items-center gap-3 lg:gap-4">
        <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-[#F5F5F5] lg:size-13">
          {typeof comment.avatar === 'object' && comment.avatar ? (
            <Media
              resource={comment.avatar}
              fill
              size="(min-width: 1024px) 52px, 44px"
              imgClassName="object-cover"
              pictureClassName="block size-full"
            />
          ) : null}
        </div>
        <Typography
          as="h3"
          variant="16/semibold"
          lg="20/bold"
          color="neutral-700"
          className="min-w-0 flex-1 text-right"
        >
          {comment.displayName || 'ناشناس'}
        </Typography>
      </div>

      <Typography
        asChild
        variant="14/regular"
        lg="16/regular"
        color="neutral-500"
        className="w-full text-right [&_p]:m-0"
      >
        <RichText data={comment.review} enableGutter={false} enableProse={false} />
      </Typography>
    </article>
  )
}

export default CommentCard
