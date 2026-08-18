'use client'

import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Typography } from '@/components/ui/typography'
import {
  EyeIcon,
  EditIcon,
  TrashIcon,
  MoreOptionsIcon,
} from '@/components/dashboard/icons/request-icons'

export interface RequestRowActionsProps {
  requestId?: string
  onView?: (id?: string) => void
  onEdit?: (id?: string) => void
  onCancel?: (id?: string) => void
  className?: string
}

/**
 * Row Action Dropdown (Figma Frame 81 - Node 53:10769)
 * w-164, rounded-12, p-1, shadow-[0px_2px_8px_rgba(21,21,21,0.1)]
 * Items: h-8, rounded-10, px-1.5, gap-2, hover bg-[#F5F5F5]
 */
export function RequestRowActions({
  requestId,
  onView,
  onEdit,
  onCancel,
  className = '',
}: RequestRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex size-8 items-center justify-center mx-auto rounded-[10px] text-[#525252] hover:bg-[#E5E5E5]/60 transition-colors focus:outline-none ${className}`}
          title="عملیات بیشتر"
        >
          <MoreOptionsIcon className="size-5 text-[#525252]" />
          <span className="sr-only">منوی عملیات</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="w-41 min-w-41 rounded-[12px] p-1 bg-white shadow-[0px_2px_8px_rgba(21,21,21,0.1)] border-none flex flex-col gap-1"
      >
        {/* Item 1: مشاهده (View) */}
        <DropdownMenuItem
          onClick={() => onView?.(requestId)}
          className="h-8 w-full rounded-[10px] px-1.5 py-2 flex items-center justify-end gap-2 hover:bg-[#F5F5F5] focus:bg-[#F5F5F5] cursor-pointer transition-colors border-none outline-none"
        >
          <Typography as="span" variant="14/light" className="text-[#404040] leading-none">
            مشاهده
          </Typography>
          <EyeIcon className="size-5 text-[#404040] shrink-0" />
        </DropdownMenuItem>

        {/* Item 2: ویرایش (Edit) */}
        <DropdownMenuItem
          onClick={() => onEdit?.(requestId)}
          className="h-8 w-full rounded-[10px] px-1.5 py-2 flex items-center justify-end gap-2 hover:bg-[#F5F5F5] focus:bg-[#F5F5F5] cursor-pointer transition-colors border-none outline-none"
        >
          <Typography as="span" variant="14/regular" className="text-[#404040] leading-none">
            ویرایش
          </Typography>
          <EditIcon className="size-5 text-[#404040] shrink-0" />
        </DropdownMenuItem>

        {/* Item 3: لغو درخواست (Cancel) */}
        <DropdownMenuItem
          onClick={() => onCancel?.(requestId)}
          className="h-8 w-full rounded-[10px] px-1.5 py-2 flex items-center justify-end gap-2 hover:bg-[#F5F5F5] focus:bg-[#F5F5F5] cursor-pointer transition-colors border-none outline-none"
        >
          <Typography as="span" variant="14/regular" className="text-[#404040] leading-none">
            لغو درخواست
          </Typography>
          <TrashIcon className="size-5 text-[#404040] shrink-0" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
