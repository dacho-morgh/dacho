'use client'

import React from 'react'
import { FilterIcon } from '@/components/dashboard/icons/request-icons'
import { RequestsSearchInput } from './requests-search-input'

export interface RequestsToolbarProps {
  onFilterClick?: () => void
  searchValue?: string
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
}

export function RequestsToolbar({
  onFilterClick,
  searchValue,
  onSearchChange,
  className = '',
}: RequestsToolbarProps) {
  return (
    <div className={`mt-5 flex w-full ${className}`}>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <div className="min-w-0 flex-1 sm:w-100 sm:flex-none">
          <RequestsSearchInput
            value={searchValue}
            onChange={onSearchChange}
          />
        </div>

        <button
          type="button"
          onClick={onFilterClick}
          className="flex h-12 w-12.5 shrink-0 items-center justify-center rounded-[12px] bg-white text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          title="فیلتر"
        >
          <FilterIcon className="size-6.5" />
          <span className="sr-only">فیلتر</span>
        </button>
      </div>
    </div>
  )
}
