'use client'

import { Button } from '@/components/ui/button'
import React from 'react'
import { FilterIcon } from '@/components/icons'
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

        <Button variant="white" size="icon-48"
          type="button"
          onClick={onFilterClick}
          title="فیلتر"
        >
          <FilterIcon className="size-6.5" />
          <span className="sr-only">فیلتر</span>
        </Button>
      </div>
    </div>
  )
}
