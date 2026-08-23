import { cn } from '@/utilities/ui'
import React from 'react'

import { Card, CardPostData, CardRelationTo } from '@/components/Card'

export type ArchiveResult = CardPostData & {
  /**
   * Present on `search` documents: tells us which collection the hit came from
   * so news results link to /news/… instead of /posts/….
   */
  doc?: { relationTo?: CardRelationTo | null } | number | null
}

export type Props = {
  posts: ArchiveResult[]
  relationTo?: CardRelationTo
}

const resolveRelationTo = (
  result: ArchiveResult,
  fallback: CardRelationTo,
): CardRelationTo => {
  if (result.doc && typeof result.doc === 'object' && result.doc.relationTo) {
    return result.doc.relationTo
  }

  return fallback
}

export const CollectionArchive: React.FC<Props> = (props) => {
  const { posts, relationTo = 'posts' } = props

  return (
    <div className={cn('container')}>
      <div>
        <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 gap-y-4 gap-x-4 lg:gap-y-8 lg:gap-x-8 xl:gap-x-8">
          {posts?.map((result, index) => {
            if (typeof result === 'object' && result !== null) {
              return (
                <div className="col-span-4" key={index}>
                  <Card
                    className="h-full"
                    doc={result}
                    relationTo={resolveRelationTo(result, relationTo)}
                    showCategories
                  />
                </div>
              )
            }

            return null
          })}
        </div>
      </div>
    </div>
  )
}
