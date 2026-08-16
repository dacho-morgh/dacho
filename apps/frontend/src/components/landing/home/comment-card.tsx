import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import type { Review } from '@dacho/cms-core'

export type CommentCardData = Pick<Review, 'avatar' | 'displayName' | 'review'>

const CommentCard = ({ comment }: { comment: CommentCardData }) => {
  return (
    <article
      dir="rtl"
      className="flex h-full w-full flex-col gap-4 rounded-4xl bg-white p-5 shadow-md"
    >
      <div className="flex items-center gap-4">
        <div className="relative size-13 shrink-0 overflow-hidden rounded-full bg-[#F5F5F5]">
          {typeof comment.avatar === 'object' && comment.avatar ? (
            <Media
              resource={comment.avatar}
              fill
              size="52px"
              imgClassName="object-cover"
              pictureClassName="block size-full"
            />
          ) : null}
        </div>
        <h3 className="min-w-0 flex-1 text-right text-xl leading-8 font-bold text-[#404040]">
          {comment.displayName || 'ناشناس'}
        </h3>
      </div>

      <RichText
        className="w-full text-right text-base leading-7 text-[#737373] [&_p]:m-0"
        data={comment.review}
        enableGutter={false}
        enableProse={false}
      />
    </article>
  )
}

export default CommentCard
