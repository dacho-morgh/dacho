'use client'
import { Button } from '@/components/ui/button'
import { CopyIcon } from '@/components/icons'
import { Typography } from '@/components/ui/typography'
import { useState } from 'react'

export function CopyButton({ code }: { code: string }) {
  const [text, setText] = useState('Copy')

  function updateCopyStatus() {
    if (text === 'Copy') {
      setText(() => 'Copied!')
      setTimeout(() => {
        setText(() => 'Copy')
      }, 1000)
    }
  }

  return (
    <div className="flex justify-end align-middle">
      <Button
        className="flex gap-1"
        variant={'secondary'}
        onClick={async () => {
          await navigator.clipboard.writeText(code)
          updateCopyStatus()
        }}
      >
        <Typography as="span" variant="14/regular">{text}</Typography>
        <CopyIcon aria-hidden="true" className="size-4" />
      </Button>
    </div>
  )
}
