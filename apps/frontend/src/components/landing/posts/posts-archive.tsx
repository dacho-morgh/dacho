import type { Post } from '@dacho/cms-core'
import Link from 'next/link'
import NewsCard from '@/components/landing/home/news-card'
import RecruitmentSection from '@/components/landing/home/recruitment-section'
import { NewsEmptyState } from '@/components/landing/news/news-empty-state'
import { NewsBreadcrumb, NewsPageHeading } from '@/components/landing/news/news-page-header'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

const description = 'مقالات، تحلیل‌ها و گزارش‌های تخصصی درباره فناوری، صنعت و نوآوری.'

export function PostsArchive({
  posts,
  page,
  totalPages,
}: {
  posts: Post[]
  page: number
  totalPages: number
}) {
  return (
    <main className="overflow-x-clip bg-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pt-25 pb-20 sm:px-6">
        <NewsBreadcrumb
          section="مقالات"
          sectionHref="/posts"
          title={page > 1 ? `صفحه ${page.toLocaleString('fa-IR')}` : undefined}
        />
        <NewsPageHeading title="مقالات" description={description} />
        {posts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {posts.map((post) => (
              <NewsCard key={post.id} news={post} variant="listing" relationTo="posts" />
            ))}
          </div>
        ) : (
          <NewsEmptyState
            title="مقاله‌ای برای نمایش وجود ندارد"
            description="در حال حاضر مقاله‌ای منتشر نشده است. به‌زودی دوباره به این صفحه سر بزنید."
          />
        )}
        {totalPages > 1 && (
          <nav aria-label="صفحه‌بندی مقالات" className="flex items-center justify-center gap-4">
            {page > 1 && (
              <Button asChild variant="gray" size="36">
                <Link href={page === 2 ? '/posts' : `/posts/page/${page - 1}`}>
                  <Typography as="span" variant="14/semibold" color="neutral-600">
                    صفحه قبل
                  </Typography>
                </Link>
              </Button>
            )}
            <Typography as="span" variant="14/semibold" color="neutral-600">
              صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
            </Typography>
            {page < totalPages && (
              <Button asChild variant="gray" size="36">
                <Link href={`/posts/page/${page + 1}`}>
                  <Typography as="span" variant="14/semibold" color="neutral-600">
                    صفحه بعد
                  </Typography>
                </Link>
              </Button>
            )}
          </nav>
        )}
      </section>
      <RecruitmentSection />
      <div className="h-40" aria-hidden="true" />
    </main>
  )
}
