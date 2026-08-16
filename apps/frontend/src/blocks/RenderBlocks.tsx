import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'
import React, { Fragment } from 'react'
import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock } from '@/blocks/Content/Component'
import { FormBlock } from '@/blocks/Form/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import type { Page } from '@dacho/cms-core'

export const RenderBlocks: React.FC<{
  blocks: Page['layout'][0][]
}> = (props) => {
  const { blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          let content: React.ReactNode = null

          switch (block.blockType) {
            case 'archive': {
              const { id, ...archiveBlock } = block
              content = <ArchiveBlock {...archiveBlock} id={id ?? undefined} />
              break
            }
            case 'content':
              content = <ContentBlock {...block} />
              break
            case 'cta':
              content = <CallToActionBlock {...block} />
              break
            case 'formBlock': {
              const form = block.form
              if (typeof form !== 'object') return null
              const { id, ...formBlock } = block
              content = (
                <FormBlock
                  blockName={formBlock.blockName ?? undefined}
                  blockType="formBlock"
                  enableIntro={Boolean(block.enableIntro)}
                  form={form as unknown as FormType}
                  id={id ?? undefined}
                  introContent={formBlock.introContent ?? undefined}
                />
              )
              break
            }
            case 'mediaBlock':
              content = <MediaBlock {...block} />
              break
            default:
              return null
          }

          return (
            <div className="my-16" key={block.id ?? index}>
              {content}
            </div>
          )
        })}
      </Fragment>
    )
  }

  return null
}
