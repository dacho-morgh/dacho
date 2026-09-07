'use client'
import { RowLabelProps, useRowLabel } from '@payloadcms/ui'

export const RowLabel: React.FC<RowLabelProps> = () => {
  const data = useRowLabel<{ title?: string; link?: { label?: string } }>()

  const text = data?.data?.title || data?.data?.link?.label
  const label = text
    ? `${data.rowNumber !== undefined ? `${data.rowNumber + 1}. ` : ''}${text}`
    : `Row ${data.rowNumber !== undefined ? data.rowNumber + 1 : ''}`

  return <div>{label}</div>
}

