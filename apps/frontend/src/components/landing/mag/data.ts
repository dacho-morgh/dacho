import 'server-only'
import type { Mag, News, Post } from '@dacho/cms-core'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getMediaUrl } from '@/utilities/getMediaUrl'

export type MagStory = {
  id: string
  title: string
  href: string
  image: string
  category: string
  time: string
  excerpt: string
  label: string
  author: string
  readingTime: string
  date: string
  tags: string[]
}

export type MagData = {
  hero?: MagStory
  latestNews: MagStory[]
  articles: MagStory[]
  sections: {
    id: string
    title: string
    featured?: MagStory
    stories: MagStory[]
    hashtag?: string
    reverseLayout: boolean
  }[]
  featuredReport?: MagStory
  mostRead: MagStory[]
  editorPicks: MagStory[]
  eventNews: MagStory[]
  hotHashtags: string[]
  newsletterTitle: string
  newsletterDescription: string
  showRecruitment: boolean
  hashtag?: string
  matches: MagStory[]
}

type Document = News | Post
type StoryReference =
  | { relationTo: 'news'; value: number | News }
  | { relationTo: 'posts'; value: number | Post }

function relationId(value: number | Document | null | undefined): number | undefined {
  return typeof value === 'number' ? value : value?.id
}

function resolveOne(value: number | Document | null | undefined, items: Map<number, MagStory>) {
  const id = relationId(value)
  return id === undefined ? undefined : items.get(id)
}

function resolveMany(
  values: (number | Document)[] | null | undefined,
  items: Map<number, MagStory>,
) {
  return (values ?? [])
    .map((value) => resolveOne(value, items))
    .filter((item): item is MagStory => Boolean(item))
}

function resolveStory(
  reference: StoryReference | null | undefined,
  news: Map<number, MagStory>,
  posts: Map<number, MagStory>,
): MagStory | undefined {
  if (!reference) return undefined
  const id = relationId(reference.value)
  return id === undefined
    ? undefined
    : reference.relationTo === 'news'
      ? news.get(id)
      : posts.get(id)
}

function toStory(doc: Document, kind: 'news' | 'posts'): MagStory {
  const date = doc.publishedAt || doc.createdAt
  const media = typeof doc.heroImage === 'object' && doc.heroImage ? doc.heroImage : null
  const category = doc.categories?.find((item) => typeof item === 'object')
  const author = doc.populatedAuthors?.[0]?.name
  return {
    id: `${kind}:${doc.id}`,
    title: doc.title,
    href: `/${kind}/${doc.slug}`,
    image: getMediaUrl(media?.url) || '/figma/news/news-1.png',
    category:
      category && typeof category === 'object' ? category.title : kind === 'news' ? 'خبر' : 'مقاله',
    time: date
      ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(date))
      : '',
    excerpt: doc.excerpt || '',
    label: doc.editorialLabel || '',
    author: author || 'تحریریه صندوق',
    readingTime: doc.readingMinutes ? `${doc.readingMinutes} دقیقه مطالعه` : '',
    date: date ? new Intl.DateTimeFormat('fa-IR').format(new Date(date)) : '',
    tags: (doc.tags ?? []).map((item) => item.tag).filter(Boolean),
  }
}

export function normalizeHashtag(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const tag = raw?.trim().replace(/^#+/, '').trim()
  return tag && tag.length <= 80 ? tag : undefined
}

export async function getMagData(hashtag?: string): Promise<MagData> {
  const payload = await getPayload({ config })
  const mag = await payload.findGlobal({ slug: 'mag', depth: 0, overrideAccess: false })
  const sectionReferences = (mag.sections ?? []).flatMap((section) => [
    ...(section.featured ? [section.featured] : []),
    ...(section.stories ?? []),
  ])
  const selectedNewsIds = [
    mag.hero,
    ...(mag.latestNews ?? []),
    ...(mag.eventNews ?? []),
    ...sectionReferences.filter((item) => item.relationTo === 'news').map((item) => item.value),
    ...(mag.mostRead ?? []).filter((item) => item.relationTo === 'news').map((item) => item.value),
    ...(mag.editorPicks ?? [])
      .filter((item) => item.relationTo === 'news')
      .map((item) => item.value),
  ]
    .map((value) => relationId(value as number | News | null | undefined))
    .filter((id): id is number => id !== undefined)
  const selectedPostIds = [
    mag.featuredReport,
    ...(mag.latestArticles ?? []),
    ...sectionReferences.filter((item) => item.relationTo === 'posts').map((item) => item.value),
    ...(mag.mostRead ?? []).filter((item) => item.relationTo === 'posts').map((item) => item.value),
    ...(mag.editorPicks ?? [])
      .filter((item) => item.relationTo === 'posts')
      .map((item) => item.value),
  ]
    .map((value) => relationId(value as number | Post | null | undefined))
    .filter((id): id is number => id !== undefined)
  const [news, posts, selectedNews, selectedPosts, matchedNews, matchedPosts] = await Promise.all([
    payload.find({
      collection: 'news',
      where: { _status: { equals: 'published' } },
      depth: 2,
      limit: 12,
      sort: '-publishedAt',
      overrideAccess: false,
    }),
    payload.find({
      collection: 'posts',
      where: { _status: { equals: 'published' } },
      depth: 2,
      limit: 6,
      sort: '-publishedAt',
      overrideAccess: false,
    }),
    selectedNewsIds.length
      ? payload.find({
          collection: 'news',
          where: { and: [{ id: { in: selectedNewsIds } }, { _status: { equals: 'published' } }] },
          depth: 2,
          limit: selectedNewsIds.length,
          overrideAccess: false,
        })
      : null,
    selectedPostIds.length
      ? payload.find({
          collection: 'posts',
          where: { and: [{ id: { in: selectedPostIds } }, { _status: { equals: 'published' } }] },
          depth: 2,
          limit: selectedPostIds.length,
          overrideAccess: false,
        })
      : null,
    hashtag
      ? payload.find({
          collection: 'news',
          where: {
            and: [{ _status: { equals: 'published' } }, { 'tags.tag': { contains: hashtag } }],
          },
          depth: 2,
          limit: 100,
          sort: '-publishedAt',
          overrideAccess: false,
        })
      : null,
    hashtag
      ? payload.find({
          collection: 'posts',
          where: {
            and: [{ _status: { equals: 'published' } }, { 'tags.tag': { contains: hashtag } }],
          },
          depth: 2,
          limit: 100,
          sort: '-publishedAt',
          overrideAccess: false,
        })
      : null,
  ])
  const newsStories = news.docs.map((doc) => toStory(doc, 'news'))
  const postStories = posts.docs.map((doc) => toStory(doc, 'posts'))
  const newsById = new Map(
    [...news.docs, ...(selectedNews?.docs ?? [])].map((doc) => [doc.id, toStory(doc, 'news')]),
  )
  const postsById = new Map(
    [...posts.docs, ...(selectedPosts?.docs ?? [])].map((doc) => [doc.id, toStory(doc, 'posts')]),
  )
  const mixed = (values: Mag['mostRead'] | Mag['editorPicks']) =>
    (values ?? [])
      .map((value) => resolveStory(value, newsById, postsById))
      .filter((item): item is MagStory => Boolean(item))
  const matches = [
    ...(matchedNews?.docs ?? []).map((doc) => toStory(doc, 'news')),
    ...(matchedPosts?.docs ?? []).map((doc) => toStory(doc, 'posts')),
  ].filter((story) =>
    story.tags.some((tag) =>
      tag.toLocaleLowerCase('fa-IR').includes((hashtag ?? '').toLocaleLowerCase('fa-IR')),
    ),
  )

  return {
    hero: resolveOne(mag.hero, newsById) ?? newsStories[0],
    latestNews: resolveMany(mag.latestNews, newsById).length
      ? resolveMany(mag.latestNews, newsById)
      : newsStories.slice(0, 8),
    articles: resolveMany(mag.latestArticles, postsById).length
      ? resolveMany(mag.latestArticles, postsById)
      : postStories.slice(0, 3),
    sections: (mag.sections ?? [])
      .map((section, index) => ({
        id: section.id || String(index + 1),
        title: section.title,
        featured: resolveStory(section.featured, newsById, postsById),
        stories: (section.stories ?? [])
          .map((story) => resolveStory(story, newsById, postsById))
          .filter((story): story is MagStory => Boolean(story)),
        hashtag: section.hashtag || undefined,
        reverseLayout: section.reverseLayout ?? false,
      }))
      .filter((section) => Boolean(section.featured)),
    featuredReport: resolveOne(mag.featuredReport, postsById),
    mostRead: mixed(mag.mostRead),
    editorPicks: mixed(mag.editorPicks),
    eventNews: resolveMany(mag.eventNews, newsById),
    hotHashtags: (mag.hotHashtags ?? []).map((item) => item.tag).filter(Boolean),
    newsletterTitle: mag.newsletterTitle || 'آخرین اخبار را از دست ندهید',
    newsletterDescription: mag.newsletterDescription || '',
    showRecruitment: mag.showRecruitment ?? true,
    hashtag,
    matches,
  }
}
